const mongoose = require("mongoose");
const {
    isTestMode,
    sanitizeMongoUri,
    assertSafeTestDatabaseUri,
} = require("./testSafety");

if (!isTestMode()) {
    require("dotenv").config();
}

// Return the promise from mongoose.connect() so callers can await DB readiness
// before accepting HTTP traffic. In test mode, strictly require MONGODB_TEST_URL
// and reject any production or non-isolated MongoDB URI.
exports.connect = () => {
    const testMode = isTestMode();
    let connectionUri;

    if (testMode) {
        const verified = assertSafeTestDatabaseUri(process.env.MONGODB_TEST_URL, process.env);
        connectionUri = process.env.MONGODB_TEST_URL.trim();
        return mongoose
            .connect(connectionUri)
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
        .connect(connectionUri)
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
