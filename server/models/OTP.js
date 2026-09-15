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

// NOTE: The email used to be sent synchronously from a pre("save") hook,
// which blocked every sendOTP request on the full SMTP round-trip. Sending
// is now fire-and-forget in the sendOTP controller (server/controllers/Auth.js).

module.exports = mongoose.model("OTP", OTPSchema);
