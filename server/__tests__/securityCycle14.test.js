const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const bcrypt = require("bcrypt");

jest.mock("../models/User");
jest.mock("../utils/mailSender", () => jest.fn().mockResolvedValue({ messageId: "mock-message-id", mocked: true }));

const app = require("../index");
const User = require("../models/User");
const database = require("../config/database");
const {
    validateUploadedFile,
    detectBinaryFormat,
    cleanupTempFile,
    SIZE_LIMITS,
} = require("../utils/fileSignatureValidator");
const { getRateLimiterStatus } = require("../middlewares/rateLimiters");

describe("QA Cycle #14 Security Controls (SEC-005, SEC-007, SEC-008)", () => {
    let tempFiles = [];

    const createTempFile = (filename, buffer) => {
        const filepath = path.join(os.tmpdir(), `c14-test-${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`);
        fs.writeFileSync(filepath, buffer);
        tempFiles.push(filepath);
        return {
            name: filename,
            tempFilePath: filepath,
            size: buffer.length,
            mimetype: filename.endsWith(".png") ? "image/png" : filename.endsWith(".mp4") ? "video/mp4" : "application/octet-stream",
        };
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        for (const f of tempFiles) {
            if (fs.existsSync(f)) {
                try {
                    fs.unlinkSync(f);
                } catch {
                    // ignore
                }
            }
        }
    });

    describe("SEC-005: Account Enumeration Mitigation", () => {
        it("returns identical 401 message for unregistered user and bad password on login", async () => {
            // 1. Unregistered user
            User.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null),
            });

            const resUnregistered = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: "nonexistent@test.com", password: "somePassword123" });

            expect(resUnregistered.status).toBe(401);
            expect(resUnregistered.body.success).toBe(false);
            expect(resUnregistered.body.message).toBe("Invalid credentials: email is not registered or password is incorrect");

            // 2. Registered user with wrong password
            const hashed = await bcrypt.hash("correctSecret123", 10);
            User.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: "user_registered",
                    email: "registered@test.com",
                    password: hashed,
                }),
            });

            const resWrongPass = await request(app)
                .post("/api/v1/auth/login")
                .send({ email: "registered@test.com", password: "wrongPassword" });

            expect(resWrongPass.status).toBe(401);
            expect(resWrongPass.body.success).toBe(false);
            expect(resWrongPass.body.message).toBe("Invalid credentials: email is not registered or password is incorrect");
            expect(resWrongPass.body.message).toBe(resUnregistered.body.message);
        });

        it("handles registered and unregistered email scenarios for reset-password-token", async () => {
            // Unregistered user
            User.findOne.mockResolvedValue(null);

            const resUnregistered = await request(app)
                .post("/api/v1/auth/reset-password-token")
                .send({ email: "nobody@example.com" });

            expect(resUnregistered.status).toBe(401);
            expect(resUnregistered.body.success).toBe(false);
            expect(resUnregistered.body.message).toContain("not registered");

            // Registered user
            User.findOne.mockResolvedValue({
                _id: "registered_user_id",
                email: "realuser@example.com",
            });
            User.findOneAndUpdate.mockResolvedValue({
                _id: "registered_user_id",
                email: "realuser@example.com",
            });

            const resRegistered = await request(app)
                .post("/api/v1/auth/reset-password-token")
                .send({ email: "realuser@example.com" });

            expect(resRegistered.status).toBe(200);
            expect(resRegistered.body.success).toBe(true);
        });
    });

    describe("SEC-007: Distributed Rate Limiting & Diagnostic Status", () => {
        it("reports rate limiter store configuration and operational status", () => {
            const status = getRateLimiterStatus();
            expect(status).toHaveProperty("mode");
            expect(status).toHaveProperty("redisConnected");
            expect(status).toHaveProperty("isDistributed");
            expect(["distributed_redis", "in_memory", "in_memory_fallback"]).toContain(status.mode);
        });

        it("GET /readyz returns operational status and respects distributed requirement", async () => {
            const dbSpy = jest.spyOn(database, "getDatabaseHealth").mockReturnValue({ healthy: true, state: "connected" });

            try {
                const res = await request(app).get("/readyz");
                expect(res.status).toBe(200);
                expect(res.body.status).toBe("ready");
                expect(res.body).toHaveProperty("database");
                expect(res.body).toHaveProperty("rateLimiter");

                // Verify requirement gating
                const origEnv = process.env.REQUIRE_DISTRIBUTED_RATE_LIMITING;
                try {
                    process.env.REQUIRE_DISTRIBUTED_RATE_LIMITING = "true";
                    const resDegraded = await request(app).get("/readyz");
                    expect(resDegraded.status).toBe(503);
                    expect(resDegraded.body.status).toBe("degraded");
                    expect(resDegraded.body.degraded).toBe(true);
                } finally {
                    process.env.REQUIRE_DISTRIBUTED_RATE_LIMITING = origEnv;
                }
            } finally {
                dbSpy.mockRestore();
            }
        });
    });

    describe("SEC-008: File Upload Magic-Byte Validation", () => {
        it("detects valid binary signatures for images and videos", () => {
            // PNG: 89 50 4E 47 0D 0A 1A 0A
            const pngBuf = Buffer.from("89504e470d0a1a0a", "hex");
            expect(detectBinaryFormat(pngBuf)).toEqual({ mime: "image/png", ext: ".png", type: "image" });

            // JPEG: FF D8 FF
            const jpgBuf = Buffer.from("ffd8ffe000104a46", "hex");
            expect(detectBinaryFormat(jpgBuf)).toEqual({ mime: "image/jpeg", ext: ".jpg", type: "image" });

            // GIF: 47 49 46 38
            const gifBuf = Buffer.from("4749463839610100", "hex");
            expect(detectBinaryFormat(gifBuf)).toEqual({ mime: "image/gif", ext: ".gif", type: "image" });

            // MP4: bytes 4-7 = ftyp
            const mp4Buf = Buffer.from("00000018667479706d7034320000000069736f6d6d703432", "hex");
            expect(detectBinaryFormat(mp4Buf)).toEqual({ mime: "video/mp4", ext: ".mp4", type: "video" });

            // WebM: 1A 45 DF A3
            const webmBuf = Buffer.from("1a45dfa39f428681", "hex");
            expect(detectBinaryFormat(webmBuf)).toEqual({ mime: "video/webm", ext: ".webm", type: "video" });
        });

        it("validates a legitimate PNG image file successfully", () => {
            const validFile = createTempFile("avatar.png", Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"));
            const res = validateUploadedFile(validFile, { expectedCategory: "image", maxSizeBytes: SIZE_LIMITS.AVATAR });
            expect(res.valid).toBe(true);
            expect(res.detected.mime).toBe("image/png");
        });

        it("rejects an empty (0-byte) file", () => {
            const emptyFile = createTempFile("empty.png", Buffer.alloc(0));
            const res = validateUploadedFile(emptyFile, { expectedCategory: "image" });
            expect(res.valid).toBe(false);
            expect(res.message).toMatch(/empty/i);
        });

        it("rejects spoofed MIME type (text script renamed to .png)", () => {
            const spoofedFile = createTempFile("malicious.png", Buffer.from("<?php echo 'attack'; ?>", "utf8"));
            const res = validateUploadedFile(spoofedFile, { expectedCategory: "image" });
            expect(res.valid).toBe(false);
            expect(res.message).toMatch(/does not match any allowed binary format/i);
        });

        it("rejects category mismatch (valid video sent to image endpoint)", () => {
            const videoAsImage = createTempFile("sample.png", Buffer.from("00000018667479706d7034320000000069736f6d", "hex"));
            const res = validateUploadedFile(videoAsImage, { expectedCategory: "image" });
            expect(res.valid).toBe(false);
            expect(res.message).toMatch(/Mismatched file category|Spoofed file detected/i);
        });

        it("rejects oversized file exceeding maximum size limit and unlinks temp file", () => {
            const bigFile = createTempFile("huge.png", Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(100)]));
            const res = validateUploadedFile(bigFile, { expectedCategory: "image", maxSizeBytes: 50 });
            expect(res.valid).toBe(false);
            expect(res.message).toMatch(/exceeds maximum allowed limit/i);
            expect(fs.existsSync(bigFile.tempFilePath)).toBe(false);
        });

        it("cleans up temp file safely when cleanupTempFile is called", () => {
            const temp = createTempFile("temp-test.png", Buffer.from("test"));
            expect(fs.existsSync(temp.tempFilePath)).toBe(true);
            cleanupTempFile(temp);
            expect(fs.existsSync(temp.tempFilePath)).toBe(false);
        });

        it("rejects SVG image uploads due to script-execution and XSS risks", () => {
            const svgFile = createTempFile("icon.svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "utf8"));
            const res = validateUploadedFile(svgFile, { expectedCategory: "image" });
            expect(res.valid).toBe(false);
            expect(res.message).toMatch(/SVG image uploads are not permitted/i);
        });

        it("rejects SVG payload disguised as a PNG extension", () => {
            const disguisedSvg = createTempFile("sneaky.png", Buffer.from('<svg onload="fetch(\'https://attacker.com\')"></svg>', "utf8"));
            const res = validateUploadedFile(disguisedSvg, { expectedCategory: "image" });
            expect(res.valid).toBe(false);
            expect(res.message).toMatch(/SVG image uploads are not permitted/i);
        });
    });
});
