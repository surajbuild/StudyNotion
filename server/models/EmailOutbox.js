const mongoose = require("mongoose");

const EMAIL_OUTBOX_STATUS = {
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    SENT: "SENT",
    FAILED: "FAILED",
};

const EMAIL_TYPES = {
    PAYMENT_RECEIPT: "PAYMENT_RECEIPT",
    ENROLLMENT_CONFIRMATION: "ENROLLMENT_CONFIRMATION",
    INSTRUCTOR_APPROVAL: "INSTRUCTOR_APPROVAL",
    INSTRUCTOR_REJECTION: "INSTRUCTOR_REJECTION",
    OTP: "OTP",
    PASSWORD_RESET: "PASSWORD_RESET",
    CONTACT_CONFIRMATION: "CONTACT_CONFIRMATION",
};

const emailOutboxSchema = new mongoose.Schema(
    {
        to: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        body: {
            type: String,
            required: true,
        },
        emailType: {
            type: String,
            required: true,
            enum: Object.values(EMAIL_TYPES),
        },
        referenceId: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            required: true,
            enum: Object.values(EMAIL_OUTBOX_STATUS),
            default: EMAIL_OUTBOX_STATUS.PENDING,
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
        },
        lastError: {
            type: String,
            default: null,
        },
        sentAt: {
            type: Date,
            default: null,
        },
        leaseUntil: {
            type: Date,
            default: null,
            index: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

// Compound unique index prevents duplicate outbox entries for the exact same event/order
emailOutboxSchema.index({ referenceId: 1, emailType: 1 }, { unique: true });

// Compound index for efficient worker polling
emailOutboxSchema.index({ status: 1, leaseUntil: 1, createdAt: 1 });

const EmailOutbox = mongoose.model("EmailOutbox", emailOutboxSchema);

module.exports = {
    EmailOutbox,
    EMAIL_OUTBOX_STATUS,
    EMAIL_TYPES,
};
