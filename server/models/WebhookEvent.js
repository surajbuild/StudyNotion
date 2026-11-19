const mongoose = require("mongoose");

const webhookEventSchema = new mongoose.Schema(
    {
        eventId: {
            type: String,
            required: true,
            trim: true,
        },
        eventType: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        razorpayOrderId: {
            type: String,
            trim: true,
            index: true,
        },
        razorpayPaymentId: {
            type: String,
            trim: true,
            index: true,
        },
        orderReference: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            index: true,
        },
        status: {
            type: String,
            enum: ["RECEIVED", "PROCESSING", "PROCESSED", "FAILED", "NEEDS_REVIEW"],
            default: "RECEIVED",
            index: true,
        },
        attempts: {
            type: Number,
            default: 0,
            min: 0,
        },
        maxAttempts: {
            type: Number,
            default: 5,
            min: 1,
        },
        lastError: {
            type: String,
            default: "",
            trim: true,
        },
        receivedAt: {
            type: Date,
            default: Date.now,
        },
        processedAt: {
            type: Date,
            default: null,
        },
        nextRetryAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
        leaseUntil: {
            type: Date,
            default: null,
            index: true,
        },
        payload: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

// Atomic unique index on eventId prevents duplicate processing records
webhookEventSchema.index(
    { eventId: 1 },
    {
        unique: true,
        name: "unique_webhook_event_id",
    }
);

// Compound index optimized for worker claim and expired lease sweeps
webhookEventSchema.index(
    { status: 1, nextRetryAt: 1, leaseUntil: 1 },
    { name: "idx_worker_poll" }
);

module.exports = mongoose.model("WebhookEvent", webhookEventSchema);
