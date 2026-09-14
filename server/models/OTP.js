const mongoose = require("mongoose");
const mailSender = require("../utils/mailSender");
const otpTemplate = require("../mail/templates/emailVerificationTemplate");

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 5 * 60, // OTP expires after 5 minutes (MongoDB TTL index)
    },
    otp: {
        type: String,
        required: true,
    },
});

OTPSchema.pre("save", async function (next) {
    // Only send email on NEW documents (not on updates to existing OTP records)
    if (this.isNew) {
        await mailSender(
            this.email,
            "StudyNotion – Your OTP Verification Code",
            otpTemplate(this.otp)
        );
    }
    next();
});

module.exports = mongoose.model("OTP", OTPSchema);
