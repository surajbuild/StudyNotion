const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const { isTestMode, isExternalMockMode } = require("./config/testSafety");

// In test mode, NEVER load production server/.env. Load server/.env.test only if present.
if (isTestMode()) {
    const testEnvPath = path.join(__dirname, ".env.test");
    if (fs.existsSync(testEnvPath)) {
        dotenv.config({ path: testEnvPath, override: false });
    }
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = "test-jwt-secret-for-tests";
    }
    if (!process.env.RAZORPAY_SECRET) {
        process.env.RAZORPAY_SECRET = "studynotion-isolated-test-razorpay-secret";
    }
} else {
    // Load .env variables before anything else references process.env
    dotenv.config({ path: path.join(__dirname, ".env") });
}

const cookieParser = require("cookie-parser");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const compression = require("compression");
const os = require("os");

const database = require("./config/database");
const { cloudinaryConnect } = require("./config/cloudinary");
const { startSweeper } = require("./utils/cache");
const { authLimiter, emailLimiter } = require("./middlewares/rateLimiters");

const userRoutes = require("./routes/User");
const profileRoutes = require("./routes/Profile");
const paymentRoutes = require("./routes/Payment");
const courseRoutes = require("./routes/Course");
const contactRoutes = require("./routes/Contact");

const PORT = process.env.PORT || 4000;

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(isTestMode() ? ["http://localhost:3001", "http://127.0.0.1:3001"] : []),
    process.env.FRONTEND_URL,
].filter(Boolean); // removes undefined/empty values

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow server-to-server requests (no origin), listed origins, and vercel.app domains
            if (
                !origin ||
                allowedOrigins.includes(origin) ||
                origin.endsWith(".vercel.app")
            ) {
                callback(null, true);
            } else {
                callback(new Error(`CORS blocked for origin: ${origin}`));
            }
        },
        credentials: true,
    })
);

app.use(
    fileUpload({
        useTempFiles: true,
        // os.tmpdir() is cross-platform (works on Windows, Mac, Linux)
        tempFileDir: os.tmpdir(),
        limits: {
            fileSize: 500 * 1024 * 1024, // 500 MB per file (supports video lectures)
            files: 3, // max 3 files per request
        },
        abortOnLimit: true,
    })
);

// ─── Cloudinary ─────────────────────────────────────────────────────
if (!isExternalMockMode()) {
    try {
        cloudinaryConnect();
    } catch (err) {
        console.warn("Cloudinary initialization failed:", err?.message || err);
    }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use("/api/v1/auth", authLimiter, userRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/course", courseRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/reach", emailLimiter, contactRoutes);

// Test-only harness endpoints — strictly mounted ONLY in explicit isolated mock test mode
if (isTestMode() && process.env.STUDYNOTION_TEST_MODE === "true" && isExternalMockMode()) {
    const OTP = require("./models/OTP");
    const mailSender = require("./utils/mailSender");

    app.get("/api/v1/__test__/otp", async (req, res) => {
        try {
            const { email } = req.query;
            if (!email) {
                return res.status(400).json({ success: false, message: "email query param required" });
            }
            const latest = await OTP.findOne({ email }).sort({ createdAt: -1 }).lean();
            if (!latest) {
                return res.status(404).json({ success: false, message: "No OTP found for email" });
            }
            return res.status(200).json({ success: true, otp: latest.otp });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    app.get("/api/v1/__test__/emails", (req, res) => {
        return res.status(200).json({ success: true, emails: mailSender.getSentEmails() });
    });

    app.get("/api/v1/__test__/assets/sample-thumb.svg", (req, res) => {
        res.type("image/svg+xml").send(
            '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
                '<rect width="640" height="360" fill="#161D29"/>' +
                '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#FFD60A" font-family="sans-serif" font-size="28">StudyNotion Test Course</text>' +
            "</svg>"
        );
    });

    app.get("/api/v1/__test__/assets/sample-video.mp4", (req, res) => {
        const sampleVideoPath = path.join(__dirname, "..", "src", "assets", "Images", "banner.mp4");
        if (fs.existsSync(sampleVideoPath)) {
            return res.sendFile(sampleVideoPath);
        }
        return res.status(404).json({ success: false, message: "Sample video asset not found" });
    });
}

// Health-check route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Server is running",
        ...(isTestMode() && { testMode: true }),
    });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Something went wrong",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
});

// ─── Startup ─────────────────────────────────────────────────────────────────

const start = async () => {
    try {
        await database.connect();
        startSweeper();
        return app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}${isTestMode() ? " [ISOLATED TEST MODE]" : ""}`);
        });
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
};

if (require.main === module) {
    start();
}

module.exports = app;
module.exports.start = start;
