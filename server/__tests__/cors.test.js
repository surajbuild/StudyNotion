const request = require("supertest");
const express = require("express");
const cors = require("cors");
const {
  normalizeOrigin,
  getAllowedOrigins,
  isOriginAllowed,
  createCorsOptions,
} = require("../config/corsConfig");

describe("Strict CORS Configuration & Domain Isolation (SEC-001)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Origin Normalization & Allowlist Validation", () => {
    it("should normalize origins correctly (lowercase, strip trailing slashes)", () => {
      expect(normalizeOrigin("https://StudyNotion.com/")).toBe("https://studynotion.com");
      expect(normalizeOrigin("http://localhost:3000/")).toBe("http://localhost:3000");
      expect(normalizeOrigin("  https://staging.studynotion.com   ")).toBe("https://staging.studynotion.com");
      expect(normalizeOrigin("")).toBe("");
      expect(normalizeOrigin(null)).toBe("");
      expect(normalizeOrigin(undefined)).toBe("");
    });

    it("should allow configured origins from ALLOWED_ORIGINS and FRONTEND_URL", () => {
      process.env.ALLOWED_ORIGINS = "https://studynotion.com,https://staging.studynotion.com";
      process.env.FRONTEND_URL = "https://app.studynotion.com";

      expect(isOriginAllowed("https://studynotion.com")).toBe(true);
      expect(isOriginAllowed("https://staging.studynotion.com")).toBe(true);
      expect(isOriginAllowed("https://app.studynotion.com")).toBe(true);
    });

    it("should strictly reject arbitrary vercel.app domains (SEC-001)", () => {
      process.env.ALLOWED_ORIGINS = "https://studynotion.com";
      process.env.FRONTEND_URL = "https://studynotion.com";

      expect(isOriginAllowed("https://attacker.vercel.app")).toBe(false);
      expect(isOriginAllowed("https://malicious-preview.vercel.app")).toBe(false);
      expect(isOriginAllowed("https://phishing.vercel.app")).toBe(false);
    });

    it("should reject lookalike and subdomain prefix attacks", () => {
      process.env.ALLOWED_ORIGINS = "https://studynotion.com,http://localhost:3000";
      process.env.FRONTEND_URL = "https://studynotion.com";

      expect(isOriginAllowed("https://studynotion.com.evil.com")).toBe(false);
      expect(isOriginAllowed("http://localhost:3000.evil.com")).toBe(false);
      expect(isOriginAllowed("https://evil-studynotion.com")).toBe(false);
      expect(isOriginAllowed("http://localhost:3000@evil.com")).toBe(false);
    });

    it("should permit requests without an Origin header (server-to-server, curl, mobile)", () => {
      expect(isOriginAllowed(undefined)).toBe(true);
      expect(isOriginAllowed(null)).toBe(true);
      expect(isOriginAllowed("")).toBe(true);
    });

    it("should strictly disallow localhost in production mode unless explicitly configured", () => {
      process.env.NODE_ENV = "production";
      process.env.STUDYNOTION_TEST_MODE = "false";
      process.env.ALLOWED_ORIGINS = "https://production.studynotion.com";
      delete process.env.FRONTEND_URL;

      const origins = getAllowedOrigins();
      expect(origins.has("https://production.studynotion.com")).toBe(true);
      expect(origins.has("http://localhost:3000")).toBe(false);
      expect(origins.has("http://localhost:3001")).toBe(false);
    });
  });

  describe("HTTP Request & Preflight OPTIONS Verification (Supertest)", () => {
    let app;

    beforeEach(() => {
      process.env.ALLOWED_ORIGINS = "https://approved.studynotion.com,https://staging.studynotion.com";
      process.env.FRONTEND_URL = "https://approved.studynotion.com";

      app = express();
      app.use(cors(createCorsOptions()));
      app.get("/api/test", (req, res) => res.json({ success: true, data: "protected data" }));
      app.post("/api/action", (req, res) => res.json({ success: true, action: "completed" }));

      // Error handler for CORS rejections
      app.use((err, req, res, next) => {
        res.status(err.status || 500).json({
          success: false,
          message: err.message,
        });
      });
    });

    it("should set Access-Control-Allow-Origin and credentials for approved origin", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("Origin", "https://approved.studynotion.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("https://approved.studynotion.com");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("should set Access-Control-Allow-Origin for approved staging origin", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("Origin", "https://staging.studynotion.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("https://staging.studynotion.com");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("should allow request without Origin header (curl/CLI/server-to-server)", async () => {
      const res = await request(app).get("/api/test");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("should block arbitrary attacker.vercel.app with 403 (SEC-001)", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("Origin", "https://malicious-attacker.vercel.app");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/CORS blocked/i);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("should block untrusted external origin with 403", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("Origin", "https://evil-hacker.com");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("should block lookalike domain with 403", async () => {
      const res = await request(app)
        .get("/api/test")
        .set("Origin", "https://approved.studynotion.com.evil.com");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("should successfully handle preflight OPTIONS for approved origin", async () => {
      const res = await request(app)
        .options("/api/action")
        .set("Origin", "https://approved.studynotion.com")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type,Authorization");

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe("https://approved.studynotion.com");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
      expect(res.headers["access-control-allow-methods"]).toBeDefined();
    });

    it("should reject preflight OPTIONS for untrusted origin with 403", async () => {
      const res = await request(app)
        .options("/api/action")
        .set("Origin", "https://untrusted-domain.com")
        .set("Access-Control-Request-Method", "POST");

      expect(res.status).toBe(403);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });
});
