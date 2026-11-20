const winston = require("winston");
const { isTestMode } = require("../config/testSafety");

const SENSITIVE_KEYS = new Set([
    "password",
    "confirmpassword",
    "token",
    "jwt",
    "authorization",
    "cookie",
    "cookies",
    "otp",
    "razorpay_signature",
    "signature",
    "secret",
    "webhooksecret",
    "resetpasswordtoken",
    "resetpasswordtokenhash",
    "api_key",
    "apikey",
]);

/**
 * Deep redaction of sensitive fields from logging payloads
 */
function redactSensitiveData(obj, depth = 0) {
    if (depth > 6 || obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === "string") {
        // Redact bearer tokens in strings
        if (obj.toLowerCase().startsWith("bearer ")) {
            return "Bearer [REDACTED]";
        }
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => redactSensitiveData(item, depth + 1));
    }

    if (typeof obj === "object") {
        const copy = {};
        for (const [key, val] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();
            if (SENSITIVE_KEYS.has(lowerKey)) {
                copy[key] = "[REDACTED]";
            } else {
                copy[key] = redactSensitiveData(val, depth + 1);
            }
        }
        return copy;
    }

    return obj;
}

// Custom format that redacts sensitive metadata
const redactFormat = winston.format((info) => {
    return redactSensitiveData(info);
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (isTestMode() ? "warn" : "info"),
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
        redactFormat(),
        winston.format.json()
    ),
    defaultMeta: {
        environment: process.env.NODE_ENV || "development",
        service: "studynotion-backend",
    },
    transports: [
        new winston.transports.Console({
            silent: isTestMode() && !process.env.VERBOSE_TEST_LOGS,
        }),
    ],
});

module.exports = {
    logger,
    redactSensitiveData,
};
