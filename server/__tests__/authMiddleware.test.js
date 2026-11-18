const jwt = require("jsonwebtoken");

jest.mock("../models/User");
const User = require("../models/User");
const {
  auth,
  isStudent,
  isInstructor,
  isApprovedInstructor,
  isAdmin,
} = require("../middlewares/auth");

describe("Auth Middleware (server/middlewares/auth.js)", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-tests";
  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  describe("auth middleware", () => {
    it("should return 401 if token is missing from headers, cookies, and body", async () => {
      const req = { header: jest.fn().mockReturnValue(null), cookies: {}, body: {} };
      const res = mockResponse();
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Authentication token is missing",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 if token is invalid or expired", async () => {
      const req = {
        header: jest.fn().mockReturnValue("Bearer invalid-garbage-token"),
        cookies: {},
        body: {},
      };
      const res = mockResponse();
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Token is invalid or has expired",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should authenticate and attach req.user if Bearer token is valid", async () => {
      const payload = { id: "user123", email: "student@test.com", accountType: "Student" };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

      const req = {
        header: jest.fn().mockReturnValue(`Bearer ${token}`),
        cookies: {},
        body: {},
      };
      const res = mockResponse();
      const next = jest.fn();

      await auth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe("user123");
      expect(req.user.accountType).toBe("Student");
    });

    it("should authenticate if token is present in cookie", async () => {
      const payload = { id: "cookieUser", accountType: "Instructor" };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

      const req = {
        header: jest.fn().mockReturnValue(null),
        cookies: { token },
        body: {},
      };
      const res = mockResponse();
      const next = jest.fn();

      await auth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe("cookieUser");
    });

    it("should reject token if only supplied in request body (SEC-006)", async () => {
      const payload = { id: "bodyUser", accountType: "Student" };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

      const req = {
        header: jest.fn().mockReturnValue(null),
        cookies: {},
        body: { token },
      };
      const res = mockResponse();
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Authentication token is missing",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject request with 401 and TOKEN_REVOKED if tokenVersion is stale (SEC-003)", async () => {
      const payload = { id: "revokedUser", accountType: "Student", tokenVersion: 0 };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: "revokedUser", tokenVersion: 1 }),
        }),
      });

      const req = {
        header: jest.fn().mockReturnValue(`Bearer ${token}`),
        cookies: {},
        body: {},
        __testRevocation: true,
      };
      const res = mockResponse();
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "TOKEN_REVOKED",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject legacy token without tokenVersion if DB user tokenVersion > 0 (SEC-003)", async () => {
      const payload = { id: "legacyUser", accountType: "Student" }; // no tokenVersion in payload
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: "legacyUser", tokenVersion: 1 }),
        }),
      });

      const req = {
        header: jest.fn().mockReturnValue(`Bearer ${token}`),
        cookies: {},
        body: {},
        __testRevocation: true,
      };
      const res = mockResponse();
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "TOKEN_REVOKED",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow legacy token without tokenVersion if DB user tokenVersion is 0 (SEC-003)", async () => {
      const payload = { id: "legacyUserZero", accountType: "Student" };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: "legacyUserZero", tokenVersion: 0 }),
        }),
      });

      const req = {
        header: jest.fn().mockReturnValue(`Bearer ${token}`),
        cookies: {},
        body: {},
        __testRevocation: true,
      };
      const res = mockResponse();
      const next = jest.fn();

      await auth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe("legacyUserZero");
    });

    it("should allow token with matching tokenVersion (SEC-003)", async () => {
      const payload = { id: "freshUser", accountType: "Student", tokenVersion: 3 };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: "freshUser", tokenVersion: 3 }),
        }),
      });

      const req = {
        header: jest.fn().mockReturnValue(`Bearer ${token}`),
        cookies: {},
        body: {},
        __testRevocation: true,
      };
      const res = mockResponse();
      const next = jest.fn();

      await auth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe("freshUser");
    });
  });

  describe("Role Verification Middlewares", () => {
    describe("isStudent", () => {
      it("should call next() if accountType is Student", async () => {
        const req = { user: { accountType: "Student" } };
        const res = mockResponse();
        const next = jest.fn();

        await isStudent(req, res, next);
        expect(next).toHaveBeenCalled();
      });

      it("should return 403 if accountType is Instructor", async () => {
        const req = { user: { accountType: "Instructor" } };
        const res = mockResponse();
        const next = jest.fn();

        await isStudent(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ success: false })
        );
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe("isInstructor", () => {
      it("should call next() if accountType is Instructor", async () => {
        const req = { user: { accountType: "Instructor" } };
        const res = mockResponse();
        const next = jest.fn();

        await isInstructor(req, res, next);
        expect(next).toHaveBeenCalled();
      });

      it("should return 403 if accountType is Student", async () => {
        const req = { user: { accountType: "Student" } };
        const res = mockResponse();
        const next = jest.fn();

        await isInstructor(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe("isAdmin", () => {
      it("should call next() if accountType is Admin", async () => {
        const req = { user: { accountType: "Admin" } };
        const res = mockResponse();
        const next = jest.fn();

        await isAdmin(req, res, next);
        expect(next).toHaveBeenCalled();
      });

      it("should return 403 if accountType is Student", async () => {
        const req = { user: { accountType: "Student" } };
        const res = mockResponse();
        const next = jest.fn();

        await isAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe("isApprovedInstructor (GAP-002 DB-backed enforcement)", () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it("should return 401 when req.user is missing", async () => {
        const req = {};
        const res = mockResponse();
        const next = jest.fn();

        await isApprovedInstructor(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      });

      it("should return 403 when non-instructor attempts access", async () => {
        const req = { user: { id: "stu1", accountType: "Student" } };
        const res = mockResponse();
        const next = jest.fn();

        await isApprovedInstructor(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(User.findById).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
      });

      it("should return 401 when DB user no longer exists", async () => {
        User.findById.mockResolvedValue(null);
        const req = { user: { id: "ghost_inst", accountType: "Instructor" } };
        const res = mockResponse();
        const next = jest.fn();

        await isApprovedInstructor(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      });

      it("should return 403 for PENDING instructor (ignoring any client body approval spoofing)", async () => {
        User.findById.mockResolvedValue({
          _id: "inst_pending",
          accountType: "Instructor",
          approvalStatus: "PENDING",
          approved: false,
        });
        const req = {
          user: { id: "inst_pending", accountType: "Instructor", approved: true },
          body: { approved: true, approvalStatus: "APPROVED" },
        };
        const res = mockResponse();
        const next = jest.fn();

        await isApprovedInstructor(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            code: "INSTRUCTOR_PENDING_APPROVAL",
            approvalStatus: "PENDING",
          })
        );
        expect(next).not.toHaveBeenCalled();
      });

      it("should return 403 for REJECTED instructor", async () => {
        User.findById.mockResolvedValue({
          _id: "inst_rejected",
          accountType: "Instructor",
          approvalStatus: "REJECTED",
          approved: false,
        });
        const req = { user: { id: "inst_rejected", accountType: "Instructor" } };
        const res = mockResponse();
        const next = jest.fn();

        await isApprovedInstructor(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            code: "INSTRUCTOR_REJECTED",
            approvalStatus: "REJECTED",
          })
        );
        expect(next).not.toHaveBeenCalled();
      });

      it("should call next() for APPROVED instructor", async () => {
        User.findById.mockResolvedValue({
          _id: "inst_ok",
          accountType: "Instructor",
          approvalStatus: "APPROVED",
          approved: true,
        });
        const req = { user: { id: "inst_ok", accountType: "Instructor" } };
        const res = mockResponse();
        const next = jest.fn();

        await isApprovedInstructor(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.instructorApprovalStatus).toBe("APPROVED");
      });

      it("should call next() for legacy pre-migration instructor missing approvalStatus", async () => {
        User.findById.mockResolvedValue({
          _id: "inst_legacy",
          accountType: "Instructor",
        });
        const req = { user: { id: "inst_legacy", accountType: "Instructor" } };
        const res = mockResponse();
        const next = jest.fn();

        await isApprovedInstructor(req, res, next);
        expect(next).toHaveBeenCalled();
      });
    });
  });
});
