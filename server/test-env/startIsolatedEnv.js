/**
 * Starts the completely isolated StudyNotion backend test environment:
 *  1. Enables explicit test mode & external service mocking (zero production .env reads).
 *  2. Boots/verifies an isolated local MongoDB test instance (127.0.0.1:27018/studynotion_test).
 *  3. Seeds reproducible synthetic test users, categories, and courses.
 *  4. Starts Express API on PORT (default 4001) and cleans up everything on SIGINT/SIGTERM.
 */
process.env.NODE_ENV = "test";
process.env.STUDYNOTION_TEST_MODE = "true";
process.env.TEST_MOCK_EXTERNAL_SERVICES = "true";
process.env.PORT = process.env.PORT || "4001";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";
process.env.JWT_SECRET = process.env.JWT_SECRET || "studynotion-isolated-test-jwt-secret";
process.env.RAZORPAY_KEY = process.env.RAZORPAY_KEY || "rzp_test_isolated_mock_key";
process.env.RAZORPAY_SECRET = process.env.RAZORPAY_SECRET || "studynotion-isolated-test-razorpay-secret";
process.env.FOLDER_NAME = process.env.FOLDER_NAME || "studynotion_test_uploads";

const { ensureIsolatedMongo } = require("./mongoInstance");
const database = require("../config/database");
const { seedTestDatabase, teardownTestDatabase } = require("./seed");
const { clear: clearCache, startSweeper } = require("../utils/cache");
const mailSender = require("../utils/mailSender");

const startIsolatedBackend = async () => {
    const mongo = await ensureIsolatedMongo();
    process.env.MONGODB_TEST_URL = mongo.uri;

    const app = require("../index");

    // Mount reset endpoint so E2E runners can re-seed cleanly between runs if desired
    app.post("/api/v1/__test__/reseed", async (req, res) => {
        try {
            clearCache();
            if (typeof mailSender.clearSentEmails === "function") {
                mailSender.clearSentEmails();
            }
            const summary = await seedTestDatabase();
            return res.status(200).json({ success: true, data: summary });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    await database.connect();
    const seeded = await seedTestDatabase();
    startSweeper();

    const port = Number(process.env.PORT);
    const server = await new Promise((resolve) => {
        const srv = app.listen(port, () => resolve(srv));
    });

    console.log(`[ISOLATED-ENV] Backend ready on http://localhost:${port}`);
    console.log(`[ISOLATED-ENV] Seeded summary: ${JSON.stringify(seeded)}`);

    let shuttingDown = false;
    const shutdown = async () => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log("[ISOLATED-ENV] Shutting down isolated test server & tearing down test DB...");
        await new Promise((resolve) => server.close(resolve));
        try {
            await teardownTestDatabase({ dropDb: true });
        } catch (err) {
            console.error("[ISOLATED-ENV] Teardown error:", err.message);
        }
        await mongo.stop();
        console.log("[ISOLATED-ENV] Clean shutdown complete.");
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    return { server, mongo, seeded, shutdown };
};

if (require.main === module) {
    startIsolatedBackend().catch((err) => {
        console.error("[ISOLATED-ENV] Startup failed:", err);
        process.exit(1);
    });
}

module.exports = { startIsolatedBackend };
