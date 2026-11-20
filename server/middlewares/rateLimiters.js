const rateLimit = require("express-rate-limit");
const { isTestMode } = require("../config/testSafety");

const skipInTestMode = () => isTestMode();

let redisClient = null;
let redisStore = null;
let redisConnected = false;

// Initialize Redis if configured in the environment
const redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);

if (redisUrl && !isTestMode()) {
    try {
        const Redis = require("ioredis");
        const { RedisStore } = require("rate-limit-redis");

        redisClient = new Redis(redisUrl, {
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });

        redisClient.on("connect", () => {
            redisConnected = true;
            console.log("[RateLimiter] Connected to Redis shared rate-limit store");
        });

        redisClient.on("error", (err) => {
            redisConnected = false;
            console.warn("[RateLimiter] Redis connection issue; fallback active:", err?.message || err);
        });

        redisStore = new RedisStore({
            sendCommand: (...args) => redisClient.call(...args),
        });
    } catch (err) {
        console.warn("[RateLimiter] Failed to initialize Redis store, using memory store:", err?.message || err);
        redisStore = null;
    }
} else if (!isTestMode()) {
    console.log("[RateLimiter] REDIS_URL not configured: Running with local in-memory rate limiting (single-instance only)");
}

const createLimiterOptions = ({ windowMs, max, message, prefix }) => {
    const opts = {
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        skip: skipInTestMode,
        message: {
            success: false,
            message,
        },
    };

    if (redisStore) {
        opts.store = redisStore;
        if (prefix) {
            opts.prefix = prefix;
        }
    }

    return opts;
};

// Stricter limiter for auth routes (login/signup)
exports.authLimiter = rateLimit(
    createLimiterOptions({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // max 100 requests per window from one IP
        message: "Too many authentication attempts. Please try again later.",
        prefix: "rl:auth:",
    })
);

// Limiter for email-triggering endpoints
exports.emailLimiter = rateLimit(
    createLimiterOptions({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 20, // max 20 emails per IP per hour
        message: "Too many email requests. Please try again in an hour.",
        prefix: "rl:email:",
    })
);

// Tighter limiter for sendOTP only (each call writes a DB doc AND emails)
exports.sendOtpLimiter = rateLimit(
    createLimiterOptions({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // max 10 OTP emails per IP per hour
        message: "Too many OTP requests. Please try again in an hour.",
        prefix: "rl:otp:",
    })
);

// Tighter limiter for password-reset emails
exports.resetPasswordTokenLimiter = rateLimit(
    createLimiterOptions({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // max 10 reset emails per IP per hour
        message: "Too many password reset requests. Please try again in an hour.",
        prefix: "rl:reset:",
    })
);

// Limiter for public contact form submissions
exports.contactLimiter = rateLimit(
    createLimiterOptions({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 15, // max 15 contact submissions per IP per hour
        message: "Too many contact requests from this IP. Please try again in an hour.",
        prefix: "rl:contact:",
    })
);

// Diagnostics helper for readiness check
exports.getRateLimiterStatus = () => ({
    mode: redisStore ? "distributed_redis" : "in_memory",
    redisConnected,
    isDistributed: Boolean(redisStore && redisConnected),
});

exports.getRedisClient = () => redisClient;
