const crypto = require("crypto");
const { logger } = require("../utils/logger");
const { isTestMode } = require("../config/testSafety");

/**
 * Express middleware that adds correlation ID and structured JSON access logging.
 */
module.exports = function requestLogger(req, res, next) {
    const start = Date.now();
    const correlationId = req.headers["x-request-id"] || crypto.randomUUID();
    req.id = correlationId;
    res.setHeader("X-Request-Id", correlationId);

    // Skip verbose logs during automated test execution unless explicitly requested
    if (isTestMode() && !process.env.VERBOSE_TEST_LOGS) {
        return next();
    }

    res.on("finish", () => {
        const durationMs = Date.now() - start;
        const statusCode = res.statusCode;
        const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

        logger.log({
            level,
            message: `HTTP ${req.method} ${req.originalUrl || req.url} ${statusCode} - ${durationMs}ms`,
            reqId: correlationId,
            method: req.method,
            route: req.baseUrl + (req.route?.path || req.path),
            path: req.originalUrl || req.url,
            statusCode,
            durationMs,
            ip: req.ip,
        });
    });

    next();
};
