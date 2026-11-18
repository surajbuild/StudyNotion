const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { assertSafeForDestructiveOp, isTestMode } = require("../config/testSafety");
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
const cache = require("../utils/cache");

// Synthetic, non-production test fixture identifiers (never real user accounts).
// Passwords are only generated/read at runtime and never logged.
const TEST_FIXTURES = {
    student: {
        firstName: "QA",
        lastName: "Student",
        email: "qa.student@isolated.test",
        accountType: "Student",
        contactNumber: "9000000001",
    },
    instructor: {
        firstName: "QA",
        lastName: "Instructor",
        email: "qa.instructor@isolated.test",
        accountType: "Instructor",
        contactNumber: "9000000002",
        approvalStatus: "APPROVED",
        approved: true,
    },
    admin: {
        firstName: "QA",
        lastName: "Admin",
        email: "qa.admin@isolated.test",
        accountType: "Admin",
        contactNumber: "9000000003",
    },
    disposableStudent: {
        firstName: "QA",
        lastName: "Disposable",
        email: "qa.disposable@isolated.test",
        accountType: "Student",
        contactNumber: "9000000004",
    },
    pendingInstructor: {
        firstName: "QA",
        lastName: "PendingInstructor",
        email: "qa.pending.instructor@isolated.test",
        accountType: "Instructor",
        contactNumber: "9000000005",
        approvalStatus: "PENDING",
        approved: false,
    },
};

const getTestFixturePassword = () =>
    process.env.TEST_FIXTURE_PASSWORD || "TestPass@1234";

const ALL_MODELS = [
    User,
    Profile,
    Category,
    Course,
    Section,
    SubSection,
    CourseProgress,
    RatingAndReview,
    OTP,
    Order,
];

/**
 * Ensures all required test collections and indexes exist on the isolated database.
 */
const initializeTestCollections = async () => {
    assertSafeForDestructiveOp(mongoose.connection, process.env);
    await Promise.all(ALL_MODELS.map((Model) => Model.createCollection().catch(() => {})));
    await Promise.all(ALL_MODELS.map((Model) => Model.init().catch(() => {})));
};

/**
 * Safely wipes every collection in the verified isolated test database.
 * Hard-fails if the active connection is not an isolated test DB.
 */
const clearTestDatabase = async () => {
    assertSafeForDestructiveOp(mongoose.connection, process.env);
    await Promise.all(ALL_MODELS.map((Model) => Model.deleteMany({})));
    cache.clear();
};

/**
 * Drops the verified isolated test database and closes the Mongoose connection.
 */
const teardownTestDatabase = async ({ dropDb = true } = {}) => {
    if (mongoose.connection.readyState === 0) return;
    if (dropDb) {
        assertSafeForDestructiveOp(mongoose.connection, process.env);
        await mongoose.connection.dropDatabase();
    }
    cache.clear();
    await mongoose.disconnect();
};

/**
 * Repeatable seeding of isolated synthetic users, categories, published courses,
 * sections, subsections, enrollment, progress, and initial review data.
 */
const seedTestDatabase = async ({ assetBaseUrl } = {}) => {
    if (!isTestMode()) {
        throw new Error("seedTestDatabase requires explicit test mode.");
    }
    assertSafeForDestructiveOp(mongoose.connection, process.env);

    await initializeTestCollections();
    await clearTestDatabase();

    const baseAssetOrigin = assetBaseUrl || `http://localhost:${process.env.PORT || 4001}`;
    const sampleThumbUrl = `${baseAssetOrigin}/api/v1/__test__/assets/sample-thumb.svg`;
    const sampleVideoUrl = `${baseAssetOrigin}/api/v1/__test__/assets/sample-video.mp4`;

    const hashedPassword = await bcrypt.hash(getTestFixturePassword(), 10);

    const createAccount = async (spec, profileOverrides = {}) => {
        const profile = await Profile.create({
            gender: profileOverrides.gender || "Other",
            dateOfBirth: profileOverrides.dateOfBirth || "1998-05-15",
            about: profileOverrides.about || `Synthetic ${spec.accountType} test profile`,
            contactNumber: spec.contactNumber,
        });
        const userData = {
            firstName: spec.firstName,
            lastName: spec.lastName,
            email: spec.email,
            password: hashedPassword,
            accountType: spec.accountType,
            contactNumber: spec.contactNumber,
            additionalDetails: profile._id,
            image: `https://api.dicebear.com/5.x/initials/svg?seed=${spec.firstName}%20${spec.lastName}`,
        };
        // Only set approvalStatus/approved if defined in fixture (Instructors)
        if (spec.approvalStatus !== undefined) {
            userData.approvalStatus = spec.approvalStatus;
        }
        if (spec.approved !== undefined) {
            userData.approved = spec.approved;
        }
        const user = await User.create(userData);
        return { user, profile };
    };

    const { user: student } = await createAccount(TEST_FIXTURES.student);
    const { user: instructor } = await createAccount(TEST_FIXTURES.instructor);
    const { user: admin } = await createAccount(TEST_FIXTURES.admin);
    const { user: disposableStudent } = await createAccount(TEST_FIXTURES.disposableStudent);
    const { user: pendingInstructor } = await createAccount(TEST_FIXTURES.pendingInstructor);

    // Seed Categories
    const [webDevCat, dataScienceCat, devopsCat] = await Category.create([
        { name: "Web Dev", description: "Full-stack web engineering courses (test)" },
        { name: "Data Science", description: "Data analysis and ML courses (test)" },
        { name: "Devops", description: "Cloud and DevOps automation courses (test)" },
    ]);

    // Course 1: Pre-enrolled course for QA Student (for E2E-18 ViewCourse + Progress + Review)
    const sub1 = await SubSection.create({
        title: "Lesson 1: Architecture Overview",
        timeDuration: "120",
        description: "Introduction to isolated MERN testing architecture.",
        videoUrl: sampleVideoUrl,
    });
    const sub2 = await SubSection.create({
        title: "Lesson 2: Building Resilient APIs",
        timeDuration: "180",
        description: "Hands-on Express API testing with Supertest.",
        videoUrl: sampleVideoUrl,
    });
    const section1 = await Section.create({
        sectionName: "Module 1: Foundations",
        subSection: [sub1._id],
    });
    const section2 = await Section.create({
        sectionName: "Module 2: Deep Dive",
        subSection: [sub2._id],
    });

    const enrolledCourse = await Course.create({
        courseName: "Isolated MERN Mastery",
        courseDescription: "Pre-enrolled test course for verifying video player, progress, and reviews.",
        instructor: instructor._id,
        whatYouWillLearn: "Build and test full-stack MERN applications safely.",
        courseContent: [section1._id, section2._id],
        price: 1499,
        thumbnail: sampleThumbUrl,
        tag: ["MERN", "Web Dev"],
        category: webDevCat._id,
        studentEnrolled: [student._id],
        instructions: ["Basic JavaScript knowledge", "Node.js installed"],
        status: "Published",
    });

    // Course 2: Purchasable un-enrolled course (for E2E-17 Cart -> Razorpay -> Enrollment)
    const sub3 = await SubSection.create({
        title: "Lesson 1: Containers Fundamentals",
        timeDuration: "150",
        description: "Running isolated databases in containers.",
        videoUrl: sampleVideoUrl,
    });
    const section3 = await Section.create({
        sectionName: "Module 1: Container Basics",
        subSection: [sub3._id],
    });

    const purchasableCourse = await Course.create({
        courseName: "Isolated DevOps Bootcamp",
        courseDescription: "Unenrolled published course used to test cart checkout and Razorpay verification.",
        instructor: instructor._id,
        whatYouWillLearn: "Master CI/CD pipelines and isolated environments.",
        courseContent: [section3._id],
        price: 999,
        thumbnail: sampleThumbUrl,
        tag: ["DevOps", "Docker"],
        category: devopsCat._id,
        studentEnrolled: [],
        instructions: ["Linux CLI basics"],
        status: "Published",
    });

    // Course 3: Published course in Data Science so all 3 categories have data
    const sub4 = await SubSection.create({
        title: "Lesson 1: Python DataFrames",
        timeDuration: "120",
        description: "Data cleaning fundamentals.",
        videoUrl: sampleVideoUrl,
    });
    const section4 = await Section.create({
        sectionName: "Module 1: Data Cleaning",
        subSection: [sub4._id],
    });
    const dataScienceCourse = await Course.create({
        courseName: "Isolated Data Science Essentials",
        courseDescription: "Published Data Science course in isolated test catalog.",
        instructor: instructor._id,
        whatYouWillLearn: "Analyze datasets reproducibly.",
        courseContent: [section4._id],
        price: 1299,
        thumbnail: sampleThumbUrl,
        tag: ["Data Science", "Python"],
        category: dataScienceCat._id,
        studentEnrolled: [],
        instructions: ["Python fundamentals"],
        status: "Published",
    });

    // Course 4: Published Free (₹0) course (for GAP-005 free enrollment integration & E2E tests)
    const subFree = await SubSection.create({
        title: "Lesson 1: Free JS Primer",
        timeDuration: "120",
        description: "Core JavaScript concepts in a free introductory course.",
        videoUrl: sampleVideoUrl,
    });
    const sectionFree = await Section.create({
        sectionName: "Module 1: Free Fundamentals",
        subSection: [subFree._id],
    });
    const freeCourse = await Course.create({
        courseName: "Isolated Free JavaScript Primer",
        courseDescription: "Published free (₹0) course for testing direct enrollment without Razorpay.",
        instructor: instructor._id,
        whatYouWillLearn: "Learn JavaScript fundamentals at zero cost.",
        courseContent: [sectionFree._id],
        price: 0,
        thumbnail: sampleThumbUrl,
        tag: ["JavaScript", "Free"],
        category: webDevCat._id,
        studentEnrolled: [],
        instructions: ["No prior coding required"],
        status: "Published",
    });

    // Link categories to courses
    await Category.findByIdAndUpdate(webDevCat._id, {
        $push: { courses: { $each: [enrolledCourse._id, freeCourse._id] } },
    });
    await Category.findByIdAndUpdate(devopsCat._id, { $push: { courses: purchasableCourse._id } });
    await Category.findByIdAndUpdate(dataScienceCat._id, { $push: { courses: dataScienceCourse._id } });

    // Create CourseProgress for enrolled student
    const progress = await CourseProgress.create({
        courseID: enrolledCourse._id,
        userId: student._id,
        completedVideos: [],
    });

    // Link courses to instructor & enrolled student
    await User.findByIdAndUpdate(instructor._id, {
        $push: {
            courses: {
                $each: [enrolledCourse._id, purchasableCourse._id, dataScienceCourse._id, freeCourse._id],
            },
        },
    });
    await User.findByIdAndUpdate(student._id, {
        $push: { courses: enrolledCourse._id, courseProgress: progress._id },
    });

    cache.clear();

    return {
        users: {
            studentId: student._id.toString(),
            studentEmail: student.email,
            instructorId: instructor._id.toString(),
            instructorEmail: instructor.email,
            adminId: admin._id.toString(),
            adminEmail: admin.email,
            disposableStudentId: disposableStudent._id.toString(),
            disposableStudentEmail: disposableStudent.email,
            pendingInstructorId: pendingInstructor._id.toString(),
            pendingInstructorEmail: pendingInstructor.email,
        },
        categories: {
            webDevId: webDevCat._id.toString(),
            dataScienceId: dataScienceCat._id.toString(),
            devopsId: devopsCat._id.toString(),
        },
        courses: {
            enrolledCourseId: enrolledCourse._id.toString(),
            enrolledCourseName: enrolledCourse.courseName,
            enrolledFirstSectionId: section1._id.toString(),
            enrolledFirstSubSectionId: sub1._id.toString(),
            enrolledSecondSectionId: section2._id.toString(),
            enrolledSecondSubSectionId: sub2._id.toString(),
            purchasableCourseId: purchasableCourse._id.toString(),
            purchasableCourseName: purchasableCourse.courseName,
            dataScienceCourseId: dataScienceCourse._id.toString(),
            freeCourseId: freeCourse._id.toString(),
            freeCourseName: freeCourse.courseName,
            freeCourseSectionId: sectionFree._id.toString(),
            freeCourseSubSectionId: subFree._id.toString(),
        },
    };
};

module.exports = {
    TEST_FIXTURES,
    getTestFixturePassword,
    initializeTestCollections,
    clearTestDatabase,
    teardownTestDatabase,
    seedTestDatabase,
};
