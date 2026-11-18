process.env.NODE_ENV = "test";
process.env.STUDYNOTION_TEST_MODE = "true";
process.env.TEST_MOCK_EXTERNAL_SERVICES = "true";
process.env.JWT_SECRET = process.env.JWT_SECRET || "studynotion-isolated-test-jwt-secret";
process.env.RAZORPAY_SECRET = process.env.RAZORPAY_SECRET || "studynotion-isolated-test-razorpay-secret";
process.env.FOLDER_NAME = "studynotion_test_uploads";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const request = require("supertest");

const { ensureIsolatedMongo } = require("../test-env/mongoInstance");
const database = require("../config/database");
const {
    seedTestDatabase,
    teardownTestDatabase,
    getTestFixturePassword,
} = require("../test-env/seed");
const { assertSafeForDestructiveOp } = require("../config/testSafety");

const User = require("../models/User");
const Profile = require("../models/Profile");
const Category = require("../models/Category");
const Course = require("../models/Course");
const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const CourseProgress = require("../models/CourseProgress");
const OTP = require("../models/OTP");
const mailSender = require("../utils/mailSender");

const app = require("../index");

jest.setTimeout(45000);

describe("Isolated Real-MongoDB Full-Stack Integration Suite (GAP-009)", () => {
    let mongoHandle;
    let seeded;
    let studentToken;
    let instructorToken;
    let adminToken;
    let tempUploadFile;

    const fixturePassword = getTestFixturePassword();

    const loginAs = async (email, password = fixturePassword) => {
        const res = await request(app).post("/api/v1/auth/login").send({ email, password });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        return { token: res.body.token, cookies: res.headers["set-cookie"], user: res.body.user };
    };

    beforeAll(async () => {
        mongoHandle = await ensureIsolatedMongo({
            dbName: "studynotion_integration_test",
            port: 27018,
        });
        process.env.MONGODB_TEST_URL = mongoHandle.uri;

        await database.connect();
        assertSafeForDestructiveOp(mongoose.connection, process.env);
        seeded = await seedTestDatabase();

        studentToken = (await loginAs(seeded.users.studentEmail)).token;
        instructorToken = (await loginAs(seeded.users.instructorEmail)).token;
        adminToken = (await loginAs(seeded.users.adminEmail)).token;

        // Create tiny temporary file for mocked Cloudinary upload endpoints
        tempUploadFile = path.join(os.tmpdir(), `studynotion-test-upload-${Date.now()}.png`);
        fs.writeFileSync(tempUploadFile, Buffer.from("89504e470d0a1a0a", "hex"));
    });

    afterAll(async () => {
        if (tempUploadFile && fs.existsSync(tempUploadFile)) {
            fs.unlinkSync(tempUploadFile);
        }
        await teardownTestDatabase({ dropDb: true });
        if (mongoHandle) {
            await mongoHandle.stop();
        }
    });

    describe("1. Authentication Lifecycle, OTP, Cookies & Protected Routes", () => {
        test("completes real sendOTP -> DB OTP -> signup -> login -> logout -> 401 lifecycle", async () => {
            mailSender.clearSentEmails();
            const newEmail = "realdb.newstudent@isolated.test";

            // Send OTP
            const otpRes = await request(app).post("/api/v1/auth/sendotp").send({ email: newEmail });
            expect(otpRes.status).toBe(200);
            expect(otpRes.body.success).toBe(true);

            // Verify OTP persisted in isolated MongoDB & email mocked (not sent to real SMTP)
            const otpDoc = await OTP.findOne({ email: newEmail }).sort({ createdAt: -1 }).lean();
            expect(otpDoc).toBeTruthy();
            expect(otpDoc.otp).toMatch(/^\d{6}$/);
            expect(mailSender.getSentEmails().some((e) => e.to === newEmail)).toBe(true);

            // Signup with real OTP
            const signupRes = await request(app).post("/api/v1/auth/signup").send({
                firstName: "Real",
                lastName: "Learner",
                email: newEmail,
                password: fixturePassword,
                confirmPassword: fixturePassword,
                accountType: "Student",
                contactNumber: "9876500001",
                otp: otpDoc.otp,
            });
            expect(signupRes.status).toBe(200);
            expect(signupRes.body.success).toBe(true);

            const createdUser = await User.findOne({ email: newEmail }).populate("additionalDetails");
            expect(createdUser).toBeTruthy();
            expect(createdUser.additionalDetails).toBeTruthy();

            // Login using cookie jar via supertest agent
            const agent = request.agent(app);
            const loginRes = await agent
                .post("/api/v1/auth/login")
                .send({ email: newEmail, password: fixturePassword });
            expect(loginRes.status).toBe(200);
            expect(loginRes.headers["set-cookie"]).toBeDefined();

            // Protected route succeeds via httpOnly cookie
            const profileRes = await agent.get("/api/v1/profile/getUserDetails");
            expect(profileRes.status).toBe(200);
            expect(profileRes.body.userDetails.email).toBe(newEmail);

            // Logout clears httpOnly cookie
            const logoutRes = await agent.post("/api/v1/auth/logout");
            expect(logoutRes.status).toBe(200);

            // Subsequent protected call without token returns 401
            const afterLogoutRes = await agent.get("/api/v1/profile/getUserDetails");
            expect(afterLogoutRes.status).toBe(401);

            // Tampered token returns 401
            const badTokenRes = await request(app)
                .get("/api/v1/profile/getUserDetails")
                .set("Authorization", "Bearer invalid.jwt.token");
            expect(badTokenRes.status).toBe(401);
        });
    });

    describe("2. Student Profile Updates & Password Change Persistence", () => {
        test("persists profile edits and password changes in MongoDB", async () => {
            const updateRes = await request(app)
                .put("/api/v1/profile/updateProfile")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    dateOfBirth: "1999-08-20",
                    about: "Updated isolated QA bio",
                    contactNumber: "9111122222",
                    gender: "Female",
                });
            expect(updateRes.status).toBe(200);

            // Verify persisted in MongoDB via fresh GET
            const detailsRes = await request(app)
                .get("/api/v1/profile/getUserDetails")
                .set("Authorization", `Bearer ${studentToken}`);
            expect(detailsRes.status).toBe(200);
            expect(detailsRes.body.userDetails.additionalDetails.about).toBe("Updated isolated QA bio");
            expect(detailsRes.body.userDetails.additionalDetails.gender).toBe("Female");
            expect(detailsRes.body.userDetails.additionalDetails.contactNumber).toBe("9111122222");

            // Change password on disposable student & verify new credentials work
            const dispLogin = await loginAs(seeded.users.disposableStudentEmail);
            const updatedPassword = `${fixturePassword}!New`;
            const changeRes = await request(app)
                .post("/api/v1/auth/changepassword")
                .set("Authorization", `Bearer ${dispLogin.token}`)
                .send({
                    oldPassword: fixturePassword,
                    newPassword: updatedPassword,
                    confirmNewPassword: updatedPassword,
                });
            expect(changeRes.status).toBe(200);

            const oldFail = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: seeded.users.disposableStudentEmail, password: fixturePassword });
            expect(oldFail.status).toBe(401);

            const newOk = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: seeded.users.disposableStudentEmail, password: updatedPassword });
            expect(newOk.status).toBe(200);
        });
    });

    describe("3. Course Enrollment, Content Access, Progress Tracking & Ratings", () => {
        test("enforces enrollment check on getFullCourseDetails, then enrolls via payment & tracks progress", async () => {
            // Unenrolled student must be denied full course details (403)
            const deniedRes = await request(app)
                .post("/api/v1/course/getFullCourseDetails")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ courseId: seeded.courses.purchasableCourseId });
            expect(deniedRes.status).toBe(403);

            // Capture sandbox payment order
            const captureRes = await request(app)
                .post("/api/v1/payment/capturePayment")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ courses: [seeded.courses.purchasableCourseId] });
            expect(captureRes.status).toBe(200);
            const orderId = captureRes.body.message.id;
            expect(orderId).toMatch(/^order_test_/);

            // Tampered signature must fail (400)
            const badVerify = await request(app)
                .post("/api/v1/payment/verifyPayment")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    razorpay_order_id: orderId,
                    razorpay_payment_id: "pay_test_tampered",
                    razorpay_signature: "deadbeef",
                    courses: [seeded.courses.purchasableCourseId],
                });
            expect(badVerify.status).toBe(400);

            // Valid HMAC-SHA256 signature enrolls student & creates CourseProgress in real MongoDB
            const paymentId = "pay_test_valid_001";
            const validSignature = crypto
                .createHmac("sha256", process.env.RAZORPAY_SECRET)
                .update(`${orderId}|${paymentId}`)
                .digest("hex");

            const verifyRes = await request(app)
                .post("/api/v1/payment/verifyPayment")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    razorpay_order_id: orderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature: validSignature,
                    courses: [seeded.courses.purchasableCourseId],
                });
            expect(verifyRes.status).toBe(200);

            // Verify database consistency across Course, User, and CourseProgress
            const updatedCourse = await Course.findById(seeded.courses.purchasableCourseId).lean();
            expect(updatedCourse.studentEnrolled.map(String)).toContain(seeded.users.studentId);

            const updatedUser = await User.findById(seeded.users.studentId).lean();
            expect(updatedUser.courses.map(String)).toContain(seeded.courses.purchasableCourseId);

            const progressDoc = await CourseProgress.findOne({
                courseID: seeded.courses.purchasableCourseId,
                userId: seeded.users.studentId,
            }).lean();
            expect(progressDoc).toBeTruthy();

            // Duplicate enrollment must be rejected (400)
            const dupRes = await request(app)
                .post("/api/v1/payment/capturePayment")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ courses: [seeded.courses.purchasableCourseId] });
            expect(dupRes.status).toBe(400);

            // Enrolled student can now access full course details
            const fullRes = await request(app)
                .post("/api/v1/course/getFullCourseDetails")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ courseId: seeded.courses.enrolledCourseId });
            expect(fullRes.status).toBe(200);
            expect(fullRes.body.data.courseDetails.courseContent.length).toBe(2);

            // Mark first lecture complete + verify idempotency on repeat call
            const progRes1 = await request(app)
                .post("/api/v1/course/updateCourseProgress")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    courseId: seeded.courses.enrolledCourseId,
                    subsectionId: seeded.courses.enrolledFirstSubSectionId,
                });
            expect(progRes1.status).toBe(200);

            const progRes2 = await request(app)
                .post("/api/v1/course/updateCourseProgress")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    courseId: seeded.courses.enrolledCourseId,
                    subsectionId: seeded.courses.enrolledFirstSubSectionId,
                });
            expect(progRes2.status).toBe(200);

            const persistedProgress = await CourseProgress.findOne({
                courseID: seeded.courses.enrolledCourseId,
                userId: seeded.users.studentId,
            }).lean();
            expect(persistedProgress.completedVideos.map(String)).toEqual([
                seeded.courses.enrolledFirstSubSectionId,
            ]);

            // Submit rating & verify real MongoDB $avg aggregation pipeline
            const rateRes = await request(app)
                .post("/api/v1/course/createRating")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    courseId: seeded.courses.enrolledCourseId,
                    rating: 5,
                    review: "Excellent isolated test course!",
                });
            expect(rateRes.status).toBe(200);

            const avgRes = await request(app)
                .get("/api/v1/course/getAverageRating")
                .query({ courseId: seeded.courses.enrolledCourseId });
            expect(avgRes.status).toBe(200);
            expect(avgRes.body.averageRating).toBe(5);
        });
    });

    describe("4. Instructor Course CRUD, Sections, SubSections & Cascade Delete Consistency", () => {
        test("creates, populates, edits, publishes, and cascade-deletes a course cleanly", async () => {
            // Create course with mocked thumbnail upload
            const createRes = await request(app)
                .post("/api/v1/course/createCourse")
                .set("Authorization", `Bearer ${instructorToken}`)
                .field("courseName", "RealDB Integration Course")
                .field("courseDescription", "Created in isolated MongoDB integration test")
                .field("whatYouWillLearn", "End-to-end DB consistency")
                .field("price", "799")
                .field("tag", JSON.stringify(["Integration", "MongoDB"]))
                .field("category", seeded.categories.webDevId)
                .field("instructions", JSON.stringify(["Step 1", "Step 2"]))
                .attach("thumbnailImage", tempUploadFile);

            expect(createRes.status).toBe(200);
            const courseId = createRes.body.data._id;
            expect(createRes.body.data.tag).toEqual(["Integration", "MongoDB"]);
            expect(createRes.body.data.instructions).toEqual(["Step 1", "Step 2"]);

            // Add section
            const secRes = await request(app)
                .post("/api/v1/course/addSection")
                .set("Authorization", `Bearer ${instructorToken}`)
                .send({ sectionName: "Integration Section 1", courseId });
            expect(secRes.status).toBe(200);
            const sectionId = secRes.body.data.courseContent[0]._id;

            // Add subsection with mocked video upload
            const subRes = await request(app)
                .post("/api/v1/course/addSubSection")
                .set("Authorization", `Bearer ${instructorToken}`)
                .field("sectionId", sectionId)
                .field("title", "Integration Video 1")
                .field("description", "Mocked video lecture")
                .field("timeDuration", "90")
                .attach("videoFile", tempUploadFile);
            expect(subRes.status).toBe(200);
            const subSectionId = subRes.body.data.subSection[0]._id;

            // Edit course & publish
            const editRes = await request(app)
                .post("/api/v1/course/editCourse")
                .set("Authorization", `Bearer ${instructorToken}`)
                .send({
                    courseId,
                    courseName: "RealDB Integration Course (Published)",
                    status: "Published",
                });
            expect(editRes.status).toBe(200);
            expect(editRes.body.data.status).toBe("Published");

            // Delete course & verify cascade cleanup across collections
            const delRes = await request(app)
                .delete("/api/v1/course/deleteCourse")
                .set("Authorization", `Bearer ${instructorToken}`)
                .send({ courseId });
            expect(delRes.status).toBe(200);

            expect(await Course.findById(courseId)).toBeNull();
            expect(await Section.findById(sectionId)).toBeNull();
            expect(await SubSection.findById(subSectionId)).toBeNull();

            const instDoc = await User.findById(seeded.users.instructorId).lean();
            expect(instDoc.courses.map(String)).not.toContain(courseId);

            const catDoc = await Category.findById(seeded.categories.webDevId).lean();
            expect(catDoc.courses.map(String)).not.toContain(courseId);
        });
    });

    describe("5. Role-Based Permission Restrictions & Account Deletion Cascade", () => {
        test("enforces Student / Instructor / Admin RBAC and prevents cross-instructor IDOR", async () => {
            // Student cannot access instructor dashboard or admin category creation
            const stuInstRes = await request(app)
                .get("/api/v1/profile/instructorDashboard")
                .set("Authorization", `Bearer ${studentToken}`);
            expect(stuInstRes.status).toBe(403);

            const stuCatRes = await request(app)
                .post("/api/v1/course/createCategory")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ name: "Unauthorized Cat", description: "Should fail" });
            expect(stuCatRes.status).toBe(403);

            // Instructor cannot capture student payment or create admin category
            const instPayRes = await request(app)
                .post("/api/v1/payment/capturePayment")
                .set("Authorization", `Bearer ${instructorToken}`)
                .send({ courses: [seeded.courses.purchasableCourseId] });
            expect(instPayRes.status).toBe(403);

            const instCatRes = await request(app)
                .post("/api/v1/course/createCategory")
                .set("Authorization", `Bearer ${instructorToken}`)
                .send({ name: "Instructor Cat", description: "Should fail" });
            expect(instCatRes.status).toBe(403);

            // Admin CAN create category in real MongoDB
            const adminCatRes = await request(app)
                .post("/api/v1/course/createCategory")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ name: "AI Testing", description: "Admin-created test category" });
            expect(adminCatRes.status).toBe(200);
            expect(await Category.findOne({ name: "AI Testing" })).toBeTruthy();

            // Second instructor cannot edit or delete first instructor's course (IDOR protection)
            const otherInstProfile = await Profile.create({});
            const otherInst = await User.create({
                firstName: "Other",
                lastName: "Instructor",
                email: "other.instructor@isolated.test",
                password: await require("bcrypt").hash(fixturePassword, 10),
                accountType: "Instructor",
                image: "https://api.dicebear.com/5.x/initials/svg?seed=Other%20Instructor",
                additionalDetails: otherInstProfile._id,
            });
            const otherInstLogin = await loginAs(otherInst.email);

            const idorEdit = await request(app)
                .post("/api/v1/course/editCourse")
                .set("Authorization", `Bearer ${otherInstLogin.token}`)
                .send({ courseId: seeded.courses.enrolledCourseId, courseName: "Hacked" });
            expect(idorEdit.status).toBe(403);

            const idorDel = await request(app)
                .delete("/api/v1/course/deleteCourse")
                .set("Authorization", `Bearer ${otherInstLogin.token}`)
                .send({ courseId: seeded.courses.enrolledCourseId });
            expect(idorDel.status).toBe(403);
        });

        test("cascades user deletion across User, Profile, and CourseProgress", async () => {
            const updatedPassword = `${fixturePassword}!New`;
            const dispLogin = await loginAs(seeded.users.disposableStudentEmail, updatedPassword);
            const dispUserBefore = await User.findById(seeded.users.disposableStudentId).lean();
            expect(dispUserBefore).toBeTruthy();

            const delRes = await request(app)
                .delete("/api/v1/profile/deleteProfile")
                .set("Authorization", `Bearer ${dispLogin.token}`);
            expect(delRes.status).toBe(200);

            expect(await User.findById(seeded.users.disposableStudentId)).toBeNull();
            expect(await Profile.findById(dispUserBefore.additionalDetails)).toBeNull();
        });
    });

    describe("6. Free Course Enrollment, Pricing Validation, Duplicate & Security Protection (GAP-005)", () => {
        test("enrolls student in ₹0 course without Razorpay, blocks paid bypass/duplicates/negative pricing/cross-user access", async () => {
            // 1. Instructor can create a ₹0 course, cannot create or edit negative price
            const negCreate = await request(app)
                .post("/api/v1/course/createCourse")
                .set("Authorization", `Bearer ${instructorToken}`)
                .field("courseName", "Invalid Negative Course")
                .field("courseDescription", "Should fail")
                .field("whatYouWillLearn", "Validation")
                .field("price", "-50")
                .field("category", seeded.categories.webDevId);
            expect(negCreate.status).toBe(400);

            const freeCreate = await request(app)
                .post("/api/v1/course/createCourse")
                .set("Authorization", `Bearer ${instructorToken}`)
                .field("courseName", "RealDB Free Draft Course")
                .field("courseDescription", "Created as draft free course")
                .field("whatYouWillLearn", "Free fundamentals")
                .field("price", "0")
                .field("tag", JSON.stringify(["Free"]))
                .field("category", seeded.categories.webDevId)
                .field("instructions", JSON.stringify(["None"]));
            expect(freeCreate.status).toBe(200);
            expect(freeCreate.body.data.price).toBe(0);
            const draftFreeId = freeCreate.body.data._id;

            // Negative price edit rejected
            const negEdit = await request(app)
                .post("/api/v1/course/editCourse")
                .set("Authorization", `Bearer ${instructorToken}`)
                .send({ courseId: draftFreeId, price: -10 });
            expect(negEdit.status).toBe(400);

            // Draft free course cannot be enrolled yet
            const draftEnroll = await request(app)
                .post("/api/v1/payment/enrollFreeCourse")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ courseId: draftFreeId });
            expect(draftEnroll.status).toBe(400);

            // 2. Security: unauthenticated (401), instructor role (403), invalid ID (400)
            const unauthRes = await request(app)
                .post("/api/v1/payment/enrollFreeCourse")
                .send({ courseId: seeded.courses.freeCourseId });
            expect(unauthRes.status).toBe(401);

            const instEnrollRes = await request(app)
                .post("/api/v1/payment/enrollFreeCourse")
                .set("Authorization", `Bearer ${instructorToken}`)
                .send({ courseId: seeded.courses.freeCourseId });
            expect(instEnrollRes.status).toBe(403);

            const badIdRes = await request(app)
                .post("/api/v1/payment/enrollFreeCourse")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ courseId: "bad-id" });
            expect(badIdRes.status).toBe(400);

            // 3. Security: paid course bypass attempt (sending price: 0 from client) MUST be rejected
            const paidBypassRes = await request(app)
                .post("/api/v1/payment/enrollFreeCourse")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ courseId: seeded.courses.dataScienceCourseId, price: 0 });
            expect(paidBypassRes.status).toBe(400);
            const paidCourseDoc = await Course.findById(seeded.courses.dataScienceCourseId).lean();
            expect(paidCourseDoc.studentEnrolled.map(String)).not.toContain(seeded.users.studentId);

            // 4. Valid free enrollment in published ₹0 seeded course (ignores spoofed userId)
            const enrollRes = await request(app)
                .post("/api/v1/payment/enrollFreeCourse")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    courseId: seeded.courses.freeCourseId,
                    userId: seeded.users.instructorId,
                });
            expect(enrollRes.status).toBe(200);
            expect(enrollRes.body.success).toBe(true);

            // Verify real MongoDB persistence: Course.studentEnrolled, User.courses, CourseProgress
            const freeCourseDoc = await Course.findById(seeded.courses.freeCourseId).lean();
            expect(freeCourseDoc.studentEnrolled.map(String)).toEqual([seeded.users.studentId]);

            const studentDoc = await User.findById(seeded.users.studentId).lean();
            expect(studentDoc.courses.map(String)).toContain(seeded.courses.freeCourseId);

            const progressDocs = await CourseProgress.find({
                courseID: seeded.courses.freeCourseId,
                userId: seeded.users.studentId,
            }).lean();
            expect(progressDocs.length).toBe(1);
            expect(progressDocs[0].completedVideos).toEqual([]);

            // Student appears in My Courses (getEnrolledCourses) and can access course content
            const enrolledListRes = await request(app)
                .get("/api/v1/profile/getEnrolledCourses")
                .set("Authorization", `Bearer ${studentToken}`);
            expect(enrolledListRes.status).toBe(200);
            expect(enrolledListRes.body.data.map((c) => c._id.toString())).toContain(
                seeded.courses.freeCourseId
            );

            const contentRes = await request(app)
                .post("/api/v1/course/getFullCourseDetails")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ courseId: seeded.courses.freeCourseId });
            expect(contentRes.status).toBe(200);
            expect(contentRes.body.data.courseDetails.courseContent.length).toBe(1);

            // 5. Duplicate enrollment protection (409 + zero duplicate DB docs)
            const dupRes = await request(app)
                .post("/api/v1/payment/enrollFreeCourse")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ courseId: seeded.courses.freeCourseId });
            expect(dupRes.status).toBe(409);

            const freeCourseAfterDup = await Course.findById(seeded.courses.freeCourseId).lean();
            expect(freeCourseAfterDup.studentEnrolled.length).toBe(1);
            const progressAfterDup = await CourseProgress.find({
                courseID: seeded.courses.freeCourseId,
                userId: seeded.users.studentId,
            }).lean();
            expect(progressAfterDup.length).toBe(1);

            // 6. Cross-user access restriction: unenrolled second student gets 403 on free course content
            const secondStudentProfile = await Profile.create({});
            const secondStudent = await User.create({
                firstName: "Unenrolled",
                lastName: "Student",
                email: "unenrolled.student@isolated.test",
                password: await require("bcrypt").hash(fixturePassword, 10),
                accountType: "Student",
                image: "https://api.dicebear.com/5.x/initials/svg?seed=Unenrolled%20Student",
                additionalDetails: secondStudentProfile._id,
            });
            const secondLogin = await loginAs(secondStudent.email);
            const crossUserRes = await request(app)
                .post("/api/v1/course/getFullCourseDetails")
                .set("Authorization", `Bearer ${secondLogin.token}`)
                .send({ courseId: seeded.courses.freeCourseId });
            expect(crossUserRes.status).toBe(403);
        });
    });
});
