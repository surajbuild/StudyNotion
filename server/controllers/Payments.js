const mongoose = require("mongoose");
const crypto = require("crypto");
const { instance } = require("../config/razorpay");
const Course = require("../models/Course");
const User = require("../models/User");
const Order = require("../models/Order");
const mailSender = require("../utils/mailSender");
const { courseEnrollmentEmail } = require("../mail/templates/courseEnrollmentEmail");
const { paymentSuccessEmail } = require("../mail/templates/paymentSuccessEmail");
const CourseProgress = require("../models/CourseProgress");
const cache = require("../utils/cache");

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
const ALLOWED_ORDER_STATUSES = new Set(["PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"]);

const isValidObjectId = (id) =>
    typeof id === "string" && OBJECT_ID_REGEX.test(id) && mongoose.Types.ObjectId.isValid(id);

const verifySignatureTimingSafe = (orderId, paymentId, providedSignature) => {
    if (
        typeof orderId !== "string" ||
        typeof paymentId !== "string" ||
        typeof providedSignature !== "string" ||
        !process.env.RAZORPAY_SECRET
    ) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    const providedBuf = Buffer.from(providedSignature, "utf8");

    if (expectedBuf.length !== providedBuf.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuf, providedBuf);
};

const buildCourseSnapshots = async (courseDocs) => {
    const instructorIds = [
        ...new Set(
            courseDocs
                .map((c) => (c?.instructor?._id || c?.instructor)?.toString())
                .filter((id) => id && isValidObjectId(id))
        ),
    ];

    const instructorNameMap = new Map();
    if (instructorIds.length > 0 && typeof User.find === "function") {
        try {
            const instructors = await User.find(
                { _id: { $in: instructorIds } },
                { firstName: 1, lastName: 1 }
            );
            if (Array.isArray(instructors)) {
                instructors.forEach((inst) => {
                    const fullName = `${inst.firstName || ""} ${inst.lastName || ""}`.trim();
                    instructorNameMap.set(inst._id.toString(), fullName);
                });
            }
        } catch {
            // Non-critical: snapshot still preserves course details even if instructor lookup fails
        }
    }

    return courseDocs.map((course) => {
        const instId = (course?.instructor?._id || course?.instructor)?.toString() || "";
        const inlineName =
            course?.instructor && typeof course.instructor === "object"
                ? `${course.instructor.firstName || ""} ${course.instructor.lastName || ""}`.trim()
                : "";
        return {
            course: course._id,
            courseName: course.courseName || "Course",
            thumbnail: course.thumbnail || "",
            priceAtPurchase: Number(course.price || 0),
            instructorName: inlineName || instructorNameMap.get(instId) || "",
        };
    });
};

// ============================================================
// CAPTURE PAYMENT - validates courses, computes authoritative server amount,
// initiates Razorpay order, and persists a PENDING Order record
// ============================================================
exports.capturePayment = async (req, res) => {
    const { courses } = req.body || {};
    const userId = req.user.id;

    if (!courses || !Array.isArray(courses) || courses.length === 0) {
        return res
            .status(400)
            .json({ success: false, message: "Please provide at least one course ID" });
    }

    const uniqueCourseIds = [
        ...new Set(
            courses
                .filter((id) => typeof id === "string" || typeof id === "number")
                .map((id) => String(id).trim())
                .filter(Boolean)
        ),
    ];

    if (uniqueCourseIds.length === 0) {
        return res
            .status(400)
            .json({ success: false, message: "Please provide at least one course ID" });
    }

    let coursesDocs;
    try {
        coursesDocs = await Course.find({ _id: { $in: uniqueCourseIds } });
    } catch (err) {
        if (err?.name === "CastError") {
            return res.status(400).json({ success: false, message: "Invalid course ID provided" });
        }
        console.error("capturePayment Course.find error:", err.message);
        return res.status(500).json({ success: false, message: "Could not validate courses" });
    }

    const courseMap = new Map(
        (Array.isArray(coursesDocs) ? coursesDocs : []).map((course) => [
            course._id.toString(),
            course,
        ])
    );

    let totalAmount = 0;
    const orderedDocs = [];

    for (const courseId of uniqueCourseIds) {
        const course = courseMap.get(courseId);
        if (!course) {
            return res
                .status(404)
                .json({ success: false, message: `Course not found: ${courseId}` });
        }
        if (course.status && course.status !== "Published") {
            return res.status(400).json({
                success: false,
                message: `Course is not currently available for purchase: ${course.courseName || courseId}`,
            });
        }
        if (course.studentEnrolled?.some((id) => id.toString() === userId)) {
            return res.status(400).json({
                success: false,
                message: "You are already enrolled in one of these courses",
            });
        }
        if (
            typeof course.price !== "number" ||
            !Number.isFinite(course.price) ||
            course.price < 0
        ) {
            return res
                .status(400)
                .json({ success: false, message: `Invalid pricing for course: ${courseId}` });
        }
        totalAmount += course.price;
        orderedDocs.push(course);
    }

    // Free courses (₹0) must never generate a Razorpay charge
    if (totalAmount === 0) {
        return res.status(400).json({
            success: false,
            message: "Free courses do not require payment. Use free enrollment instead.",
        });
    }

    const amountInSubunits = Math.round(totalAmount * 100);
    const currency = "INR";
    const receipt = `rcpt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const options = {
        amount: amountInSubunits,
        currency,
        receipt,
    };

    try {
        const paymentResponse = await instance.orders.create(options);
        const courseSnapshots = await buildCourseSnapshots(orderedDocs);

        const createdOrder = await Order.create({
            user: userId,
            courses: orderedDocs.map((c) => c._id),
            courseSnapshots,
            amount: totalAmount,
            amountInSubunits,
            currency: (paymentResponse.currency || currency).toUpperCase(),
            receipt: paymentResponse.receipt || receipt,
            paymentProvider: "RAZORPAY",
            razorpayOrderId: paymentResponse.id,
            status: "PENDING",
            enrollmentCompleted: false,
        });

        return res.status(200).json({
            success: true,
            message: paymentResponse,
            data: {
                orderId: createdOrder?._id,
                razorpayOrderId: paymentResponse.id,
                amount: totalAmount,
                amountInSubunits,
                currency: (paymentResponse.currency || currency).toUpperCase(),
                receipt: paymentResponse.receipt || receipt,
            },
        });
    } catch (error) {
        console.error("Razorpay order creation error:", error?.message || "Unknown error");
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
        const orderedDocs = [];

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

            if (
                typeof course.price !== "number" ||
                !Number.isFinite(course.price) ||
                course.price < 0
            ) {
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
            orderedDocs.push(course);
        }

        // Reuse the standard enrollment & progress initialization pipeline (also clears cart)
        await enrollStudents(normalizedCourseIds, userId);

        // Record a ₹0 FREE order entry for transparent student order history
        const courseSnapshots = await buildCourseSnapshots(orderedDocs);
        const freeOrder = await Order.create({
            user: userId,
            courses: orderedDocs.map((c) => c._id),
            courseSnapshots,
            amount: 0,
            amountInSubunits: 0,
            currency: "INR",
            receipt: `free_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
            paymentProvider: "FREE",
            status: "PAID",
            paidAt: new Date(),
            enrollmentCompleted: true,
        });

        return res.status(200).json({
            success: true,
            message: "Successfully enrolled in free course",
            data: {
                enrolledCourses: normalizedCourseIds,
                orderId: freeOrder?._id,
            },
        });
    } catch (error) {
        console.error("enrollFreeCourse error:", error?.message || "Unknown error");
        return res.status(500).json({
            success: false,
            message: error.message || "Could not complete free course enrollment",
        });
    }
};

// ============================================================
// VERIFY PAYMENT - strictly validates Razorpay HMAC signature,
// server-side Order ownership/amount/currency, replay protection,
// atomic PENDING -> PAID transition, and idempotent enrollment
// ============================================================
exports.verifyPayment = async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        courses,
        amount,
        currency,
    } = req.body || {};
    const userId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId) {
        return res.status(400).json({
            success: false,
            message: "Payment verification failed: missing fields",
        });
    }

    // Step 1: Constant-time HMAC-SHA256 verification (never log signature or secret)
    const signatureValid = verifySignatureTimingSafe(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
    );

    if (!signatureValid) {
        // Record failed verification attempt against matching PENDING order without granting access
        try {
            await Order.findOneAndUpdate(
                { razorpayOrderId: razorpay_order_id, user: userId, status: "PENDING" },
                { $set: { failureReason: "Invalid payment signature" } }
            );
        } catch {
            // Do not mask the 400 invalid signature response
        }
        return res.status(400).json({
            success: false,
            message: "Payment verification failed: invalid signature",
        });
    }

    try {
        // Step 2: Fetch authoritative server-side Order created during capturePayment
        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Payment verification failed: order not found",
            });
        }

        // Strict ownership check (prevent cross-user order verification/hijacking)
        if (order.user.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to verify this order",
            });
        }

        // Step 3: Validate authoritative amount, currency, and course list if client provided them
        if (amount !== undefined && amount !== null && amount !== "") {
            const numericAmount = Number(amount);
            if (!Number.isFinite(numericAmount) || numericAmount !== order.amountInSubunits) {
                return res.status(400).json({
                    success: false,
                    message: "Payment verification failed: amount mismatch",
                });
            }
        }

        if (currency !== undefined && currency !== null && currency !== "") {
            if (String(currency).trim().toUpperCase() !== String(order.currency).toUpperCase()) {
                return res.status(400).json({
                    success: false,
                    message: "Payment verification failed: currency mismatch",
                });
            }
        }

        const authoritativeCourseIds = (Array.isArray(order.courses) ? order.courses : []).map(
            (id) => id.toString()
        );
        if (Array.isArray(courses) && courses.length > 0) {
            const allowedSet = new Set(authoritativeCourseIds);
            const hasTamperedCourse = courses.some((id) => !allowedSet.has(String(id).trim()));
            if (hasTamperedCourse) {
                return res.status(400).json({
                    success: false,
                    message: "Payment verification failed: courses do not match the initiated order",
                });
            }
        }

        // Step 4: Duplicate payment ID replay check across orders
        const existingPaymentOrder = await Order.findOne({
            razorpayPaymentId: razorpay_payment_id,
        });
        if (
            existingPaymentOrder &&
            existingPaymentOrder._id.toString() !== order._id.toString()
        ) {
            return res.status(409).json({
                success: false,
                message: "Duplicate payment ID: this payment has already been processed",
            });
        }

        // Step 5: Idempotent handling for already PAID orders (including interrupted-request recovery)
        if (order.status === "PAID") {
            if (order.razorpayPaymentId && order.razorpayPaymentId !== razorpay_payment_id) {
                return res.status(409).json({
                    success: false,
                    message: "Order has already been paid with a different payment ID",
                });
            }

            if (order.enrollmentCompleted) {
                return res.status(200).json({
                    success: true,
                    message: "Payment already verified",
                    alreadyProcessed: true,
                    data: { order },
                });
            }

            // Interrupted-request recovery: payment was captured/marked PAID earlier, complete enrollment safely
            await enrollStudents(authoritativeCourseIds, userId);
            const recoveredOrder = await Order.findByIdAndUpdate(
                order._id,
                { $set: { enrollmentCompleted: true } },
                { new: true }
            );
            return res.status(200).json({
                success: true,
                message: "Payment verified",
                data: { order: recoveredOrder || order },
            });
        }

        if (order.status === "CANCELLED" || order.status === "REFUNDED") {
            return res.status(400).json({
                success: false,
                message: `Cannot verify payment for an order with status ${order.status}`,
            });
        }

        // Step 6: Atomic conditional state transition (PENDING / FAILED -> PAID)
        let claimedOrder;
        try {
            claimedOrder = await Order.findOneAndUpdate(
                {
                    _id: order._id,
                    user: userId,
                    status: { $in: ["PENDING", "FAILED"] },
                },
                {
                    $set: {
                        status: "PAID",
                        razorpayPaymentId: razorpay_payment_id,
                        paidAt: new Date(),
                        failureReason: "",
                    },
                },
                { new: true }
            );
        } catch (updateErr) {
            if (updateErr?.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: "Duplicate payment ID: this payment has already been processed",
                });
            }
            throw updateErr;
        }

        // Handle concurrent duplicate callback race cleanly
        if (!claimedOrder) {
            const latestOrder = await Order.findById(order._id);
            if (
                latestOrder?.status === "PAID" &&
                latestOrder.razorpayPaymentId === razorpay_payment_id
            ) {
                if (!latestOrder.enrollmentCompleted) {
                    await enrollStudents(authoritativeCourseIds, userId);
                    await Order.findByIdAndUpdate(latestOrder._id, {
                        $set: { enrollmentCompleted: true },
                    });
                }
                return res.status(200).json({
                    success: true,
                    message: "Payment already verified",
                    alreadyProcessed: true,
                    data: { order: latestOrder },
                });
            }
            return res.status(409).json({
                success: false,
                message: "Order could not be verified due to a concurrent state change",
            });
        }

        // Step 7: Enroll student using ONLY authoritative server-side order courses
        await enrollStudents(authoritativeCourseIds, userId);

        const finalizedOrder = await Order.findByIdAndUpdate(
            claimedOrder._id,
            { $set: { enrollmentCompleted: true } },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Payment verified",
            data: { order: finalizedOrder || claimedOrder },
        });
    } catch (error) {
        console.error("verifyPayment enrollment failed:", error?.message || "Unknown error");
        return res.status(500).json({
            success: false,
            message: error.message || "Payment verification failed",
        });
    }
};

// ============================================================
// MARK PAYMENT FAILED / CANCELLED - safely records failed or dismissed
// Razorpay checkout without ever modifying a PAID order or enrolling user
// ============================================================
exports.markPaymentFailed = async (req, res) => {
    try {
        const userId = req.user.id;
        const { razorpay_order_id, status = "FAILED", reason = "" } = req.body || {};

        if (!razorpay_order_id || typeof razorpay_order_id !== "string") {
            return res.status(400).json({
                success: false,
                message: "razorpay_order_id is required",
            });
        }

        const normalizedStatus = String(status).trim().toUpperCase();
        if (normalizedStatus !== "FAILED" && normalizedStatus !== "CANCELLED") {
            return res.status(400).json({
                success: false,
                message: "status must be FAILED or CANCELLED",
            });
        }

        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id.trim() });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        if (order.user.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update this order",
            });
        }

        // Never downgrade a PAID order
        if (order.status === "PAID") {
            return res.status(409).json({
                success: false,
                message: "Cannot mark a paid order as failed or cancelled",
            });
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { _id: order._id, user: userId, status: { $ne: "PAID" } },
            {
                $set: {
                    status: normalizedStatus,
                    failureReason:
                        typeof reason === "string" ? reason.trim().slice(0, 300) : "",
                },
            },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: `Order marked as ${normalizedStatus}`,
            data: { order: updatedOrder },
        });
    } catch (error) {
        console.error("markPaymentFailed error:", error?.message || "Unknown error");
        return res.status(500).json({
            success: false,
            message: "Could not update order status",
        });
    }
};

// ============================================================
// GET ORDER HISTORY - paginated order list strictly scoped to req.user.id
// ============================================================
exports.getOrderHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const rawPage = req.query?.page;
        const rawLimit = req.query?.limit;
        const rawStatus = req.query?.status;

        let page = 1;
        if (rawPage !== undefined && rawPage !== "") {
            if (typeof rawPage !== "string" || !/^\d+$/.test(rawPage.trim()) || Number(rawPage) < 1) {
                return res.status(400).json({
                    success: false,
                    message: "page must be a positive integer",
                });
            }
            page = Number(rawPage);
        }

        let limit = 10;
        if (rawLimit !== undefined && rawLimit !== "") {
            if (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit.trim()) || Number(rawLimit) < 1) {
                return res.status(400).json({
                    success: false,
                    message: "limit must be a positive integer",
                });
            }
            limit = Math.min(Number(rawLimit), 50);
        }

        const filter = { user: userId };
        if (rawStatus !== undefined && rawStatus !== "") {
            const normalizedStatus = String(rawStatus).trim().toUpperCase();
            if (!ALLOWED_ORDER_STATUSES.has(normalizedStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status filter",
                });
            }
            filter.status = normalizedStatus;
        }

        const skip = (page - 1) * limit;
        const [orders, totalOrders] = await Promise.all([
            Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
            Order.countDocuments(filter),
        ]);

        const totalPages = totalOrders > 0 ? Math.ceil(totalOrders / limit) : 0;

        return res.status(200).json({
            success: true,
            message: "Order history fetched successfully",
            data: {
                orders: Array.isArray(orders) ? orders : [],
                pagination: {
                    page,
                    limit,
                    totalOrders: totalOrders || 0,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: totalOrders > 0 && page > 1,
                },
            },
        });
    } catch (error) {
        console.error("getOrderHistory error:", error?.message || "Unknown error");
        return res.status(500).json({
            success: false,
            message: "Failed to fetch order history",
        });
    }
};

// ============================================================
// GET ORDER DETAILS - single order strictly scoped to req.user.id
// ============================================================
exports.getOrderDetails = async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderId } = req.params || {};

        if (!isValidObjectId(orderId)) {
            return res.status(400).json({
                success: false,
                message: "Valid orderId is required",
            });
        }

        const order = await Order.findById(orderId).lean();
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        if (order.user.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view this order",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Order details fetched successfully",
            data: { order },
        });
    } catch (error) {
        console.error("getOrderDetails error:", error?.message || "Unknown error");
        return res.status(500).json({
            success: false,
            message: "Failed to fetch order details",
        });
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
            { $addToSet: { studentEnrolled: userId } }
        ),
        ...coursesNeedingProgress.map((courseId) =>
            CourseProgress.create({ courseID: courseId, userId, completedVideos: [] })
        ),
    ]);

    const progressDocs = await CourseProgress.find({ courseID: { $in: courses }, userId });

    // Atomically enroll student, attach progress records, and remove enrolled courses from persistent DB cart
    await User.findByIdAndUpdate(userId, {
        $addToSet: {
            courses: { $each: courses },
            courseProgress: { $each: (progressDocs || []).map((doc) => doc._id) },
        },
        $pull: {
            cart: { $in: courses },
        },
    });

    // Invalidate course caches so studentEnrolled reflects immediately on CourseDetails
    cache.del("getAllCourses");
    for (const courseId of courses) {
        cache.del(`getCourseDetails:${courseId}`);
    }

    const student = await User.findById(userId);
    const courseDocs = await Course.find({ _id: { $in: courses } }, { courseName: 1 });

    if (student?.email && Array.isArray(courseDocs)) {
        await Promise.allSettled(
            courseDocs.map((courseDoc) =>
                mailSender(
                    student.email,
                    `Successfully Enrolled into ${courseDoc.courseName}`,
                    courseEnrollmentEmail(courseDoc.courseName, student.firstName)
                )
            )
        );
    }
};

// ============================================================
// SEND PAYMENT SUCCESS EMAIL
// ============================================================
exports.sendPaymentSuccessEmail = async (req, res) => {
    const { orderId, paymentId, amount } = req.body || {};
    const userId = req.user.id;

    if (!orderId || !paymentId || !amount || !userId) {
        return res
            .status(400)
            .json({ success: false, message: "Please provide all required fields" });
    }

    try {
        const student = await User.findById(userId);
        if (!student) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        await mailSender(
            student.email,
            "Payment Received - StudyNotion",
            paymentSuccessEmail(
                `${student.firstName} ${student.lastName}`,
                amount / 100,
                orderId,
                paymentId
            )
        );

        return res.status(200).json({ success: true, message: "Payment success email sent" });
    } catch (error) {
        console.error("sendPaymentSuccessEmail error:", error?.message || "Unknown error");
        return res.status(500).json({ success: false, message: "Could not send email" });
    }
};
