const mongoose = require("mongoose");

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        index: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 5 * 60, // OTP expires after 5 minutes (MongoDB TTL index)
    },
    otp: {
        type: String,
        required: true,
        index: true,
    },
});

// OTP email delivery is handled by the sendOTP controller after the code is saved.

module.exports = mongoose.model("OTP", OTPSchema);
