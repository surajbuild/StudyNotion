const rateLimit = require("express-rate-limit");

// Stricter limiter for auth routes (login/signup/sendotp) — prevents
// brute-force and OTP-spam abuse.
exports.authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // max 100 requests per window from one IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later.",
    },
});

// Limiter for email-triggering endpoints (sendotp, reset-password-token, contact).
exports.emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // max 10 emails per IP per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many email requests. Please try again in an hour.",
    },
});

// Tighter limiter for sendOTP only (each call writes a DB doc AND emails).
exports.sendOtpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // max 5 OTP emails per IP per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many OTP requests. Please try again in an hour.",
    },
});

// Tighter limiter for password-reset emails.
exports.resetPasswordTokenLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // max 5 reset emails per IP per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many password reset requests. Please try again in an hour.",
    },
});