const jwt = require("jsonwebtoken");
const { auth, isStudent, isInstructor, isAdmin } = require("../middlewares/auth");

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
  });
});
