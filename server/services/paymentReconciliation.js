const mongoose = require("mongoose");
const Course = require("../models/Course");
const User = require("../models/User");
const Order = require("../models/Order");
const CourseProgress = require("../models/CourseProgress");
const mailSender = require("../utils/mailSender");
const cache = require("../utils/cache");
const { courseEnrollmentEmail } = require("../mail/templates/courseEnrollmentEmail");
const { paymentSuccessEmail } = require("../mail/templates/paymentSuccessEmail");

/**
 * Idempotently enrolls a student into the specified courses:
 *  1. Ensures CourseProgress records exist without duplicate documents.
 *  2. Adds student to Course.studentEnrolled via $addToSet.
 *  3. Adds courses & progress records to User, and removes them from User.cart.
 *  4. Invalidates course caches.
 *  5. Sends course enrollment confirmation emails.
 *
 * @param {Array<string|mongoose.Types.ObjectId>} courses
 * @param {string|mongoose.Types.ObjectId} userId
 */
async function enrollStudents(courses, userId) {
    if (!courses || !Array.isArray(courses) || courses.length === 0 || !userId) {
        throw new Error("Courses array and userId are required for enrollment");
    }

    const normalizedCourseIds = courses.map((c) => (c?._id || c).toString());
    const normalizedUserId = (userId?._id || userId).toString();

    // Check existing progress records first to prevent duplicate CourseProgress documents
    const existingProgress = await CourseProgress.find({
        courseID: { $in: normalizedCourseIds },
        userId: normalizedUserId,
    });
    const existingCourseIds = new Set(
        (existingProgress || [])
            .map((doc) => doc?.courseID?.toString())
            .filter(Boolean)
    );
    const coursesNeedingProgress = normalizedCourseIds.filter(
        (courseId) => !existingCourseIds.has(courseId)
    );

    const enrolledAt = new Date();
    await Promise.all([
        Course.updateMany(
            { _id: { $in: normalizedCourseIds } },
            { $addToSet: { studentEnrolled: normalizedUserId } }
        ),
        ...coursesNeedingProgress.map((courseId) =>
            CourseProgress.create({
                courseID: courseId,
                userId: normalizedUserId,
                completedVideos: [],
                enrolledAt,
            })
        ),
    ]);

    const progressDocs = await CourseProgress.find({
        courseID: { $in: normalizedCourseIds },
        userId: normalizedUserId,
    });

    // Atomically enroll student, attach progress records, and remove enrolled courses from persistent DB cart
    await User.findByIdAndUpdate(normalizedUserId, {
        $addToSet: {
            courses: { $each: normalizedCourseIds },
            courseProgress: { $each: (progressDocs || []).map((doc) => doc._id) },
        },
        $pull: {
            cart: { $in: normalizedCourseIds },
        },
    });

    // Invalidate course caches so studentEnrolled reflects immediately on CourseDetails
    cache.del("getAllCourses");
    for (const courseId of normalizedCourseIds) {
        cache.del(`getCourseDetails:${courseId}`);
    }

    // Fire and forget enrollment emails safely
    try {
        const student = await User.findById(normalizedUserId);
        const courseDocs = await Course.find(
            { _id: { $in: normalizedCourseIds } },
            { courseName: 1 }
        );

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
    } catch (mailErr) {
        console.error("Course enrollment email dispatch failed:", mailErr?.message || mailErr);
    }
}

/**
 * Atomically ensures payment receipt email is dispatched exactly once per order,
 * eliminating duplicate notification emails when webhook & client verify run concurrently.
 *
 * @param {Object} order - Order document
 */
async function sendReceiptEmailIdempotent(order) {
    if (!order || !order._id || !order.user) {
        return { sent: false, reason: "INVALID_ORDER" };
    }

    // Atomic claim on receiptEmailSent flag
    const claimed = await Order.findOneAndUpdate(
        { _id: order._id, receiptEmailSent: { $ne: true } },
        { $set: { receiptEmailSent: true } },
        { new: true }
    );

    if (!claimed) {
        // Notification already claimed or sent
        return { sent: false, reason: "ALREADY_SENT" };
    }

    try {
        const student = await User.findById(order.user);
        if (!student || !student.email) {
            return { sent: false, reason: "STUDENT_NOT_FOUND" };
        }

        const amountFormatted =
            typeof order.amount === "number"
                ? order.amount
                : (order.amountInSubunits || 0) / 100;

        await mailSender(
            student.email,
            "Payment Received - StudyNotion",
            paymentSuccessEmail(
                `${student.firstName || ""} ${student.lastName || ""}`.trim() || "Student",
                amountFormatted,
                order.razorpayOrderId || order._id.toString(),
                order.razorpayPaymentId || "N/A"
            )
        );

        return { sent: true };
    } catch (error) {
        console.error("sendReceiptEmailIdempotent error:", error?.message || error);
        return { sent: false, reason: "MAIL_FAILED", error: error.message };
    }
}

/**
 * Shared, authoritative payment finalization service.
 * Used by BOTH client-side verifyPayment and server-to-server Razorpay webhook reconciliation.
 *
 * Enforces:
 *  - Order existence & status validation.
 *  - Authoritative amount & currency verification.
 *  - Global payment ID replay protection across orders.
 *  - Atomic PENDING / FAILED -> PAID state transition.
 *  - Recovery of interrupted enrollments.
 *  - Exactly-once enrollment & idempotent receipt delivery.
 *
 * @param {Object} params
 * @param {string} params.razorpayOrderId
 * @param {string} params.razorpayPaymentId
 * @param {number} [params.amountInSubunits]
 * @param {string} [params.currency]
 * @param {string} [params.source] - "WEBHOOK" | "CLIENT_VERIFY"
 * @returns {Promise<{ success: boolean, alreadyProcessed?: boolean, recovered?: boolean, order?: Object, reason?: string, message?: string }>}
 */
async function finalizeCapturedPayment({
    order: existingOrder,
    razorpayOrderId,
    razorpayPaymentId,
    amountInSubunits,
    currency,
    source = "WEBHOOK",
    sendEmail = false,
}) {
    if (!razorpayOrderId && !existingOrder?.razorpayOrderId) {
        return {
            success: false,
            reason: "MISSING_ORDER_ID",
            message: "razorpayOrderId is required for payment reconciliation",
        };
    }

    const targetOrderId = razorpayOrderId || existingOrder?.razorpayOrderId;

    // 1. Fetch authoritative server-side Order if not passed in directly
    const order =
        existingOrder ||
        (await Order.findOne({ razorpayOrderId: targetOrderId }));

    if (!order) {
        return {
            success: false,
            reason: "ORDER_NOT_FOUND",
            message: `Payment reconciliation failed: order not found for ${targetOrderId}`,
        };
    }

    // 2. Validate authoritative amount
    if (amountInSubunits !== undefined && amountInSubunits !== null && amountInSubunits !== "") {
        const numericAmount = Number(amountInSubunits);
        if (!Number.isFinite(numericAmount) || numericAmount !== order.amountInSubunits) {
            return {
                success: false,
                reason: "AMOUNT_MISMATCH",
                message: `Payment reconciliation failed: amount mismatch. Expected ${order.amountInSubunits}, received ${numericAmount}`,
            };
        }
    }

    // 3. Validate authoritative currency
    if (currency !== undefined && currency !== null && currency !== "") {
        if (String(currency).trim().toUpperCase() !== String(order.currency).toUpperCase()) {
            return {
                success: false,
                reason: "CURRENCY_MISMATCH",
                message: `Payment reconciliation failed: currency mismatch. Expected ${order.currency}, received ${currency}`,
            };
        }
    }

    // 4. Duplicate payment ID replay check across different orders
    if (razorpayPaymentId) {
        const existingPaymentOrder = await Order.findOne({ razorpayPaymentId });
        if (
            existingPaymentOrder &&
            existingPaymentOrder._id.toString() !== order._id.toString()
        ) {
            return {
                success: false,
                reason: "PAYMENT_ALREADY_USED",
                message: "Duplicate payment ID: this payment has already been processed for another order",
            };
        }
    }

    const authoritativeCourseIds = (Array.isArray(order.courses) ? order.courses : []).map(
        (id) => (id?._id || id).toString()
    );
    const userId = order.user.toString();

    // 5. Idempotent handling for already PAID orders (including interrupted recovery)
    if (order.status === "PAID") {
        if (
            order.razorpayPaymentId &&
            razorpayPaymentId &&
            order.razorpayPaymentId !== razorpayPaymentId
        ) {
            return {
                success: false,
                reason: "ORDER_ALREADY_PAID_DIFFERENT_PAYMENT",
                message: "Order has already been paid with a different payment ID",
            };
        }

        if (order.enrollmentCompleted) {
            // Already paid & enrolled: ensure receipt email was sent if sendEmail requested
            if (sendEmail) {
                await sendReceiptEmailIdempotent(order);
            }
            return {
                success: true,
                alreadyProcessed: true,
                order,
            };
        }

        // Interrupted-request recovery: payment was recorded PAID earlier, but enrollment was not finalized
        await enrollStudents(authoritativeCourseIds, userId);
        const recoveredOrder = await Order.findByIdAndUpdate(
            order._id,
            { $set: { enrollmentCompleted: true } },
            { new: true }
        );
        if (sendEmail) {
            await sendReceiptEmailIdempotent(recoveredOrder || order);
        }
        return {
            success: true,
            alreadyProcessed: false,
            recovered: true,
            order: recoveredOrder || order,
        };
    }

    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
        return {
            success: false,
            reason: "INVALID_ORDER_STATUS",
            message: `Cannot reconcile payment for an order with status ${order.status}`,
        };
    }

    // 6. Atomic conditional state transition: PENDING or FAILED -> PAID
    let claimedOrder;
    try {
        claimedOrder = await Order.findOneAndUpdate(
            {
                _id: order._id,
                status: { $in: ["PENDING", "FAILED"] },
            },
            {
                $set: {
                    status: "PAID",
                    razorpayPaymentId: razorpayPaymentId || order.razorpayPaymentId,
                    paidAt: new Date(),
                    failureReason: "",
                },
            },
            { new: true }
        );
    } catch (updateErr) {
        if (updateErr?.code === 11000) {
            return {
                success: false,
                reason: "DUPLICATE_PAYMENT_ID",
                message: "Duplicate payment ID: this payment has already been processed",
            };
        }
        throw updateErr;
    }

    // 7. Handle race condition cleanly (e.g. concurrent webhook and verifyPayment)
    if (!claimedOrder) {
        const latestOrder = await Order.findById(order._id);
        if (
            latestOrder?.status === "PAID" &&
            (!razorpayPaymentId || latestOrder.razorpayPaymentId === razorpayPaymentId)
        ) {
            if (!latestOrder.enrollmentCompleted) {
                await enrollStudents(authoritativeCourseIds, userId);
                await Order.findByIdAndUpdate(latestOrder._id, {
                    $set: { enrollmentCompleted: true },
                });
            }
            if (sendEmail) {
                await sendReceiptEmailIdempotent(latestOrder);
            }
            return {
                success: true,
                alreadyProcessed: true,
                order: latestOrder,
            };
        }
        return {
            success: false,
            reason: "CONCURRENT_STATE_CHANGE",
            message: "Order could not be reconciled due to a concurrent state change",
        };
    }

    // 8. Enroll student using authoritative server-side courses
    await enrollStudents(authoritativeCourseIds, userId);

    const finalizedOrder = await Order.findByIdAndUpdate(
        claimedOrder._id,
        { $set: { enrollmentCompleted: true } },
        { new: true }
    );

    // 9. Dispatch idempotent receipt email if requested (e.g. from Webhook)
    if (sendEmail) {
        await sendReceiptEmailIdempotent(finalizedOrder || claimedOrder);
    }

    return {
        success: true,
        alreadyProcessed: false,
        order: finalizedOrder || claimedOrder,
    };
}

module.exports = {
    enrollStudents,
    sendReceiptEmailIdempotent,
    finalizeCapturedPayment,
};
