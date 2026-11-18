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
const RatingAndReview = require("../models/RatingAndReview");
const OTP = require("../models/OTP");
const Order = require("../models/Order");
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

    describe("7. Global Course Search, Filtering, Sorting & Pagination (GAP-004 Real MongoDB)", () => {
        test("verifies search, filters, sorting, pagination, draft exclusion, and indexes against real MongoDB", async () => {
            // Verify MongoDB indexes created on Course collection
            await Course.init();
            const indexes = await Course.collection.indexes();
            const indexNames = indexes.map((idx) => idx.name);
            expect(indexNames).toContain("course_search_text_idx");
            expect(indexNames).toContain("status_1_createdAt_-1");
            expect(indexNames).toContain("status_1_category_1_price_1");

            const baseTime = new Date("2026-01-01T00:00:00.000Z").getTime();
            const studentObjId = new mongoose.Types.ObjectId(seeded.users.studentId);
            const extraUser1 = new mongoose.Types.ObjectId();
            const extraUser2 = new mongoose.Types.ObjectId();
            const extraUser3 = new mongoose.Types.ObjectId();

            // Create controlled real documents for search, rating, popularity, price, draft, and pagination tests
            const draftCourse = await Course.create({
                courseName: "Secret Unpublished Quantum Draft",
                courseDescription: "Draft course that must never appear in public search.",
                instructor: seeded.users.instructorId,
                whatYouWillLearn: "Hidden draft content",
                price: 0,
                tag: ["SecretDraft", "Quantum"],
                category: seeded.categories.webDevId,
                status: "Draft",
                createdAt: new Date(baseTime + 100000),
            });

            const cppCourse = await Course.create({
                courseName: "Modern C++ Systems Guide",
                courseDescription: "Memory safety and low-level C++ concurrency patterns.",
                instructor: seeded.users.instructorId,
                whatYouWillLearn: "Write high-performance C++ services.",
                price: 499,
                tag: ["C++", "Systems"],
                category: seeded.categories.devopsId,
                studentEnrolled: [studentObjId, extraUser1, extraUser2, extraUser3], // 4 enrolled (most popular)
                status: "Published",
                createdAt: new Date(baseTime + 20000),
            });

            const highRatedPaid = await Course.create({
                courseName: "GraphQL API Architecture",
                courseDescription: "Design resilient GraphQL federated schemas.",
                instructor: seeded.users.instructorId,
                whatYouWillLearn: "Build scalable GraphQL APIs.",
                price: 1999,
                tag: ["GraphQL", "API"],
                category: seeded.categories.webDevId,
                studentEnrolled: [studentObjId, extraUser1], // 2 enrolled
                status: "Published",
                createdAt: new Date(baseTime + 40000),
            });

            const lowRatedFree = await Course.create({
                courseName: "Free Git Workflow Basics",
                courseDescription: "Branching and pull requests for beginners.",
                instructor: seeded.users.instructorId,
                whatYouWillLearn: "Collaborate using Git cleanly.",
                price: 0,
                tag: ["Git", "Free"],
                category: seeded.categories.devopsId,
                studentEnrolled: [],
                status: "Published",
                createdAt: new Date(baseTime + 60000),
            });

            // Add 10 more published courses to verify multi-page pagination & large result sets
            const bulkCourses = Array.from({ length: 10 }, (_, idx) => ({
                courseName: `Pagination Course ${String(idx + 1).padStart(2, "0")}`,
                courseDescription: `Structured catalog entry #${idx + 1} for pagination validation.`,
                instructor: seeded.users.instructorId,
                whatYouWillLearn: "Server-side pagination mastery",
                price: idx % 2 === 0 ? 0 : 250 + idx * 50,
                tag: ["Pagination", "Catalog"],
                category: seeded.categories.dataScienceId,
                studentEnrolled: [],
                status: "Published",
                createdAt: new Date(baseTime + 70000 + idx * 1000),
            }));
            await Course.insertMany(bulkCourses);

            // Real RatingAndReview documents (no fabricated ratings!)
            const r1 = await RatingAndReview.create({
                user: extraUser1,
                course: highRatedPaid._id,
                rating: 5,
                review: "Outstanding GraphQL depth",
            });
            const r2 = await RatingAndReview.create({
                user: extraUser2,
                course: highRatedPaid._id,
                rating: 4,
                review: "Very thorough architecture patterns",
            }); // avg = 4.5
            await Course.findByIdAndUpdate(highRatedPaid._id, {
                $push: { ratingAndReviews: { $each: [r1._id, r2._id] } },
            });

            const r3 = await RatingAndReview.create({
                user: extraUser1,
                course: lowRatedFree._id,
                rating: 2,
                review: "Too short",
            }); // avg = 2.0
            await Course.findByIdAndUpdate(lowRatedFree._id, {
                $push: { ratingAndReviews: r3._id },
            });

            // 1. Draft course is NEVER exposed even when searched by exact title
            const draftRes = await request(app)
                .get("/api/v1/course/search")
                .query({ q: draftCourse.courseName });
            expect(draftRes.status).toBe(200);
            expect(draftRes.body.data.courses).toEqual([]);
            expect(draftRes.body.data.pagination.totalCourses).toBe(0);

            // 2. Exact title, partial title, case-insensitive, and regex-special-char ("C++") search
            const exactRes = await request(app)
                .get("/api/v1/course/search")
                .query({ q: "GraphQL API Architecture" });
            expect(exactRes.status).toBe(200);
            expect(exactRes.body.data.courses.map((c) => c.courseName)).toEqual([
                "GraphQL API Architecture",
            ]);

            const partialRes = await request(app)
                .get("/api/v1/course/search")
                .query({ q: "graphql" });
            expect(partialRes.status).toBe(200);
            expect(partialRes.body.data.courses[0].courseName).toBe("GraphQL API Architecture");

            const specialCharRes = await request(app)
                .get("/api/v1/course/search")
                .query({ q: "C++" });
            expect(specialCharRes.status).toBe(200);
            expect(specialCharRes.body.data.courses.map((c) => c.courseName)).toEqual([
                "Modern C++ Systems Guide",
            ]);

            // 3. No matching results
            const emptyMatchRes = await request(app)
                .get("/api/v1/course/search")
                .query({ q: "NonExistentZebraTopic999" });
            expect(emptyMatchRes.status).toBe(200);
            expect(emptyMatchRes.body.data.courses).toEqual([]);
            expect(emptyMatchRes.body.data.pagination.totalCourses).toBe(0);
            expect(emptyMatchRes.body.data.pagination.totalPages).toBe(0);

            // 4. Empty search returns both free and paid published courses (and zero drafts)
            const allRes = await request(app).get("/api/v1/course/search").query({ limit: 50 });
            expect(allRes.status).toBe(200);
            const allIds = allRes.body.data.courses.map((c) => c._id.toString());
            expect(allIds).not.toContain(draftCourse._id.toString());
            expect(allRes.body.data.courses.some((c) => c.price === 0)).toBe(true);
            expect(allRes.body.data.courses.some((c) => c.price > 0)).toBe(true);

            // 5. Category, Free, Paid, Price-range, Rating & Combined filtering
            const freeRes = await request(app)
                .get("/api/v1/course/search")
                .query({ priceType: "free", limit: 50 });
            expect(freeRes.status).toBe(200);
            expect(freeRes.body.data.courses.length).toBeGreaterThanOrEqual(2);
            expect(freeRes.body.data.courses.every((c) => c.price === 0)).toBe(true);

            const paidRes = await request(app)
                .get("/api/v1/course/search")
                .query({ priceType: "paid", limit: 50 });
            expect(paidRes.status).toBe(200);
            expect(paidRes.body.data.courses.length).toBeGreaterThanOrEqual(3);
            expect(paidRes.body.data.courses.every((c) => c.price > 0)).toBe(true);

            const rangeRes = await request(app)
                .get("/api/v1/course/search")
                .query({ minPrice: 400, maxPrice: 1000, limit: 50 });
            expect(rangeRes.status).toBe(200);
            expect(rangeRes.body.data.courses.length).toBeGreaterThanOrEqual(2);
            expect(
                rangeRes.body.data.courses.every((c) => c.price >= 400 && c.price <= 1000)
            ).toBe(true);

            const ratingFilterRes = await request(app)
                .get("/api/v1/course/search")
                .query({ minRating: 4, limit: 50 });
            expect(ratingFilterRes.status).toBe(200);
            const highRatedNames = ratingFilterRes.body.data.courses.map((c) => c.courseName);
            expect(highRatedNames).toContain("GraphQL API Architecture");
            expect(highRatedNames).not.toContain("Free Git Workflow Basics");
            expect(ratingFilterRes.body.data.courses.every((c) => c.averageRating >= 4)).toBe(true);

            const combinedRes = await request(app)
                .get("/api/v1/course/search")
                .query({
                    category: seeded.categories.webDevId,
                    priceType: "paid",
                    minPrice: 1500,
                    maxPrice: 2500,
                    minRating: 4,
                    q: "GraphQL",
                });
            expect(combinedRes.status).toBe(200);
            expect(combinedRes.body.data.courses.map((c) => c.courseName)).toEqual([
                "GraphQL API Architecture",
            ]);

            // 6. All 5 sorting options verified against actual DB values
            const newestRes = await request(app)
                .get("/api/v1/course/search")
                .query({ sort: "newest", limit: 50 });
            const newestDates = newestRes.body.data.courses.map((c) =>
                new Date(c.createdAt).getTime()
            );
            for (let i = 1; i < newestDates.length; i += 1) {
                expect(newestDates[i - 1]).toBeGreaterThanOrEqual(newestDates[i]);
            }

            const popularRes = await request(app)
                .get("/api/v1/course/search")
                .query({ sort: "popular", limit: 50 });
            expect(popularRes.body.data.courses[0].courseName).toBe("Modern C++ Systems Guide");
            const popularCounts = popularRes.body.data.courses.map((c) => c.studentEnrolledCount);
            for (let i = 1; i < popularCounts.length; i += 1) {
                expect(popularCounts[i - 1]).toBeGreaterThanOrEqual(popularCounts[i]);
            }

            const priceAscRes = await request(app)
                .get("/api/v1/course/search")
                .query({ sort: "price_asc", limit: 50 });
            const ascPrices = priceAscRes.body.data.courses.map((c) => c.price);
            expect(ascPrices[0]).toBe(0);
            for (let i = 1; i < ascPrices.length; i += 1) {
                expect(ascPrices[i - 1]).toBeLessThanOrEqual(ascPrices[i]);
            }

            const priceDescRes = await request(app)
                .get("/api/v1/course/search")
                .query({ sort: "price_desc", limit: 50 });
            const descPrices = priceDescRes.body.data.courses.map((c) => c.price);
            expect(descPrices[0]).toBe(1999);
            for (let i = 1; i < descPrices.length; i += 1) {
                expect(descPrices[i - 1]).toBeGreaterThanOrEqual(descPrices[i]);
            }

            const ratingSortRes = await request(app)
                .get("/api/v1/course/search")
                .query({ sort: "rating", limit: 50 });
            const sortedRatings = ratingSortRes.body.data.courses.map((c) => c.averageRating);
            for (let i = 1; i < sortedRatings.length; i += 1) {
                expect(sortedRatings[i - 1]).toBeGreaterThanOrEqual(sortedRatings[i]);
            }

            // 7. Multi-page server-side pagination, large limit clamping & invalid params
            const page1Res = await request(app)
                .get("/api/v1/course/search")
                .query({ q: "Pagination Course", sort: "newest", page: 1, limit: 4 });
            const page2Res = await request(app)
                .get("/api/v1/course/search")
                .query({ q: "Pagination Course", sort: "newest", page: 2, limit: 4 });
            const page3Res = await request(app)
                .get("/api/v1/course/search")
                .query({ q: "Pagination Course", sort: "newest", page: 3, limit: 4 });

            expect(page1Res.body.data.pagination).toEqual({
                page: 1,
                limit: 4,
                totalCourses: 10,
                totalPages: 3,
                hasNextPage: true,
                hasPrevPage: false,
            });
            expect(page1Res.body.data.courses).toHaveLength(4);
            expect(page2Res.body.data.courses).toHaveLength(4);
            expect(page3Res.body.data.courses).toHaveLength(2);
            expect(page3Res.body.data.pagination.hasNextPage).toBe(false);
            expect(page3Res.body.data.pagination.hasPrevPage).toBe(true);

            const pagedIds = [
                ...page1Res.body.data.courses,
                ...page2Res.body.data.courses,
                ...page3Res.body.data.courses,
            ].map((c) => c._id.toString());
            expect(new Set(pagedIds).size).toBe(10);

            // Out-of-range page returns empty array gracefully
            const oobRes = await request(app)
                .get("/api/v1/course/search")
                .query({ q: "Pagination Course", page: 99, limit: 4 });
            expect(oobRes.status).toBe(200);
            expect(oobRes.body.data.courses).toEqual([]);
            expect(oobRes.body.data.pagination.totalCourses).toBe(10);

            // Overly large limit clamped to 50
            const largeLimitRes = await request(app)
                .get("/api/v1/course/search")
                .query({ limit: 500 });
            expect(largeLimitRes.status).toBe(200);
            expect(largeLimitRes.body.data.pagination.limit).toBe(50);

            // Invalid params return 400
            const badParamRes = await request(app)
                .get("/api/v1/course/search")
                .query({ minPrice: 500, maxPrice: 100 });
            expect(badParamRes.status).toBe(400);
        });
    });

    describe("8. Admin Dashboard, Category CRUD, RBAC & Course Consistency (GAP-001 Real MongoDB)", () => {
        test("enforces admin RBAC, validates CRUD, blocks unsafe deletion, and keeps catalog/search/course details consistent", async () => {
            const jwt = require("jsonwebtoken");
            const expiredAdminJwt = jwt.sign(
                { id: seeded.users.adminId, email: seeded.users.adminEmail, accountType: "Admin" },
                process.env.JWT_SECRET,
                { expiresIn: "-5s" }
            );

            // 1. Security checks: unauthenticated (401), invalid/expired JWT (401), student & instructor (403)
            const adminEndpoints = [
                { method: "get", path: "/api/v1/course/adminDashboard" },
                {
                    method: "post",
                    path: "/api/v1/course/createCategory",
                    body: { name: "Unauthorized Cat", accountType: "Admin" },
                },
                {
                    method: "put",
                    path: "/api/v1/course/updateCategory",
                    body: { categoryId: seeded.categories.webDevId, name: "Hacked", accountType: "Admin" },
                },
                {
                    method: "delete",
                    path: "/api/v1/course/deleteCategory",
                    body: { categoryId: seeded.categories.webDevId, accountType: "Admin" },
                },
            ];

            for (const ep of adminEndpoints) {
                expect((await request(app)[ep.method](ep.path).send(ep.body || {})).status).toBe(401);
                expect(
                    (
                        await request(app)
                            [ep.method](ep.path)
                            .set("Authorization", "Bearer tampered.jwt.value")
                            .send(ep.body || {})
                    ).status
                ).toBe(401);
                expect(
                    (
                        await request(app)
                            [ep.method](ep.path)
                            .set("Authorization", `Bearer ${expiredAdminJwt}`)
                            .send(ep.body || {})
                    ).status
                ).toBe(401);
                expect(
                    (
                        await request(app)
                            [ep.method](ep.path)
                            .set("Authorization", `Bearer ${studentToken}`)
                            .send(ep.body || {})
                    ).status
                ).toBe(403);
                expect(
                    (
                        await request(app)
                            [ep.method](ep.path)
                            .set("Authorization", `Bearer ${instructorToken}`)
                            .send(ep.body || {})
                    ).status
                ).toBe(403);
            }

            // 2. Admin creates a new category & duplicate prevention blocks exact + slug collisions (409)
            const createRes = await request(app)
                .post("/api/v1/course/createCategory")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ name: "Cloud Architecture", description: "Scalable cloud systems" });
            expect(createRes.status).toBe(200);
            expect(createRes.body.success).toBe(true);
            const cloudCatId = createRes.body.data._id;

            const dupExactRes = await request(app)
                .post("/api/v1/course/createCategory")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ name: "cloud architecture", description: "Duplicate" });
            expect(dupExactRes.status).toBe(409);

            const dupSlugRes = await request(app)
                .post("/api/v1/course/createCategory")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ name: "Cloud-Architecture", description: "Slug collision" });
            expect(dupSlugRes.status).toBe(409);

            // 3. Instructor creates & publishes a course in the newly created category
            const courseRes = await request(app)
                .post("/api/v1/course/createCourse")
                .set("Authorization", `Bearer ${instructorToken}`)
                .send({
                    courseName: "AWS Cloud Foundations",
                    courseDescription: "Hands-on cloud architecture fundamentals",
                    whatYouWillLearn: "Design resilient AWS stacks",
                    price: 599,
                    category: cloudCatId,
                    status: "Published",
                });
            expect(courseRes.status).toBe(200);
            const cloudCourseId = courseRes.body.data._id;

            // Warm getCourseDetails cache before category rename to prove cache invalidation works
            const preRenameDetails = await request(app)
                .post("/api/v1/course/getCourseDetails")
                .send({ courseId: cloudCourseId });
            expect(preRenameDetails.status).toBe(200);
            expect(preRenameDetails.body.data.courseDetails.category.name).toBe(
                "Cloud Architecture"
            );

            // 4. Admin updates category name & description -> preserves course relationship & updates Catalog/Search/CourseDetails
            const updateRes = await request(app)
                .put("/api/v1/course/updateCategory")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    categoryId: cloudCatId,
                    name: "Cloud Engineering",
                    description: "Updated cloud engineering curriculum",
                });
            expect(updateRes.status).toBe(200);
            expect(updateRes.body.data.name).toBe("Cloud Engineering");

            // Catalog page details reflects updated name & preserves linked published course
            const catPageRes = await request(app)
                .post("/api/v1/course/getCategoryPageDetails")
                .send({ categoryId: cloudCatId });
            expect(catPageRes.status).toBe(200);
            expect(catPageRes.body.data.selectedCategory.name).toBe("Cloud Engineering");
            expect(
                catPageRes.body.data.selectedCategory.courses.map((c) => c._id.toString())
            ).toContain(cloudCourseId);

            // Global search filtered by category returns updated category name
            const searchRes = await request(app)
                .get("/api/v1/course/search")
                .query({ category: cloudCatId });
            expect(searchRes.status).toBe(200);
            expect(searchRes.body.data.courses[0].courseName).toBe("AWS Cloud Foundations");
            expect(searchRes.body.data.courses[0].category.name).toBe("Cloud Engineering");

            // Course details reflects updated category name (stale cache invalidated)
            const postRenameDetails = await request(app)
                .post("/api/v1/course/getCourseDetails")
                .send({ courseId: cloudCourseId });
            expect(postRenameDetails.status).toBe(200);
            expect(postRenameDetails.body.data.courseDetails.category.name).toBe(
                "Cloud Engineering"
            );

            // 5. Safe deletion: deleting category with associated course MUST be blocked (409)
            const blockedDelRes = await request(app)
                .delete("/api/v1/course/deleteCategory")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ categoryId: cloudCatId });
            expect(blockedDelRes.status).toBe(409);
            expect(blockedDelRes.body.associatedCourseCount).toBe(1);
            expect(await Category.findById(cloudCatId)).not.toBeNull();

            // 6. Admin dashboard reports accurate course counts & empty category deletion succeeds (200)
            const emptyCatRes = await request(app)
                .post("/api/v1/course/createCategory")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ name: "Temporary Empty Category", description: "Safe to remove" });
            expect(emptyCatRes.status).toBe(200);
            const emptyCatId = emptyCatRes.body.data._id;

            const dashRes = await request(app)
                .get("/api/v1/course/adminDashboard")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(dashRes.status).toBe(200);
            const cloudRow = dashRes.body.data.categories.find(
                (c) => c._id.toString() === cloudCatId
            );
            const emptyRow = dashRes.body.data.categories.find(
                (c) => c._id.toString() === emptyCatId
            );
            expect(cloudRow.totalCourseCount).toBe(1);
            expect(emptyRow.totalCourseCount).toBe(0);

            const deleteEmptyRes = await request(app)
                .delete("/api/v1/course/deleteCategory")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ categoryId: emptyCatId });
            expect(deleteEmptyRes.status).toBe(200);
            expect(await Category.findById(emptyCatId)).toBeNull();
        });
    });

    describe("9. Database-Backed Cart, Order Security, Replay Protection & Order History (GAP-008 Real MongoDB)", () => {
        test("BE-DB-10: persists cart in MongoDB, merges on login, updates on price changes, and prunes unavailable courses", async () => {
            // Create a fresh student + 2 published courses + 1 draft course for clean cart lifecycle verification
            const cartProfile = await Profile.create({});
            const cartStudent = await User.create({
                firstName: "Cart",
                lastName: "Tester",
                email: "cart.tester@isolated.test",
                password: await require("bcrypt").hash(fixturePassword, 10),
                accountType: "Student",
                image: "https://api.dicebear.com/5.x/initials/svg?seed=Cart%20Tester",
                additionalDetails: cartProfile._id,
            });
            const cartToken = (await loginAs(cartStudent.email)).token;

            const courseA = await Course.create({
                courseName: "Cart Persistence Course A",
                courseDescription: "Paid course A",
                instructor: seeded.users.instructorId,
                whatYouWillLearn: "Cart persistence",
                price: 800,
                tag: ["Cart"],
                category: seeded.categories.webDevId,
                status: "Published",
            });
            const courseB = await Course.create({
                courseName: "Cart Persistence Course B",
                courseDescription: "Paid course B",
                instructor: seeded.users.instructorId,
                whatYouWillLearn: "Cart merge",
                price: 600,
                tag: ["Cart"],
                category: seeded.categories.webDevId,
                status: "Published",
            });
            const draftCourse = await Course.create({
                courseName: "Cart Draft Course",
                courseDescription: "Unpublished",
                instructor: seeded.users.instructorId,
                whatYouWillLearn: "Hidden",
                price: 500,
                tag: ["Draft"],
                category: seeded.categories.webDevId,
                status: "Draft",
            });

            // 1. Add published course A -> persisted in MongoDB
            const addRes = await request(app)
                .post("/api/v1/cart/add")
                .set("Authorization", `Bearer ${cartToken}`)
                .send({ courseId: courseA._id.toString() });
            expect(addRes.status).toBe(200);
            expect(addRes.body.data.total).toBe(800);
            expect(addRes.body.data.totalItems).toBe(1);

            // 2. Duplicate add rejected (409) & Draft add rejected (400)
            const dupAdd = await request(app)
                .post("/api/v1/cart/add")
                .set("Authorization", `Bearer ${cartToken}`)
                .send({ courseId: courseA._id.toString() });
            expect(dupAdd.status).toBe(409);

            const draftAdd = await request(app)
                .post("/api/v1/cart/add")
                .set("Authorization", `Bearer ${cartToken}`)
                .send({ courseId: draftCourse._id.toString() });
            expect(draftAdd.status).toBe(400);

            // 3. Sync/merge anonymous local cart [courseA (dup), courseB (new), draftCourse (invalid)]
            const syncRes = await request(app)
                .post("/api/v1/cart/sync")
                .set("Authorization", `Bearer ${cartToken}`)
                .send({
                    courseIds: [
                        courseA._id.toString(),
                        courseB._id.toString(),
                        draftCourse._id.toString(),
                        "bad-id",
                    ],
                });
            expect(syncRes.status).toBe(200);
            expect(syncRes.body.data.mergedCount).toBe(1);
            expect(syncRes.body.data.totalItems).toBe(2);
            expect(syncRes.body.data.total).toBe(1400);

            // 4. Authoritative price update in MongoDB immediately reflected on GET /cart
            await Course.findByIdAndUpdate(courseA._id, { $set: { price: 1000 } });
            const afterPriceUpdate = await request(app)
                .get("/api/v1/cart")
                .set("Authorization", `Bearer ${cartToken}`);
            expect(afterPriceUpdate.status).toBe(200);
            expect(afterPriceUpdate.body.data.total).toBe(1600);

            // 5. Unpublishing courseB causes GET /cart to self-heal and prune unavailable course
            await Course.findByIdAndUpdate(courseB._id, { $set: { status: "Draft" } });
            const afterUnpublish = await request(app)
                .get("/api/v1/cart")
                .set("Authorization", `Bearer ${cartToken}`);
            expect(afterUnpublish.status).toBe(200);
            expect(afterUnpublish.body.data.totalItems).toBe(1);
            expect(afterUnpublish.body.data.removedUnavailableCount).toBe(1);
            expect(afterUnpublish.body.data.total).toBe(1000);

            // 6. Remove courseA -> cart empty in MongoDB
            const removeRes = await request(app)
                .delete(`/api/v1/cart/remove/${courseA._id.toString()}`)
                .set("Authorization", `Bearer ${cartToken}`);
            expect(removeRes.status).toBe(200);
            expect(removeRes.body.data.totalItems).toBe(0);
            expect(removeRes.body.data.total).toBe(0);
        });

        test("BE-DB-11: enforces Order unique indexes, mixed free+paid checkout, replay protection, interrupted recovery & cross-user isolation", async () => {
            // Verify unique partial indexes exist on Order collection in real MongoDB
            await Order.init();
            const orderIndexes = await Order.collection.indexes();
            const orderIndexNames = orderIndexes.map((idx) => idx.name);
            expect(orderIndexNames).toContain("unique_razorpay_order_id");
            expect(orderIndexNames).toContain("unique_razorpay_payment_id");

            const buyerProfile = await Profile.create({});
            const buyer = await User.create({
                firstName: "Order",
                lastName: "Buyer",
                email: "order.buyer@isolated.test",
                password: await require("bcrypt").hash(fixturePassword, 10),
                accountType: "Student",
                image: "https://api.dicebear.com/5.x/initials/svg?seed=Order%20Buyer",
                additionalDetails: buyerProfile._id,
            });
            const buyerToken = (await loginAs(buyer.email)).token;

            const otherProfile = await Profile.create({});
            const otherStudent = await User.create({
                firstName: "Other",
                lastName: "Student",
                email: "order.other@isolated.test",
                password: await require("bcrypt").hash(fixturePassword, 10),
                accountType: "Student",
                image: "https://api.dicebear.com/5.x/initials/svg?seed=Other%20Student",
                additionalDetails: otherProfile._id,
            });
            const otherToken = (await loginAs(otherStudent.email)).token;

            const freeCourse = await Course.create({
                courseName: "Mixed Cart Free Course",
                courseDescription: "Free component",
                instructor: seeded.users.instructorId,
                whatYouWillLearn: "Free basics",
                price: 0,
                tag: ["Free"],
                category: seeded.categories.webDevId,
                status: "Published",
            });
            const paidCourse = await Course.create({
                courseName: "Mixed Cart Paid Course",
                courseDescription: "Paid component",
                instructor: seeded.users.instructorId,
                whatYouWillLearn: "Paid mastery",
                price: 1250,
                tag: ["Paid"],
                category: seeded.categories.webDevId,
                status: "Published",
            });
            const secondPaidCourse = await Course.create({
                courseName: "Second Paid Course",
                courseDescription: "For replay and recovery tests",
                instructor: seeded.users.instructorId,
                whatYouWillLearn: "Idempotency",
                price: 750,
                tag: ["Paid"],
                category: seeded.categories.devopsId,
                status: "Published",
            });

            // Put mixed Free + Paid courses in buyer's persistent MongoDB cart
            await request(app)
                .post("/api/v1/cart/add")
                .set("Authorization", `Bearer ${buyerToken}`)
                .send({ courseId: freeCourse._id.toString() });
            await request(app)
                .post("/api/v1/cart/add")
                .set("Authorization", `Bearer ${buyerToken}`)
                .send({ courseId: paidCourse._id.toString() });

            // 1. Capture mixed Free + Paid order -> charges ONLY ₹1250 (125000 paise), creates PENDING Order
            const captureRes = await request(app)
                .post("/api/v1/payment/capturePayment")
                .set("Authorization", `Bearer ${buyerToken}`)
                .send({ courses: [freeCourse._id.toString(), paidCourse._id.toString()] });
            expect(captureRes.status).toBe(200);
            expect(captureRes.body.message.amount).toBe(125000);
            const rzpOrderId = captureRes.body.message.id;
            const dbOrderId = captureRes.body.data.orderId;

            const pendingOrder = await Order.findById(dbOrderId).lean();
            expect(pendingOrder.status).toBe("PENDING");
            expect(pendingOrder.amount).toBe(1250);
            expect(pendingOrder.courseSnapshots).toHaveLength(2);

            const makeSig = (oid, pid) =>
                crypto
                    .createHmac("sha256", process.env.RAZORPAY_SECRET)
                    .update(`${oid}|${pid}`)
                    .digest("hex");

            // 2. Reject invalid signature, wrong amount, wrong currency & cross-user verification -> 0 enrollment
            const payId1 = `pay_realdb_mixed_${Date.now()}`;
            const validSig1 = makeSig(rzpOrderId, payId1);

            expect(
                (
                    await request(app)
                        .post("/api/v1/payment/verifyPayment")
                        .set("Authorization", `Bearer ${buyerToken}`)
                        .send({
                            razorpay_order_id: rzpOrderId,
                            razorpay_payment_id: payId1,
                            razorpay_signature: "bad_sig",
                        })
                ).status
            ).toBe(400);

            expect(
                (
                    await request(app)
                        .post("/api/v1/payment/verifyPayment")
                        .set("Authorization", `Bearer ${otherToken}`)
                        .send({
                            razorpay_order_id: rzpOrderId,
                            razorpay_payment_id: payId1,
                            razorpay_signature: validSig1,
                        })
                ).status
            ).toBe(403);

            expect(
                (
                    await request(app)
                        .post("/api/v1/payment/verifyPayment")
                        .set("Authorization", `Bearer ${buyerToken}`)
                        .send({
                            razorpay_order_id: rzpOrderId,
                            razorpay_payment_id: payId1,
                            razorpay_signature: validSig1,
                            amount: 100,
                        })
                ).status
            ).toBe(400);

            // Confirm buyer is STILL NOT enrolled after failed attempts
            const buyerBeforeVerify = await User.findById(buyer._id).lean();
            expect(buyerBeforeVerify.courses).toHaveLength(0);

            // 3. Valid verification -> marks PAID, enrolls in BOTH free & paid courses, removes both from DB cart
            const verifyRes = await request(app)
                .post("/api/v1/payment/verifyPayment")
                .set("Authorization", `Bearer ${buyerToken}`)
                .send({
                    razorpay_order_id: rzpOrderId,
                    razorpay_payment_id: payId1,
                    razorpay_signature: validSig1,
                    amount: 125000,
                    currency: "INR",
                });
            expect(verifyRes.status).toBe(200);
            expect(verifyRes.body.data.order.status).toBe("PAID");
            expect(verifyRes.body.data.order.enrollmentCompleted).toBe(true);

            const buyerAfterVerify = await User.findById(buyer._id).lean();
            expect(buyerAfterVerify.courses.map(String)).toEqual(
                expect.arrayContaining([freeCourse._id.toString(), paidCourse._id.toString()])
            );
            expect(buyerAfterVerify.cart).toHaveLength(0);

            // 4. Repeated verification idempotency -> 200 alreadyProcessed, zero duplicate CourseProgress docs
            const repeatVerifyRes = await request(app)
                .post("/api/v1/payment/verifyPayment")
                .set("Authorization", `Bearer ${buyerToken}`)
                .send({
                    razorpay_order_id: rzpOrderId,
                    razorpay_payment_id: payId1,
                    razorpay_signature: validSig1,
                });
            expect(repeatVerifyRes.status).toBe(200);
            expect(repeatVerifyRes.body.alreadyProcessed).toBe(true);
            const progCount = await CourseProgress.countDocuments({
                userId: buyer._id,
                courseID: paidCourse._id,
            });
            expect(progCount).toBe(1);

            // 5. Duplicate razorpay_payment_id replay on a SECOND order -> rejected with 409!
            const cap2 = await request(app)
                .post("/api/v1/payment/capturePayment")
                .set("Authorization", `Bearer ${buyerToken}`)
                .send({ courses: [secondPaidCourse._id.toString()] });
            expect(cap2.status).toBe(200);
            const rzpOrderId2 = cap2.body.message.id;
            const replaySig = makeSig(rzpOrderId2, payId1);

            const replayRes = await request(app)
                .post("/api/v1/payment/verifyPayment")
                .set("Authorization", `Bearer ${buyerToken}`)
                .send({
                    razorpay_order_id: rzpOrderId2,
                    razorpay_payment_id: payId1,
                    razorpay_signature: replaySig,
                });
            expect(replayRes.status).toBe(409);

            // Mark second order CANCELLED -> does not enroll
            const cancelRes = await request(app)
                .post("/api/v1/payment/markPaymentFailed")
                .set("Authorization", `Bearer ${buyerToken}`)
                .send({
                    razorpay_order_id: rzpOrderId2,
                    status: "CANCELLED",
                    reason: "User closed checkout",
                });
            expect(cancelRes.status).toBe(200);
            expect(cancelRes.body.data.order.status).toBe("CANCELLED");

            // 6. Interrupted request recovery: PAID order with enrollmentCompleted=false completes enrollment safely on retry
            const recoveredOrderId = `order_recover_${Date.now()}`;
            const recoveredPayId = `pay_recover_${Date.now()}`;
            await Order.create({
                user: buyer._id,
                courses: [secondPaidCourse._id],
                courseSnapshots: [
                    {
                        course: secondPaidCourse._id,
                        courseName: secondPaidCourse.courseName,
                        priceAtPurchase: 750,
                    },
                ],
                amount: 750,
                amountInSubunits: 75000,
                currency: "INR",
                receipt: `rcpt_recover_${Date.now()}`,
                razorpayOrderId: recoveredOrderId,
                razorpayPaymentId: recoveredPayId,
                status: "PAID",
                paidAt: new Date(),
                enrollmentCompleted: false,
            });

            const recoverRes = await request(app)
                .post("/api/v1/payment/verifyPayment")
                .set("Authorization", `Bearer ${buyerToken}`)
                .send({
                    razorpay_order_id: recoveredOrderId,
                    razorpay_payment_id: recoveredPayId,
                    razorpay_signature: makeSig(recoveredOrderId, recoveredPayId),
                });
            expect(recoverRes.status).toBe(200);
            expect(recoverRes.body.data.order.enrollmentCompleted).toBe(true);
            const buyerAfterRecovery = await User.findById(buyer._id).lean();
            expect(buyerAfterRecovery.courses.map(String)).toContain(
                secondPaidCourse._id.toString()
            );

            // 7. Order History pagination, snapshot preservation after course rename, and strict cross-user 403
            await Course.findByIdAndUpdate(paidCourse._id, {
                $set: { courseName: "Renamed Later Course", price: 2999 },
            });

            const histRes = await request(app)
                .get("/api/v1/payment/orders?page=1&limit=2")
                .set("Authorization", `Bearer ${buyerToken}`);
            expect(histRes.status).toBe(200);
            expect(histRes.body.data.orders).toHaveLength(2);
            expect(histRes.body.data.pagination.totalOrders).toBe(3);
            expect(histRes.body.data.pagination.totalPages).toBe(2);

            const detailRes = await request(app)
                .get(`/api/v1/payment/orders/${dbOrderId}`)
                .set("Authorization", `Bearer ${buyerToken}`);
            expect(detailRes.status).toBe(200);
            // Historical snapshot retains original title & purchase price despite later course edit!
            expect(
                detailRes.body.data.order.courseSnapshots.some(
                    (s) => s.courseName === "Mixed Cart Paid Course" && s.priceAtPurchase === 1250
                )
            ).toBe(true);

            // Cross-user isolation: otherStudent gets 403 on buyer's order and 0 orders on own history
            const crossDetailRes = await request(app)
                .get(`/api/v1/payment/orders/${dbOrderId}`)
                .set("Authorization", `Bearer ${otherToken}`);
            expect(crossDetailRes.status).toBe(403);

            const otherHistRes = await request(app)
                .get("/api/v1/payment/orders")
                .set("Authorization", `Bearer ${otherToken}`);
            expect(otherHistRes.status).toBe(200);
            expect(otherHistRes.body.data.orders).toHaveLength(0);
        });
    });

    describe("10. Consistent Password Policy Enforcement (GAP-007 Real MongoDB)", () => {
        test("BE-DB-12: enforces 8-char minimum across signup, changePassword, and resetPassword while preserving legacy login and single-use reset tokens", async () => {
            const bcrypt = require("bcrypt");

            // 1. Direct API Signup bypass attempts (Student & Instructor) with 7-char password -> 400
            for (const role of ["Student", "Instructor"]) {
                const email = `policy.${role.toLowerCase()}@isolated.test`;
                const otpRes = await request(app).post("/api/v1/auth/sendotp").send({ email });
                expect(otpRes.status).toBe(200);
                const otpDoc = await OTP.findOne({ email }).sort({ createdAt: -1 }).lean();
                expect(otpDoc?.otp).toHaveLength(6);

                const shortSignup = await request(app).post("/api/v1/auth/signup").send({
                    firstName: "Policy",
                    lastName: role,
                    email,
                    password: "short7!",
                    confirmPassword: "short7!",
                    accountType: role,
                    otp: otpDoc.otp,
                });
                expect(shortSignup.status).toBe(400);
                expect(shortSignup.body.message).toMatch(/at least 8 characters/i);
                expect(await User.findOne({ email })).toBeNull();

                // Exact 8-char password succeeds
                const validSignup = await request(app).post("/api/v1/auth/signup").send({
                    firstName: "Policy",
                    lastName: role,
                    email,
                    password: "Valid8Ch",
                    confirmPassword: "Valid8Ch",
                    accountType: role,
                    otp: otpDoc.otp,
                });
                expect(validSignup.status).toBe(200);
                expect(validSignup.body.success).toBe(true);

                // Login succeeds with newly created 8-char password
                const loginCheck = await request(app)
                    .post("/api/v1/auth/login")
                    .send({ email, password: "Valid8Ch" });
                expect(loginCheck.status).toBe(200);
            }

            // 2. Legacy user with historical 5-char password MUST NOT be locked out of login
            const legacyEmail = "legacy.shortpass@isolated.test";
            const legacyProfile = await Profile.create({});
            await User.create({
                firstName: "Legacy",
                lastName: "Account",
                email: legacyEmail,
                password: await bcrypt.hash("old5!", 10),
                accountType: "Student",
                image: "https://api.dicebear.com/5.x/initials/svg?seed=Legacy%20Account",
                additionalDetails: legacyProfile._id,
            });

            const legacyLogin = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: legacyEmail, password: "old5!" });
            expect(legacyLogin.status).toBe(200);
            const legacyToken = legacyLogin.body.token;

            // Change password rejects 7-char new password (400), wrong old password (401), mismatch (400)
            const shortChange = await request(app)
                .post("/api/v1/auth/changepassword")
                .set("Authorization", `Bearer ${legacyToken}`)
                .send({
                    oldPassword: "old5!",
                    newPassword: "1234567",
                    confirmNewPassword: "1234567",
                });
            expect(shortChange.status).toBe(400);
            expect(shortChange.body.message).toMatch(/at least 8 characters/i);

            const wrongOldChange = await request(app)
                .post("/api/v1/auth/changepassword")
                .set("Authorization", `Bearer ${legacyToken}`)
                .send({
                    oldPassword: "wrong",
                    newPassword: "Upgraded8!",
                    confirmNewPassword: "Upgraded8!",
                });
            expect(wrongOldChange.status).toBe(401);

            const mismatchChange = await request(app)
                .post("/api/v1/auth/changepassword")
                .set("Authorization", `Bearer ${legacyToken}`)
                .send({
                    oldPassword: "old5!",
                    newPassword: "Upgraded8!",
                    confirmNewPassword: "Different8!",
                });
            expect(mismatchChange.status).toBe(400);

            // Legacy user upgrades 5-char password -> 8-char password (200)
            const okChange = await request(app)
                .post("/api/v1/auth/changepassword")
                .set("Authorization", `Bearer ${legacyToken}`)
                .send({
                    oldPassword: "old5!",
                    newPassword: "Upgraded8",
                    confirmNewPassword: "Upgraded8",
                });
            expect(okChange.status).toBe(200);

            // Old password no longer works; new password works
            expect(
                (
                    await request(app)
                        .post("/api/v1/auth/login")
                        .send({ email: legacyEmail, password: "old5!" })
                ).status
            ).toBe(401);
            expect(
                (
                    await request(app)
                        .post("/api/v1/auth/login")
                        .send({ email: legacyEmail, password: "Upgraded8" })
                ).status
            ).toBe(200);

            // 3. Forgot Password -> Reset Password policy, invalid/null/expired token & single-use invalidation
            const tokenReq = await request(app)
                .post("/api/v1/auth/reset-password-token")
                .send({ email: legacyEmail });
            expect(tokenReq.status).toBe(200);

            const userWithToken = await User.findOne({ email: legacyEmail }).lean();
            const realResetToken = userWithToken.token;
            expect(typeof realResetToken).toBe("string");
            expect(realResetToken.length).toBeGreaterThan(10);

            // Reject null/empty token (400), 7-char password (400), mismatch (401), invalid token (401)
            expect(
                (
                    await request(app).post("/api/v1/auth/reset-password").send({
                        password: "ResetValid8",
                        confirmPassword: "ResetValid8",
                        token: null,
                    })
                ).status
            ).toBe(400);

            const shortReset = await request(app).post("/api/v1/auth/reset-password").send({
                password: "short7!",
                confirmPassword: "short7!",
                token: realResetToken,
            });
            expect(shortReset.status).toBe(400);
            expect(shortReset.body.message).toMatch(/at least 8 characters/i);

            expect(
                (
                    await request(app).post("/api/v1/auth/reset-password").send({
                        password: "ResetValid8",
                        confirmPassword: "Mismatch88",
                        token: realResetToken,
                    })
                ).status
            ).toBe(401);

            expect(
                (
                    await request(app).post("/api/v1/auth/reset-password").send({
                        password: "ResetValid8",
                        confirmPassword: "ResetValid8",
                        token: "invalid-token-xyz",
                    })
                ).status
            ).toBe(401);

            // Force expiry -> rejected (401), then restore expiry and complete valid reset (200)
            await User.updateOne(
                { email: legacyEmail },
                { $set: { resetPasswordExpires: new Date(Date.now() - 60_000) } }
            );
            expect(
                (
                    await request(app).post("/api/v1/auth/reset-password").send({
                        password: "ResetValid8",
                        confirmPassword: "ResetValid8",
                        token: realResetToken,
                    })
                ).status
            ).toBe(401);

            await User.updateOne(
                { email: legacyEmail },
                { $set: { resetPasswordExpires: new Date(Date.now() + 300_000) } }
            );
            const okReset = await request(app).post("/api/v1/auth/reset-password").send({
                password: "ResetValid8",
                confirmPassword: "ResetValid8",
                token: realResetToken,
            });
            expect(okReset.status).toBe(200);

            // Single-use check: reusing the same reset token MUST fail (401)
            const reuseReset = await request(app).post("/api/v1/auth/reset-password").send({
                password: "AnotherValid9",
                confirmPassword: "AnotherValid9",
                token: realResetToken,
            });
            expect(reuseReset.status).toBe(401);

            // Subsequent login with the reset password succeeds
            const postResetLogin = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: legacyEmail, password: "ResetValid8" });
            expect(postResetLogin.status).toBe(200);
        });
    });

    describe("11. Instructor Approval Enforcement, Migration & Admin User Management (GAP-002 Real MongoDB)", () => {
        test("BE-DB-13: enforces PENDING signup, blocks restricted instructor APIs, preserves legacy instructors via migration, and unlocks immediately upon Admin approval", async () => {
            const bcrypt = require("bcrypt");
            const mailSender = require("../utils/mailSender");
            const { migrateExistingInstructors } = require("../scripts/migrateInstructorApproval");

            mailSender.clearSentEmails();

            // 1. Public Admin self-signup MUST be blocked (403)
            const evilAdminRes = await request(app).post("/api/v1/auth/signup").send({
                firstName: "Rogue",
                lastName: "Admin",
                email: "rogue.admin@isolated.test",
                password: "ValidPassword1!",
                confirmPassword: "ValidPassword1!",
                accountType: "Admin",
                otp: "123456",
            });
            expect(evilAdminRes.status).toBe(403);
            expect(await User.findOne({ email: "rogue.admin@isolated.test" })).toBeNull();

            // 2. New Instructor OTP + Signup with spoofed approved/approvalStatus -> backend forces PENDING
            const newInstEmail = "gap002.pending.inst@isolated.test";
            const otpReq = await request(app)
                .post("/api/v1/auth/sendotp")
                .send({ email: newInstEmail });
            expect(otpReq.status).toBe(200);
            const otpDoc = await OTP.findOne({ email: newInstEmail }).sort({ createdAt: -1 });

            const signupRes = await request(app).post("/api/v1/auth/signup").send({
                firstName: "Pending",
                lastName: "Educator",
                email: newInstEmail,
                password: "ValidPassword1!",
                confirmPassword: "ValidPassword1!",
                accountType: "Instructor",
                otp: otpDoc.otp,
                approved: true,
                approvalStatus: "APPROVED",
            });
            expect(signupRes.status).toBe(200);
            expect(signupRes.body.user.approvalStatus).toBe("PENDING");
            expect(signupRes.body.user.approved).toBe(false);
            expect(signupRes.body.user.password).toBeUndefined();

            const persistedPending = await User.findOne({ email: newInstEmail }).lean();
            expect(persistedPending.approvalStatus).toBe("PENDING");
            expect(persistedPending.approved).toBe(false);

            // Application received email captured in mock outbox
            const appReceivedEmails = mailSender
                .getSentEmails()
                .filter((m) => m.to === newInstEmail && /Application Received/i.test(m.subject));
            expect(appReceivedEmails.length).toBeGreaterThanOrEqual(1);

            // 3. Pending instructor logs in -> profile accessible, ALL restricted instructor routes blocked (403)
            const pendingLogin = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: newInstEmail, password: "ValidPassword1!" });
            expect(pendingLogin.status).toBe(200);
            expect(pendingLogin.body.user.approvalStatus).toBe("PENDING");
            expect(pendingLogin.body.user.approved).toBe(false);
            const pendingJwt = pendingLogin.body.token;

            // Profile endpoint remains accessible and returns authoritative status without password/token
            const profileRes = await request(app)
                .get("/api/v1/profile/getUserDetails")
                .set("Authorization", `Bearer ${pendingJwt}`);
            expect(profileRes.status).toBe(200);
            expect(profileRes.body.userDetails.approvalStatus).toBe("PENDING");
            expect(profileRes.body.userDetails.password).toBeUndefined();
            expect(profileRes.body.userDetails.token).toBeUndefined();

            // Restricted endpoints all reject with 403
            expect(
                (
                    await request(app)
                        .post("/api/v1/course/createCourse")
                        .set("Authorization", `Bearer ${pendingJwt}`)
                        .send({
                            courseName: "Blocked Pending Course",
                            courseDescription: "Should fail",
                            whatYouWillLearn: "Nothing",
                            price: 100,
                            approved: true,
                            approvalStatus: "APPROVED",
                        })
                ).status
            ).toBe(403);
            expect(
                (
                    await request(app)
                        .post("/api/v1/course/editCourse")
                        .set("Authorization", `Bearer ${pendingJwt}`)
                        .send({ courseId: seeded.courses.enrolledCourseId, status: "Published" })
                ).status
            ).toBe(403);
            expect(
                (
                    await request(app)
                        .delete("/api/v1/course/deleteCourse")
                        .set("Authorization", `Bearer ${pendingJwt}`)
                        .send({ courseId: seeded.courses.enrolledCourseId })
                ).status
            ).toBe(403);
            expect(
                (
                    await request(app)
                        .get("/api/v1/course/getInstructorCourses")
                        .set("Authorization", `Bearer ${pendingJwt}`)
                ).status
            ).toBe(403);
            expect(
                (
                    await request(app)
                        .post("/api/v1/course/addSection")
                        .set("Authorization", `Bearer ${pendingJwt}`)
                        .send({ sectionName: "Blocked", courseId: seeded.courses.enrolledCourseId })
                ).status
            ).toBe(403);
            expect(
                (
                    await request(app)
                        .post("/api/v1/course/addSubSection")
                        .set("Authorization", `Bearer ${pendingJwt}`)
                        .send({ sectionId: seeded.courses.enrolledFirstSectionId, title: "Blocked" })
                ).status
            ).toBe(403);
            expect(
                (
                    await request(app)
                        .get("/api/v1/profile/instructorDashboard")
                        .set("Authorization", `Bearer ${pendingJwt}`)
                ).status
            ).toBe(403);
            expect(
                (
                    await request(app)
                        .post("/api/v1/course/getFullCourseDetails")
                        .set("Authorization", `Bearer ${pendingJwt}`)
                        .send({ courseId: seeded.courses.enrolledCourseId })
                ).status
            ).toBe(403);

            // 4. Backward-compatible legacy instructor (raw DB doc without approvalStatus) + idempotent migration
            const legacyProf = await Profile.create({});
            const legacyHash = await bcrypt.hash("LegacyInst8!", 10);
            const rawLegacyInsert = await User.collection.insertOne({
                firstName: "Legacy",
                lastName: "Mentor",
                email: "legacy.mentor@isolated.test",
                password: legacyHash,
                accountType: "Instructor",
                additionalDetails: legacyProf._id,
                image: "https://api.dicebear.com/5.x/initials/svg?seed=Legacy%20Mentor",
                courses: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            const legacyLogin = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: "legacy.mentor@isolated.test", password: "LegacyInst8!" });
            expect(legacyLogin.status).toBe(200);
            expect(legacyLogin.body.user.approvalStatus).toBe("APPROVED");

            // Legacy instructor can access dashboard BEFORE migration
            const preMigDash = await request(app)
                .get("/api/v1/profile/instructorDashboard")
                .set("Authorization", `Bearer ${legacyLogin.body.token}`);
            expect(preMigDash.status).toBe(200);

            // Run idempotent migration -> backfills legacy doc to APPROVED without touching PENDING
            const migSummary = await migrateExistingInstructors();
            expect(migSummary.approvedBackfilled).toBeGreaterThanOrEqual(1);
            const migratedLegacy = await User.findById(rawLegacyInsert.insertedId).lean();
            expect(migratedLegacy.approvalStatus).toBe("APPROVED");
            expect(migratedLegacy.approved).toBe(true);
            const stillPending = await User.findById(persistedPending._id).lean();
            expect(stillPending.approvalStatus).toBe("PENDING");

            // 5. Admin approves the pending instructor -> immediate unlock using the EXACT SAME JWT
            const approveRes = await request(app)
                .put(`/api/v1/admin/instructors/${persistedPending._id}/approve`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ accountType: "Admin" }); // Role mutation ignored
            expect(approveRes.status).toBe(200);
            expect(approveRes.body.data.approvalStatus).toBe("APPROVED");
            expect(approveRes.body.data.accountType).toBe("Instructor");

            // Duplicate approval returns 409
            const dupApprove = await request(app)
                .put(`/api/v1/admin/instructors/${persistedPending._id}/approve`)
                .set("Authorization", `Bearer ${adminToken}`);
            expect(dupApprove.status).toBe(409);

            // Approval email captured
            const approvedEmails = mailSender
                .getSentEmails()
                .filter((m) => m.to === newInstEmail && /Approved/i.test(m.subject));
            expect(approvedEmails.length).toBeGreaterThanOrEqual(1);

            // Newly approved instructor immediately creates & publishes a course with existing JWT
            const createCourseRes = await request(app)
                .post("/api/v1/course/createCourse")
                .set("Authorization", `Bearer ${pendingJwt}`)
                .send({
                    courseName: "Post-Approval Course",
                    courseDescription: "Created right after admin approval",
                    whatYouWillLearn: "End-to-end approval flow",
                    price: 499,
                    category: seeded.categories.webDevId,
                    status: "Published",
                });
            expect(createCourseRes.status).toBe(200);
            const postApprovalDash = await request(app)
                .get("/api/v1/profile/instructorDashboard")
                .set("Authorization", `Bearer ${pendingJwt}`);
            expect(postApprovalDash.status).toBe(200);
            expect(postApprovalDash.body.courses.length).toBe(1);
        });

        test("BE-DB-14: verifies Admin User Management stats, search, pagination, rejection lifecycle, security isolation, and student access preservation", async () => {
            const jwt = require("jsonwebtoken");
            const mailSender = require("../utils/mailSender");
            mailSender.clearSentEmails();

            const expiredAdminJwt = jwt.sign(
                { id: seeded.users.adminId, email: seeded.users.adminEmail, accountType: "Admin" },
                process.env.JWT_SECRET,
                { expiresIn: "-5s" }
            );

            // 1. Security checks on all /api/v1/admin/* endpoints
            const endpoints = [
                { method: "get", path: "/api/v1/admin/users/stats" },
                { method: "get", path: "/api/v1/admin/users" },
                { method: "get", path: `/api/v1/admin/users/${seeded.users.pendingInstructorId}` },
                { method: "get", path: "/api/v1/admin/instructors" },
                { method: "put", path: `/api/v1/admin/instructors/${seeded.users.pendingInstructorId}/approve` },
                { method: "put", path: `/api/v1/admin/instructors/${seeded.users.pendingInstructorId}/reject` },
            ];
            for (const ep of endpoints) {
                expect((await request(app)[ep.method](ep.path)).status).toBe(401);
                expect(
                    (
                        await request(app)
                            [ep.method](ep.path)
                            .set("Authorization", `Bearer ${expiredAdminJwt}`)
                    ).status
                ).toBe(401);
                expect(
                    (
                        await request(app)
                            [ep.method](ep.path)
                            .set("Authorization", `Bearer ${studentToken}`)
                    ).status
                ).toBe(403);
                expect(
                    (
                        await request(app)
                            [ep.method](ep.path)
                            .set("Authorization", `Bearer ${instructorToken}`)
                    ).status
                ).toBe(403);
            }

            // 2. Admin fetches stats, searches, filters, and paginates users (no sensitive data leaked)
            const statsRes = await request(app)
                .get("/api/v1/admin/users/stats")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(statsRes.status).toBe(200);
            expect(statsRes.body.data.totalUsers).toBeGreaterThanOrEqual(5);
            expect(statsRes.body.data.pendingInstructors).toBeGreaterThanOrEqual(1);
            expect(statsRes.body.data.approvedInstructors).toBeGreaterThanOrEqual(1);
            expect(statsRes.body.data.totalAdmins).toBeGreaterThanOrEqual(1);

            const searchPending = await request(app)
                .get("/api/v1/admin/users")
                .set("Authorization", `Bearer ${adminToken}`)
                .query({ search: "PendingInstructor", approvalStatus: "PENDING", page: "1", limit: "2" });
            expect(searchPending.status).toBe(200);
            expect(searchPending.body.data.users.length).toBe(1);
            expect(searchPending.body.data.users[0].email).toBe(seeded.users.pendingInstructorEmail);
            expect(searchPending.body.data.users[0].password).toBeUndefined();
            expect(searchPending.body.data.users[0].token).toBeUndefined();

            const detailsRes = await request(app)
                .get(`/api/v1/admin/users/${seeded.users.pendingInstructorId}`)
                .set("Authorization", `Bearer ${adminToken}`);
            expect(detailsRes.status).toBe(200);
            expect(detailsRes.body.data.email).toBe(seeded.users.pendingInstructorEmail);
            expect(detailsRes.body.data.password).toBeUndefined();

            // 3. Reject seeded pending instructor with reason -> email sent, stats updated, API access blocked
            const rejectRes = await request(app)
                .put(`/api/v1/admin/instructors/${seeded.users.pendingInstructorId}/reject`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ reason: "Please add verified teaching credentials" });
            expect(rejectRes.status).toBe(200);
            expect(rejectRes.body.data.approvalStatus).toBe("REJECTED");
            expect(rejectRes.body.data.rejectionReason).toBe("Please add verified teaching credentials");

            const rejectEmails = mailSender
                .getSentEmails()
                .filter(
                    (m) =>
                        m.to === seeded.users.pendingInstructorEmail &&
                        /Application Update/i.test(m.subject)
                );
            expect(rejectEmails.length).toBeGreaterThanOrEqual(1);
            expect(rejectEmails[0].html).toContain("Please add verified teaching credentials");

            // Duplicate reject (409), rejecting already-approved instructor (409), self-reject (403), student target (400)
            expect(
                (
                    await request(app)
                        .put(`/api/v1/admin/instructors/${seeded.users.pendingInstructorId}/reject`)
                        .set("Authorization", `Bearer ${adminToken}`)
                ).status
            ).toBe(409);
            expect(
                (
                    await request(app)
                        .put(`/api/v1/admin/instructors/${seeded.users.instructorId}/reject`)
                        .set("Authorization", `Bearer ${adminToken}`)
                ).status
            ).toBe(409);
            expect(
                (
                    await request(app)
                        .put(`/api/v1/admin/instructors/${seeded.users.adminId}/reject`)
                        .set("Authorization", `Bearer ${adminToken}`)
                ).status
            ).toBe(403);
            expect(
                (
                    await request(app)
                        .put(`/api/v1/admin/instructors/${seeded.users.studentId}/approve`)
                        .set("Authorization", `Bearer ${adminToken}`)
                ).status
            ).toBe(400);

            // Rejected instructor login shows REJECTED status and is blocked from restricted APIs
            const rejLogin = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: seeded.users.pendingInstructorEmail, password: fixturePassword });
            expect(rejLogin.status).toBe(200);
            expect(rejLogin.body.user.approvalStatus).toBe("REJECTED");
            expect(
                (
                    await request(app)
                        .post("/api/v1/course/createCourse")
                        .set("Authorization", `Bearer ${rejLogin.body.token}`)
                        .send({
                            courseName: "Rejected Attempt",
                            courseDescription: "Blocked",
                            whatYouWillLearn: "None",
                            price: 0,
                        })
                ).status
            ).toBe(403);

            // 4. Enrolled student access to purchased course remains 100% intact
            const studentFullCourse = await request(app)
                .post("/api/v1/course/getFullCourseDetails")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ courseId: seeded.courses.enrolledCourseId });
            expect(studentFullCourse.status).toBe(200);
            expect(studentFullCourse.body.success).toBe(true);
        });
    });
});
