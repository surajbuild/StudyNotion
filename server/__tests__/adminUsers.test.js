const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../utils/mailSender", () => jest.fn().mockResolvedValue({ messageId: "mock-admin-mail" }));
jest.mock("../models/User");

const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const app = require("../index");

describe("Admin User Management & Instructor Approval Endpoints (server/controllers/AdminUsers.js)", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-tests";
  const adminId = "507f1f77bcf86cd799439001";
  const pendingInstId = "507f1f77bcf86cd799439011";
  const approvedInstId = "507f1f77bcf86cd799439012";
  const rejectedInstId = "507f1f77bcf86cd799439013";
  const studentId = "507f1f77bcf86cd799439021";

  const adminToken = jwt.sign(
    { id: adminId, email: "admin@test.com", accountType: "Admin" },
    JWT_SECRET
  );
  const studentToken = jwt.sign(
    { id: studentId, email: "student@test.com", accountType: "Student" },
    JWT_SECRET
  );
  const instructorToken = jwt.sign(
    { id: approvedInstId, email: "inst@test.com", accountType: "Instructor" },
    JWT_SECRET
  );
  const expiredAdminToken = jwt.sign(
    { id: adminId, email: "admin@test.com", accountType: "Admin" },
    JWT_SECRET,
    { expiresIn: "-5s" }
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authorization & Security Guards", () => {
    const protectedRoutes = [
      { method: "get", url: "/api/v1/admin/users/stats" },
      { method: "get", url: "/api/v1/admin/users" },
      { method: "get", url: `/api/v1/admin/users/${pendingInstId}` },
      { method: "get", url: "/api/v1/admin/instructors" },
      { method: "put", url: `/api/v1/admin/instructors/${pendingInstId}/approve` },
      { method: "put", url: `/api/v1/admin/instructors/${pendingInstId}/reject` },
    ];

    it("should reject unauthenticated, invalid JWT, and expired JWT requests with 401", async () => {
      for (const route of protectedRoutes) {
        const noAuth = await request(app)[route.method](route.url);
        expect(noAuth.status).toBe(401);

        const badJwt = await request(app)
          [route.method](route.url)
          .set("Authorization", "Bearer invalid.token.here");
        expect(badJwt.status).toBe(401);

        const expired = await request(app)
          [route.method](route.url)
          .set("Authorization", `Bearer ${expiredAdminToken}`);
        expect(expired.status).toBe(401);
      }
    });

    it("should reject Student and Instructor attempts (even with spoofed accountType body) with 403", async () => {
      for (const route of protectedRoutes) {
        const studentRes = await request(app)
          [route.method](route.url)
          .set("Authorization", `Bearer ${studentToken}`)
          .send({ accountType: "Admin" });
        expect(studentRes.status).toBe(403);

        const instructorRes = await request(app)
          [route.method](route.url)
          .set("Authorization", `Bearer ${instructorToken}`)
          .send({ accountType: "Admin" });
        expect(instructorRes.status).toBe(403);
      }
    });
  });

  describe("GET /api/v1/admin/users/stats", () => {
    it("should return complete user and instructor approval overview counts", async () => {
      User.countDocuments
        .mockResolvedValueOnce(20) // totalUsers
        .mockResolvedValueOnce(12) // totalStudents
        .mockResolvedValueOnce(7) // totalInstructors
        .mockResolvedValueOnce(1) // totalAdmins
        .mockResolvedValueOnce(2) // pendingInstructors
        .mockResolvedValueOnce(4) // approvedInstructors
        .mockResolvedValueOnce(1); // rejectedInstructors

      const res = await request(app)
        .get("/api/v1/admin/users/stats")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        totalUsers: 20,
        totalStudents: 12,
        totalInstructors: 7,
        totalAdmins: 1,
        pendingInstructors: 2,
        approvedInstructors: 4,
        rejectedInstructors: 1,
      });
    });
  });

  describe("GET /api/v1/admin/users & GET /api/v1/admin/instructors", () => {
    it("should return paginated, sanitized users without sensitive fields", async () => {
      const mockUsers = [
        {
          _id: pendingInstId,
          firstName: "Alice",
          lastName: "Mentor",
          email: "alice@test.com",
          accountType: "Instructor",
          approvalStatus: "PENDING",
          approved: false,
          password: "$2b$10$secretHashShouldNeverBeExposed",
          token: "secretResetToken",
          resetPasswordExpires: new Date(),
          courses: [],
          createdAt: new Date("2026-10-01T00:00:00Z"),
        },
      ];

      User.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUsers),
      });
      User.countDocuments.mockResolvedValue(1);

      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ search: "Alice", approvalStatus: "PENDING", page: "1", limit: "10" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toHaveLength(1);
      expect(res.body.data.users[0].email).toBe("alice@test.com");
      expect(res.body.data.users[0].approvalStatus).toBe("PENDING");
      expect(res.body.data.users[0].password).toBeUndefined();
      expect(res.body.data.users[0].token).toBeUndefined();
      expect(res.body.data.users[0].resetPasswordExpires).toBeUndefined();
      expect(res.body.data.pagination).toEqual({
        page: 1,
        limit: 10,
        totalUsers: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it("should reject unsafe operator query keys and invalid filter parameters with 400", async () => {
      const injectionRes = await request(app)
        .get("/api/v1/admin/users?search[$ne]=a")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(injectionRes.status).toBe(400);

      const badRoleRes = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ accountType: "Root" });
      expect(badRoleRes.status).toBe(400);

      const badStatusRes = await request(app)
        .get("/api/v1/admin/instructors")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ approvalStatus: "BANNED" });
      expect(badStatusRes.status).toBe(400);

      const badPageRes = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ page: "0" });
      expect(badPageRes.status).toBe(400);
    });
  });

  describe("GET /api/v1/admin/users/:userId", () => {
    it("should return 400 for invalid ObjectId and 404 when user does not exist", async () => {
      const invalidRes = await request(app)
        .get("/api/v1/admin/users/not-a-valid-id")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(invalidRes.status).toBe(400);

      User.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });
      const notFoundRes = await request(app)
        .get(`/api/v1/admin/users/${pendingInstId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(notFoundRes.status).toBe(404);
    });

    it("should return sanitized individual user details for valid userId", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: pendingInstId,
          firstName: "Jane",
          lastName: "Educator",
          email: "jane@test.com",
          accountType: "Instructor",
          approvalStatus: "PENDING",
          approved: false,
          password: "hidden",
          courses: ["c1", "c2"],
          additionalDetails: { _id: "p1", about: "10 years teaching", gender: "Female" },
        }),
      });

      const res = await request(app)
        .get(`/api/v1/admin/users/${pendingInstId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe("jane@test.com");
      expect(res.body.data.coursesCount).toBe(2);
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.additionalDetails.about).toBe("10 years teaching");
    });
  });

  describe("PUT /api/v1/admin/instructors/:userId/approve", () => {
    it("should approve a PENDING instructor, send email, and preserve accountType", async () => {
      const targetUser = {
        _id: pendingInstId,
        firstName: "Pending",
        lastName: "Teacher",
        email: "pending.teacher@test.com",
        accountType: "Instructor",
        approvalStatus: "PENDING",
        approved: false,
        save: jest.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValue(targetUser);

      const res = await request(app)
        .put(`/api/v1/admin/instructors/${pendingInstId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ accountType: "Admin" }); // Attempted role mutation must be ignored

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(targetUser.approvalStatus).toBe("APPROVED");
      expect(targetUser.approved).toBe(true);
      expect(targetUser.accountType).toBe("Instructor");
      expect(targetUser.save).toHaveBeenCalledTimes(1);
      expect(mailSender).toHaveBeenCalledWith(
        "pending.teacher@test.com",
        expect.stringMatching(/Approved/i),
        expect.any(String)
      );
    });

    it("should NOT roll back committed approval if email sending fails", async () => {
      const targetUser = {
        _id: pendingInstId,
        firstName: "Pending",
        lastName: "Teacher",
        email: "pending.mailfail@test.com",
        accountType: "Instructor",
        approvalStatus: "PENDING",
        approved: false,
        save: jest.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValue(targetUser);
      mailSender.mockRejectedValueOnce(new Error("SMTP unreachable"));

      const res = await request(app)
        .put(`/api/v1/admin/instructors/${pendingInstId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.emailSent).toBe(false);
      expect(targetUser.approvalStatus).toBe("APPROVED");
      expect(targetUser.save).toHaveBeenCalledTimes(1);
    });

    it("should reject duplicate approval (already APPROVED) with 409", async () => {
      User.findById.mockResolvedValue({
        _id: approvedInstId,
        accountType: "Instructor",
        approvalStatus: "APPROVED",
        approved: true,
      });

      const res = await request(app)
        .put(`/api/v1/admin/instructors/${approvedInstId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already approved/i);
    });

    it("should prevent admin self-approval (403), non-instructor approval (400), and invalid IDs (400)", async () => {
      const selfRes = await request(app)
        .put(`/api/v1/admin/instructors/${adminId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(selfRes.status).toBe(403);

      const invalidIdRes = await request(app)
        .put("/api/v1/admin/instructors/bad-id/approve")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(invalidIdRes.status).toBe(400);

      User.findById.mockResolvedValue({
        _id: studentId,
        accountType: "Student",
      });
      const studentTargetRes = await request(app)
        .put(`/api/v1/admin/instructors/${studentId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(studentTargetRes.status).toBe(400);
    });
  });

  describe("PUT /api/v1/admin/instructors/:userId/reject", () => {
    it("should reject a PENDING instructor with optional reason and send email", async () => {
      const targetUser = {
        _id: pendingInstId,
        firstName: "Pending",
        lastName: "Applicant",
        email: "applicant@test.com",
        accountType: "Instructor",
        approvalStatus: "PENDING",
        approved: false,
        save: jest.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValue(targetUser);

      const res = await request(app)
        .put(`/api/v1/admin/instructors/${pendingInstId}/reject`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Incomplete teaching portfolio" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(targetUser.approvalStatus).toBe("REJECTED");
      expect(targetUser.approved).toBe(false);
      expect(targetUser.rejectionReason).toBe("Incomplete teaching portfolio");
      expect(targetUser.save).toHaveBeenCalledTimes(1);
      expect(mailSender).toHaveBeenCalledWith(
        "applicant@test.com",
        expect.stringMatching(/Application Update/i),
        expect.stringContaining("Incomplete teaching portfolio")
      );
    });

    it("should reject unauthorized status transitions (APPROVED -> REJECTED) and duplicate rejections with 409", async () => {
      User.findById.mockResolvedValue({
        _id: approvedInstId,
        accountType: "Instructor",
        approvalStatus: "APPROVED",
        approved: true,
      });
      const approvedRejectRes = await request(app)
        .put(`/api/v1/admin/instructors/${approvedInstId}/reject`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(approvedRejectRes.status).toBe(409);

      User.findById.mockResolvedValue({
        _id: rejectedInstId,
        accountType: "Instructor",
        approvalStatus: "REJECTED",
        approved: false,
      });
      const dupRejectRes = await request(app)
        .put(`/api/v1/admin/instructors/${rejectedInstId}/reject`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(dupRejectRes.status).toBe(409);
    });

    it("should prevent admin self-rejection (403) and reject overly long reasons (400)", async () => {
      const selfRes = await request(app)
        .put(`/api/v1/admin/instructors/${adminId}/reject`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(selfRes.status).toBe(403);

      const longReasonRes = await request(app)
        .put(`/api/v1/admin/instructors/${pendingInstId}/reject`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "x".repeat(501) });
      expect(longReasonRes.status).toBe(400);
    });
  });
});
