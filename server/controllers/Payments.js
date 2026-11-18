const mongoose = require("mongoose");
const { instance } = require("../config/razorpay");
const Course = require("../models/Course");
const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const { courseEnrollmentEmail } = require("../mail/templates/courseEnrollmentEmail");
const crypto = require("crypto");
const { paymentSuccessEmail } = require("../mail/templates/paymentSuccessEmail");
const CourseProgress = require("../models/CourseProgress");
const cache = require("../utils/cache");

// ============================================================
// CAPTURE PAYMENT - validates paid courses and creates a Razorpay order
// ============================================================
exports.capturePayment = async (req, res) => {
    const { courses } = req.body;
    const userId = req.user.id;

    if (!courses || !Array.isArray(courses) || courses.length === 0) {
        return res.status(400).json({ success: false, message: "Please provide at least one course ID" });
    }

    let totalAmount = 0;

    const coursesDocs = await Course.find({ _id: { $in: courses } });
    const courseMap = new Map(coursesDocs.map((course) => [course._id.toString(), course]));

    for (const courseId of courses) {
        const course = courseMap.get(courseId.toString());
        if (!course) {
            return res.status(404).json({ success: false, message: `Course not found: ${courseId}` });
        }
        if (course.studentEnrolled?.some((id) => id.toString() === userId)) {
            return res.status(400).json({ success: false, message: "You are already enrolled in one of these courses" });
        }
        if (typeof course.price !== "number" || !Number.isFinite(course.price) || course.price < 0) {
            return res.status(400).json({ success: false, message: `Invalid pricing for course: ${courseId}` });
        }
        totalAmount += course.price;
    }

    if (totalAmount === 0) {
        return res.status(400).json({
            success: false,
            message: "Free courses do not require payment. Use free enrollment instead.",
        });
    }

    const options = {
        amount: totalAmount * 100,
        currency: "INR",
        receipt: Date.now().toString(),
    };

    try {
        const paymentResponse = await instance.orders.create(options);
        return res.status(200).json({ success: true, message: paymentResponse });
    } catch (error) {
        console.error("Razorpay order creation error:", error);
        return res.status(500).json({ success: false, message: "Could not initiate order" });
    }
};

// ============================================================
// ENROLL FREE COURSE - directly enrolls an authenticated student in ₹0 course(s)
// without Razorpay checkout, strictly verifying DB pricing & course status
// ============================================================
exports.enrollFreeCourse = async (req, res) => {
    try {
        // Always derive student identity from verified JWT, never from req.body
        const userId = req.user.id;
        const { courseId, courses } = req.body || {};

        const rawCourses = Array.isArray(courses)
            ? courses
            : courseId
            ? [courseId]
            : [];

        const normalizedCourseIds = [
            ...new Set(
                rawCourses
                    .filter((id) => typeof id === "string" || typeof id === "number")
                    .map((id) => String(id).trim())
                    .filter(Boolean)
            ),
        ];

        if (normalizedCourseIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide at least one valid course ID",
            });
        }

        // Validate ObjectId format before querying MongoDB
        for (const id of normalizedCourseIds) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid course ID: ${id}`,
                });
            }
        }

        // Fetch authoritative course documents from MongoDB (never trust client price)
        const courseDocs = await Course.find({ _id: { $in: normalizedCourseIds } });
        const courseMap = new Map(courseDocs.map((doc) => [doc._id.toString(), doc]));

        for (const id of normalizedCourseIds) {
            const course = courseMap.get(id);
            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: `Course not found: ${id}`,
                });
            }

            if (course.status && course.status !== "Published") {
                return res.status(400).json({
                    success: false,
                    message: "This course is not currently available for enrollment",
                });
            }

            if (typeof course.price !== "number" || !Number.isFinite(course.price) || course.price < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid course pricing",
                });
            }

            if (course.price !== 0) {
                return res.status(400).json({
                    success: false,
                    message: "This course is not free. Please complete payment to enroll.",
                });
            }

            if (course.studentEnrolled?.some((enrolledId) => enrolledId.toString() === userId)) {
                return res.status(409).json({
                    success: false,
                    message: "You are already enrolled in this course",
                });
            }
        }

        // Reuse the standard enrollment & progress initialization pipeline
        await enrollStudents(normalizedCourseIds, userId);

        return res.status(200).json({
            success: true,
            message: "Successfully enrolled in free course",
            data: {
                enrolledCourses: normalizedCourseIds,
            },
        });
    } catch (error) {
        console.error("enrollFreeCourse error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Could not complete free course enrollment",
        });
    }
};

// ============================================================
// VERIFY PAYMENT - validates Razorpay signature then enrolls students
// ============================================================
exports.verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courses } = req.body;
    const userId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !courses || !userId) {
        return res.status(400).json({ success: false, message: "Payment verification failed: missing fields" });
    }

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

    if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: "Payment verification failed: invalid signature" });
    }

    try {
        await enrollStudents(courses, userId);
        return res.status(200).json({ success: true, message: "Payment verified" });
    } catch (error) {
        console.error("verifyPayment enrollment failed:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const enrollStudents = async (courses, userId) => {
    if (!courses || !userId) {
        throw new Error("Courses and userId are required for enrollment");
    }

    // Check existing progress records first to prevent duplicate CourseProgress documents
    const existingProgress = await CourseProgress.find({ courseID: { $in: courses }, userId });
    const existingCourseIds = new Set(
        (existingProgress || [])
            .map((doc) => doc?.courseID?.toString())
            .filter(Boolean)
    );
    const coursesNeedingProgress = courses.filter(
        (courseId) => !existingCourseIds.has(courseId.toString())
    );

    await Promise.all([
        Course.updateMany(
            { _id: { $in: courses } },
            { $addToSet: { studentEnrolled: userId } },
        ),
        ...coursesNeedingProgress.map((courseId) =>
            CourseProgress.create({ courseID: courseId, userId, completedVideos: [] }),
        ),
    ]);

    const progressDocs = await CourseProgress.find({ courseID: { $in: courses }, userId });

    await User.findByIdAndUpdate(
        userId,
        {
            $addToSet: {
                courses: { $each: courses },
                courseProgress: { $each: progressDocs.map((doc) => doc._id) },
            },
        },
    );

    // Invalidate course caches so studentEnrolled reflects immediately on CourseDetails
    cache.del("getAllCourses");
    for (const courseId of courses) {
        cache.del(`getCourseDetails:${courseId}`);
    }

    const student = await User.findById(userId);
    const courseDocs = await Course.find({ _id: { $in: courses } }, { courseName: 1 });

    await Promise.allSettled(
        courseDocs.map((courseDoc) =>
            mailSender(
                student.email,
                `Successfully Enrolled into ${courseDoc.courseName}`,
                courseEnrollmentEmail(courseDoc.courseName, student.firstName),
            ),
        ),
    );
};

// ============================================================
// SEND PAYMENT SUCCESS EMAIL
// ============================================================
exports.sendPaymentSuccessEmail = async (req, res) => {
    const { orderId, paymentId, amount } = req.body;
    const userId = req.user.id;

    if (!orderId || !paymentId || !amount || !userId) {
        return res.status(400).json({ success: false, message: "Please provide all required fields" });
    }

    try {
        const student = await User.findById(userId);
        if (!student) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        await mailSender(
            student.email,
            "Payment Received - StudyNotion",
            paymentSuccessEmail(`${student.firstName} ${student.lastName}`, amount / 100, orderId, paymentId),
        );

        return res.status(200).json({ success: true, message: "Payment success email sent" });
    } catch (error) {
        console.error("sendPaymentSuccessEmail error:", error);
        return res.status(500).json({ success: false, message: "Could not send email" });
    }
};
