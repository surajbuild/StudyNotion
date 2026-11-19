const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
    {
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },
        courseName: {
            type: String,
            required: true,
            trim: true,
        },
        thumbnail: {
            type: String,
            default: "",
        },
        priceAtPurchase: {
            type: Number,
            required: true,
            min: 0,
        },
        instructorName: {
            type: String,
            default: "",
            trim: true,
        },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        courses: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Course",
                required: true,
            },
        ],
        courseSnapshots: {
            type: [orderItemSchema],
            default: [],
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        amountInSubunits: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            required: true,
            default: "INR",
            uppercase: true,
            trim: true,
        },
        receipt: {
            type: String,
            required: true,
            trim: true,
        },
        paymentProvider: {
            type: String,
            enum: ["RAZORPAY", "FREE"],
            default: "RAZORPAY",
        },
        razorpayOrderId: {
            type: String,
            trim: true,
        },
        razorpayPaymentId: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ["PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"],
            default: "PENDING",
            index: true,
        },
        paidAt: {
            type: Date,
        },
        failureReason: {
            type: String,
            trim: true,
        },
        enrollmentCompleted: {
            type: Boolean,
            default: false,
        },
        receiptEmailSent: {
            type: Boolean,
            default: false,
        },
        metadata: {
            type: Map,
            of: String,
            default: {},
        },
    },
    { timestamps: true }
);

// Supports fast paginated student order history queries
orderSchema.index({ user: 1, createdAt: -1 });

// Guarantees unique Razorpay order IDs across paid orders (partial index allows FREE orders without razorpayOrderId)
orderSchema.index(
    { razorpayOrderId: 1 },
    {
        unique: true,
        partialFilterExpression: { razorpayOrderId: { $type: "string" } },
        name: "unique_razorpay_order_id",
    }
);

// Database-level replay protection: a razorpayPaymentId can never be bound to more than one order
orderSchema.index(
    { razorpayPaymentId: 1 },
    {
        unique: true,
        partialFilterExpression: { razorpayPaymentId: { $type: "string" } },
        name: "unique_razorpay_payment_id",
    }
);

module.exports = mongoose.model("Order", orderSchema);
