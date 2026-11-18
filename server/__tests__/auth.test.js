const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Mock mailSender before loading app
jest.mock("../utils/mailSender", () => jest.fn().mockResolvedValue({ messageId: "mock-mail-id" }));

// Mock Mongoose models
jest.mock("../models/User");
jest.mock("../models/OTP");
jest.mock("../models/Profile");

const User = require("../models/User");
const OTP = require("../models/OTP");
const Profile = require("../models/Profile");
const app = require("../index");

describe("Auth Endpoints (server/controllers/Auth.js & ResetPassword.js)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/auth/sendotp", () => {
    it("should return 401 if user is already registered", async () => {
      User.findOne.mockResolvedValue({ _id: "existing_user", email: "taken@test.com" });

      const res = await request(app)
        .post("/api/v1/auth/sendotp")
        .send({ email: "taken@test.com" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already registered/i);
    });

    it("should generate and save OTP if user is not registered", async () => {
      User.findOne.mockResolvedValue(null);
      OTP.findOne.mockResolvedValue(null);
      OTP.create.mockResolvedValue({ email: "new@test.com", otp: "123456" });

      const res = await request(app)
        .post("/api/v1/auth/sendotp")
        .send({ email: "new@test.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/OTP sent successfully/i);
      expect(OTP.create).toHaveBeenCalled();
    });
  });

  describe("POST /api/v1/auth/signup", () => {
    const validSignupPayload = {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "password123",
      confirmPassword: "password123",
      accountType: "Student",
      otp: "123456",
    };

    it("should return 403 if required fields are missing", async () => {
      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({ email: "john@example.com" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/All fields are required/i);
    });

    it("should return 400 if password and confirmPassword do not match", async () => {
      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({ ...validSignupPayload, confirmPassword: "differentPassword" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/do not match/i);
    });

    it("should return 400 if email is already registered", async () => {
      User.findOne.mockResolvedValue({ _id: "exists" });

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send(validSignupPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already registered/i);
    });

    it("should return 400 if OTP is not found", async () => {
      User.findOne.mockResolvedValue(null);
      OTP.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      });

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send(validSignupPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/OTP not found/i);
    });

    it("should return 400 if OTP has expired (> 5 min)", async () => {
      User.findOne.mockResolvedValue(null);
      const expiredDate = new Date(Date.now() - 6 * 60 * 1000); // 6 mins ago
      OTP.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ otp: "123456", createdAt: expiredDate }]),
        }),
      });

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send(validSignupPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/OTP has expired/i);
    });

    it("should return 400 if OTP does not match", async () => {
      User.findOne.mockResolvedValue(null);
      OTP.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ otp: "999999", createdAt: new Date() }]),
        }),
      });

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send(validSignupPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid OTP/i);
    });

    it("should create user and profile on valid signup", async () => {
      User.findOne.mockResolvedValue(null);
      OTP.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ otp: "123456", createdAt: new Date() }]),
        }),
      });
      Profile.create.mockResolvedValue({ _id: "profile_123" });
      User.create.mockResolvedValue({
        _id: "user_123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        accountType: "Student",
        additionalDetails: "profile_123",
      });

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send(validSignupPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(Profile.create).toHaveBeenCalled();
      expect(User.create).toHaveBeenCalled();
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should return 400 if email or password is missing", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "john@example.com" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 if user does not exist", async () => {
      User.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "notfound@example.com", password: "password123" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not registered/i);
    });

    it("should return 401 if password does not match", async () => {
      const hashedPassword = await bcrypt.hash("correctPassword", 10);
      User.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "user_1",
          email: "john@example.com",
          password: hashedPassword,
        }),
      });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "john@example.com", password: "wrongPassword" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Password is incorrect/i);
    });

    it("should log in successfully and return JWT token and cookie", async () => {
      const hashedPassword = await bcrypt.hash("correctPassword", 10);
      const mockUser = {
        _id: "user_1",
        email: "john@example.com",
        password: hashedPassword,
        accountType: "Student",
        firstName: "John",
        lastName: "Doe",
      };

      User.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "john@example.com", password: "correctPassword" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.headers["set-cookie"]).toBeDefined();
    });
  });

  describe("POST /api/v1/auth/changepassword", () => {
    it("should return 401 if not authenticated", async () => {
      const res = await request(app)
        .post("/api/v1/auth/changepassword")
        .send({
          oldPassword: "old",
          newPassword: "new",
          confirmNewPassword: "new",
        });

      expect(res.status).toBe(401);
    });

    it("should return 400 if new password and confirm new password do not match", async () => {
      const token = jwt.sign(
        { id: "user_123", email: "user@test.com", accountType: "Student" },
        process.env.JWT_SECRET || "test-jwt-secret-for-tests"
      );

      const res = await request(app)
        .post("/api/v1/auth/changepassword")
        .set("Authorization", `Bearer ${token}`)
        .send({
          oldPassword: "oldPassword",
          newPassword: "newPassword1",
          confirmNewPassword: "newPassword2",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/do not match/i);
    });

    it("should return 400 if new password is same as old password", async () => {
      const token = jwt.sign(
        { id: "user_123", email: "user@test.com", accountType: "Student" },
        process.env.JWT_SECRET || "test-jwt-secret-for-tests"
      );

      const res = await request(app)
        .post("/api/v1/auth/changepassword")
        .set("Authorization", `Bearer ${token}`)
        .send({
          oldPassword: "samePassword",
          newPassword: "samePassword",
          confirmNewPassword: "samePassword",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must be different/i);
    });
  });

  describe("Password Reset Endpoints", () => {
    it("POST /api/v1/auth/reset-password-token should return 401 for unregistered email", async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/auth/reset-password-token")
        .send({ email: "unknown@test.com" });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/not registered/i);
    });

    it("POST /api/v1/auth/reset-password-token should send reset email using request origin when present", async () => {
      const mailSender = require("../utils/mailSender");
      User.findOne.mockResolvedValue({ _id: "user1", email: "test@example.com" });
      User.findOneAndUpdate.mockResolvedValue({ _id: "user1" });

      const res = await request(app)
        .post("/api/v1/auth/reset-password-token")
        .set("Origin", "http://localhost:3000")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mailSender).toHaveBeenCalledWith(
        "test@example.com",
        "Password Reset Link",
        expect.stringContaining("http://localhost:3000/#/update-password/")
      );
    });

    it("POST /api/v1/auth/reset-password should return 401 if passwords do not match", async () => {
      const res = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({
          password: "newPass1",
          confirmPassword: "newPass2",
          token: "dummy-token",
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/did not match/i);
    });

    it("POST /api/v1/auth/reset-password should return 401 if token is expired", async () => {
      User.findOne.mockResolvedValue({
        _id: "user1",
        token: "expired-token",
        resetPasswordExpires: Date.now() - 10000, // expired
      });

      const res = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({
          password: "newPassword123",
          confirmPassword: "newPassword123",
          token: "expired-token",
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/expired/i);
    });
  });

  describe("POST /api/v1/auth/logout & Post-Logout Access Control (GAP-006 / BUG-025)", () => {
    it("should clear the httpOnly token cookie and return 200", async () => {
      const res = await request(app).post("/api/v1/auth/logout");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const setCookie = res.headers["set-cookie"] || [];
      expect(setCookie.some((c) => c.startsWith("token=;") && c.includes("Expires="))).toBe(true);
    });

    it("should reject access to student and instructor protected routes once cookie/token is cleared", async () => {
      const agent = request.agent(app);

      // Simulate login setting httpOnly cookie for a Student
      const hashedPassword = await bcrypt.hash("pass1234", 10);
      User.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "student_logout_test",
          email: "student_logout@test.com",
          password: hashedPassword,
          accountType: "Student",
          firstName: "Stu",
          lastName: "Dent",
        }),
      });

      const loginRes = await agent
        .post("/api/v1/auth/login")
        .send({ email: "student_logout@test.com", password: "pass1234" });
      expect(loginRes.status).toBe(200);

      // Logout clears the cookie in the agent jar
      const logoutRes = await agent.post("/api/v1/auth/logout");
      expect(logoutRes.status).toBe(200);

      // Protected student & instructor routes must now return 401
      const profileRes = await agent.get("/api/v1/profile/getUserDetails");
      expect(profileRes.status).toBe(401);

      const instructorRes = await agent.get("/api/v1/profile/instructorDashboard");
      expect(instructorRes.status).toBe(401);
    });
  });
});
