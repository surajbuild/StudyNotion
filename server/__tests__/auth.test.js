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

  describe("Consistent Password Policy Enforcement (GAP-007)", () => {
    const validBaseSignup = {
      firstName: "Policy",
      lastName: "Tester",
      email: "policy.tester@example.com",
      accountType: "Student",
      otp: "123456",
    };

    const makeAuthToken = (id = "user_policy_1", accountType = "Student") =>
      jwt.sign(
        { id, email: "policy@example.com", accountType },
        process.env.JWT_SECRET || "test-jwt-secret-for-tests"
      );

    describe("POST /api/v1/auth/signup policy enforcement", () => {
      it("should reject a 7-character password on Student signup via direct API call (400)", async () => {
        const res = await request(app)
          .post("/api/v1/auth/signup")
          .send({ ...validBaseSignup, password: "short7!", confirmPassword: "short7!" });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/at least 8 characters/i);
        expect(User.create).not.toHaveBeenCalled();
      });

      it("should reject a 7-character password on Instructor signup via direct API call (400)", async () => {
        const res = await request(app)
          .post("/api/v1/auth/signup")
          .send({
            ...validBaseSignup,
            accountType: "Instructor",
            password: "inst123",
            confirmPassword: "inst123",
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/at least 8 characters/i);
        expect(User.create).not.toHaveBeenCalled();
      });

      it("should reject a whitespace-only 8-character password on signup (400)", async () => {
        const res = await request(app)
          .post("/api/v1/auth/signup")
          .send({ ...validBaseSignup, password: "        ", confirmPassword: "        " });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/cannot be empty/i);
        expect(User.create).not.toHaveBeenCalled();
      });

      it("should reject a non-string password payload on signup (400)", async () => {
        const res = await request(app)
          .post("/api/v1/auth/signup")
          .send({ ...validBaseSignup, password: 12345678, confirmPassword: 12345678 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/valid string/i);
        expect(User.create).not.toHaveBeenCalled();
      });

      it("should accept an exact 8-character password on signup (200)", async () => {
        User.findOne.mockResolvedValue(null);
        OTP.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ otp: "123456", createdAt: new Date() }]),
          }),
        });
        Profile.create.mockResolvedValue({ _id: "profile_8" });
        User.create.mockResolvedValue({
          _id: "user_8",
          firstName: "Policy",
          lastName: "Tester",
          email: "policy.tester@example.com",
          accountType: "Instructor",
          additionalDetails: "profile_8",
        });

        const res = await request(app)
          .post("/api/v1/auth/signup")
          .send({
            ...validBaseSignup,
            accountType: "Instructor",
            password: "exact8ch",
            confirmPassword: "exact8ch",
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(User.create).toHaveBeenCalled();
      });
    });

    describe("POST /api/v1/auth/changepassword policy enforcement", () => {
      it("should reject a 7-character newPassword via direct API call (400)", async () => {
        const res = await request(app)
          .post("/api/v1/auth/changepassword")
          .set("Authorization", `Bearer ${makeAuthToken()}`)
          .send({
            oldPassword: "oldPassword123",
            newPassword: "1234567",
            confirmNewPassword: "1234567",
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/at least 8 characters/i);
        expect(User.findById).not.toHaveBeenCalled();
      });

      it("should reject whitespace-only and non-string newPassword payloads (400)", async () => {
        const wsRes = await request(app)
          .post("/api/v1/auth/changepassword")
          .set("Authorization", `Bearer ${makeAuthToken()}`)
          .send({
            oldPassword: "oldPassword123",
            newPassword: "        ",
            confirmNewPassword: "        ",
          });
        expect(wsRes.status).toBe(400);
        expect(wsRes.body.message).toMatch(/cannot be empty/i);

        const nonStrRes = await request(app)
          .post("/api/v1/auth/changepassword")
          .set("Authorization", `Bearer ${makeAuthToken()}`)
          .send({
            oldPassword: "oldPassword123",
            newPassword: { $ne: "" },
            confirmNewPassword: { $ne: "" },
          });
        expect(nonStrRes.status).toBe(400);
      });

      it("should allow a legacy user with a <8-char oldPassword to upgrade to an 8-char newPassword (200)", async () => {
        const legacyHash = await bcrypt.hash("old5!", 10);
        const saveMock = jest.fn().mockResolvedValue(true);
        User.findById.mockResolvedValue({
          _id: "legacy_user_1",
          email: "legacy@example.com",
          firstName: "Legacy",
          password: legacyHash,
          save: saveMock,
        });

        const res = await request(app)
          .post("/api/v1/auth/changepassword")
          .set("Authorization", `Bearer ${makeAuthToken("legacy_user_1")}`)
          .send({
            oldPassword: "old5!",
            newPassword: "new8char",
            confirmNewPassword: "new8char",
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(saveMock).toHaveBeenCalledTimes(1);
      });

      it("should reject incorrect current password on changepassword (401)", async () => {
        const currentHash = await bcrypt.hash("currentPass9", 10);
        User.findById.mockResolvedValue({
          _id: "user_policy_1",
          email: "policy@example.com",
          password: currentHash,
          save: jest.fn(),
        });

        const res = await request(app)
          .post("/api/v1/auth/changepassword")
          .set("Authorization", `Bearer ${makeAuthToken()}`)
          .send({
            oldPassword: "wrongCurrent",
            newPassword: "updatedPass9",
            confirmNewPassword: "updatedPass9",
          });

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/incorrect/i);
      });

      it("should gracefully reject changepassword for accounts without a local password hash (400)", async () => {
        User.findById.mockResolvedValue({
          _id: "oauth_user_1",
          email: "oauth@example.com",
          password: null,
          save: jest.fn(),
        });

        const res = await request(app)
          .post("/api/v1/auth/changepassword")
          .set("Authorization", `Bearer ${makeAuthToken("oauth_user_1")}`)
          .send({
            oldPassword: "anyPassword",
            newPassword: "newValidPass8",
            confirmNewPassword: "newValidPass8",
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/without a local password/i);
      });
    });

    describe("POST /api/v1/auth/reset-password policy & token guards", () => {
      it("should reject missing, empty, or null token without querying User.findOne (400)", async () => {
        for (const badToken of [undefined, null, "", "   ", { $ne: null }]) {
          User.findOne.mockClear();
          const res = await request(app)
            .post("/api/v1/auth/reset-password")
            .send({
              password: "validReset8",
              confirmPassword: "validReset8",
              token: badToken,
            });

          expect(res.status).toBe(400);
          expect(res.body.success).toBe(false);
          expect(res.body.message).toMatch(/token is required/i);
          expect(User.findOne).not.toHaveBeenCalled();
        }
      });

      it("should reject a 7-character password on reset-password via direct API call (400)", async () => {
        const res = await request(app)
          .post("/api/v1/auth/reset-password")
          .send({
            password: "short77",
            confirmPassword: "short77",
            token: "valid-reset-token",
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/at least 8 characters/i);
        expect(User.findOne).not.toHaveBeenCalled();
      });

      it("should reject an invalid reset token with a valid 8-char password (401)", async () => {
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
          .post("/api/v1/auth/reset-password")
          .send({
            password: "validPass8",
            confirmPassword: "validPass8",
            token: "non-existent-token",
          });

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/invalid/i);
      });

      it("should accept an exact 8-character password with valid token and clear token fields (200)", async () => {
        User.findOne.mockResolvedValue({
          _id: "user_reset_ok",
          token: "valid-token-uuid",
          resetPasswordExpires: Date.now() + 60_000,
        });
        User.findOneAndUpdate.mockResolvedValue({ _id: "user_reset_ok" });

        const res = await request(app)
          .post("/api/v1/auth/reset-password")
          .send({
            password: "exact8ch",
            confirmPassword: "exact8ch",
            token: "valid-token-uuid",
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(User.findOneAndUpdate).toHaveBeenCalledWith(
          { _id: "user_reset_ok", token: "valid-token-uuid" },
          expect.objectContaining({
            password: expect.any(String),
            token: null,
            resetPasswordExpires: null,
          }),
          { new: true }
        );
      });
    });

    describe("POST /api/v1/auth/login legacy & OAuth safety", () => {
      it("should NOT lock out existing users whose historical password is shorter than 8 characters (200)", async () => {
        const legacyHash = await bcrypt.hash("old5!", 10);
        User.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            _id: "legacy_login_1",
            email: "legacy.login@example.com",
            password: legacyHash,
            accountType: "Student",
            firstName: "Legacy",
            lastName: "User",
          }),
        });

        const res = await request(app)
          .post("/api/v1/auth/login")
          .send({ email: "legacy.login@example.com", password: "old5!" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
      });

      it("should return 401 safely when an account has no local password hash (OAuth-style)", async () => {
        User.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            _id: "oauth_only_1",
            email: "oauth.only@example.com",
            password: null,
            accountType: "Student",
          }),
        });

        const res = await request(app)
          .post("/api/v1/auth/login")
          .send({ email: "oauth.only@example.com", password: "anyPassword123" });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/not enabled/i);
      });
    });
  });

  describe("GAP-002 Instructor Approval Signup Policy & Privilege Escalation Protection", () => {
    const mailSender = require("../utils/mailSender");

    const mockValidOtp = () => {
      User.findOne.mockResolvedValue(null);
      OTP.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ otp: "123456", createdAt: new Date() }]),
        }),
      });
      Profile.create.mockResolvedValue({ _id: "prof_new" });
    };

    it("should assign PENDING approvalStatus on instructor signup and ignore client-supplied APPROVED/approved", async () => {
      mockValidOtp();
      User.create.mockImplementation(async (doc) => ({ _id: "inst_new_1", ...doc }));

      const res = await request(app).post("/api/v1/auth/signup").send({
        firstName: "New",
        lastName: "Instructor",
        email: "new.inst@example.com",
        password: "ValidPassword1!",
        confirmPassword: "ValidPassword1!",
        accountType: "Instructor",
        otp: "123456",
        approved: true,
        approvalStatus: "APPROVED",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountType: "Instructor",
          approvalStatus: "PENDING",
          approved: false,
        })
      );
      expect(res.body.user.approvalStatus).toBe("PENDING");
      expect(res.body.user.approved).toBe(false);
      expect(res.body.user.password).toBeUndefined();
      expect(mailSender).toHaveBeenCalledWith(
        "new.inst@example.com",
        expect.stringMatching(/Application Received/i),
        expect.any(String)
      );
    });

    it("should still succeed instructor signup if application-received email fails", async () => {
      mockValidOtp();
      mailSender.mockRejectedValueOnce(new Error("SMTP offline"));
      User.create.mockImplementation(async (doc) => ({ _id: "inst_new_2", ...doc }));

      const res = await request(app).post("/api/v1/auth/signup").send({
        firstName: "Resilient",
        lastName: "Instructor",
        email: "resilient.inst@example.com",
        password: "ValidPassword1!",
        confirmPassword: "ValidPassword1!",
        accountType: "Instructor",
        otp: "123456",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.approvalStatus).toBe("PENDING");
    });

    it("should reject public signup attempting to create an Admin account with 403", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({
        firstName: "Evil",
        lastName: "Admin",
        email: "evil.admin@example.com",
        password: "ValidPassword1!",
        confirmPassword: "ValidPassword1!",
        accountType: "Admin",
        otp: "123456",
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Administrator accounts cannot be created/i);
      expect(User.create).not.toHaveBeenCalled();
    });

    it("should reject signup with invalid accountType with 400", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({
        firstName: "Bad",
        lastName: "Role",
        email: "bad.role@example.com",
        password: "ValidPassword1!",
        confirmPassword: "ValidPassword1!",
        accountType: "SuperUser",
        otp: "123456",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(User.create).not.toHaveBeenCalled();
    });

    it("should keep student signup unaffected (approved=true, no instructor approvalStatus)", async () => {
      mockValidOtp();
      User.create.mockImplementation(async (doc) => ({ _id: "stu_new_1", ...doc }));

      const res = await request(app).post("/api/v1/auth/signup").send({
        firstName: "Normal",
        lastName: "Student",
        email: "normal.student@example.com",
        password: "ValidPassword1!",
        confirmPassword: "ValidPassword1!",
        accountType: "Student",
        otp: "123456",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountType: "Student",
          approved: true,
        })
      );
      expect(User.create.mock.calls[0][0].approvalStatus).toBeUndefined();
    });
  });
});
