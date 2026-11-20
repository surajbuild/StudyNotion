const mongoose = require("mongoose");
const {
    isTestMode,
    sanitizeMongoUri,
    assertSafeTestDatabaseUri,
} = require("./testSafety");

if (!isTestMode()) {
    require("dotenv").config();
}

/**
 * Returns configurable connection options based on runtime environment.
 * Evaluates pool sizing, timeouts, and IPv4 preference.
 */
function getConnectionOptions() {
    const isTest = isTestMode();
    return {
        maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || (isTest ? "10" : "20"), 10),
        minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || (isTest ? "1" : "2"), 10),
        serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS || "5000", 10),
        socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT_MS || "45000", 10),
        family: 4, // IPv4 preference to avoid unnecessary IPv6 DNS lookup delays
    };
}

// Return the promise from mongoose.connect() so callers can await DB readiness
// before accepting HTTP traffic. In test mode, strictly require MONGODB_TEST_URL
// and reject any production or non-isolated MongoDB URI.
exports.connect = () => {
    const testMode = isTestMode();
    const options = getConnectionOptions();
    let connectionUri;

    if (testMode) {
        const verified = assertSafeTestDatabaseUri(process.env.MONGODB_TEST_URL, process.env);
        connectionUri = process.env.MONGODB_TEST_URL.trim();
        return mongoose
            .connect(connectionUri, options)
            .then(() => {
                console.log(
                    `DB connected successfully [ISOLATED TEST MODE: ${verified.dbName} @ ${verified.sanitizedUri}]`
                );
            })
            .catch((error) => {
                console.error(
                    `Test DB connection failed (${verified.sanitizedUri}):`,
                    error?.message || error
                );
                throw error;
            });
    }

    connectionUri = process.env.MONGODB_URL;
    return mongoose
        .connect(connectionUri, options)
        .then(() => {
            console.log("DB connected successfully");
        })
        .catch((error) => {
            console.error(
                `DB connection failed (${sanitizeMongoUri(connectionUri)}):`,
                error?.message || error
            );
            process.exit(1);
        });
};

/**
 * Health check helper for liveness/readiness probes.
 * Returns true if mongoose connection is fully active (readyState 1).
 */
exports.isDatabaseHealthy = () => {
    return mongoose.connection.readyState === 1;
};

/**
 * Detailed database health and metrics for readiness endpoint.
 */
exports.getDatabaseHealth = () => {
    const states = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting",
    };
    const state = mongoose.connection.readyState;
    return {
        healthy: state === 1,
        state: states[state] || "unknown",
        host: mongoose.connection.host ? sanitizeMongoUri(mongoose.connection.host) : null,
        name: mongoose.connection.name || null,
    };
};

/**
 * Graceful shutdown helper: closes Mongoose connection cleanly without dropping active operations abruptly.
 */
exports.closeDatabase = async () => {
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close(false);
            console.log("[Database] Mongoose connection closed cleanly for graceful shutdown");
        }
    } catch (err) {
        console.error("[Database] Error while closing Mongoose connection:", err?.message || err);
    }
};

exports.getConnectionOptions = getConnectionOptions;
