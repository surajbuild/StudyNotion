const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/User");
jest.mock("../models/Course");

const User = require("../models/User");
const Course = require("../models/Course");
const app = require("../index");

describe("Persistent Cart Endpoints (server/controllers/Cart.js — GAP-008)", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-tests";
  const studentToken = jwt.sign(
    { id: "507f1f77bcf86cd799439001", email: "student@test.com", accountType: "Student" },
    JWT_SECRET
  );
  const instructorToken = jwt.sign(
    { id: "507f1f77bcf86cd799439002", email: "inst@test.com", accountType: "Instructor" },
    JWT_SECRET
  );
  const adminToken = jwt.sign(
    { id: "507f1f77bcf86cd799439003", email: "admin@test.com", accountType: "Admin" },
    JWT_SECRET
  );

  const courseId1 = "507f1f77bcf86cd799439011";
  const courseId2 = "507f1f77bcf86cd799439012";

  const mockPopulatedCart = (userDoc) => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(userDoc),
        }),
      }),
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should enforce authentication (401) and Student-only RBAC (403) on cart endpoints", async () => {
    expect((await request(app).get("/api/v1/cart")).status).toBe(401);
    expect(
      (await request(app).get("/api/v1/cart").set("Authorization", `Bearer ${instructorToken}`))
        .status
    ).toBe(403);
    expect(
      (await request(app).post("/api/v1/cart/add").set("Authorization", `Bearer ${adminToken}`).send({ courseId: courseId1 }))
        .status
    ).toBe(403);
  });

  it("GET /api/v1/cart should return authoritative DB totals and prune unavailable/draft/enrolled courses", async () => {
    mockPopulatedCart({
      _id: "507f1f77bcf86cd799439001",
      courses: [courseId2],
      cart: [
        { _id: courseId1, courseName: "Valid Paid", price: 1199, status: "Published", studentEnrolled: [] },
        { _id: courseId2, courseName: "Already Enrolled", price: 500, status: "Published", studentEnrolled: [] },
        { _id: "507f1f77bcf86cd799439013", courseName: "Draft Course", price: 799, status: "Draft", studentEnrolled: [] },
      ],
    });
    User.findByIdAndUpdate.mockResolvedValue({});

    const res = await request(app)
      .get("/api/v1/cart")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.cart).toHaveLength(1);
    expect(res.body.data.total).toBe(1199);
    expect(res.body.data.totalItems).toBe(1);
    expect(res.body.data.removedUnavailableCount).toBe(2);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith("507f1f77bcf86cd799439001", {
      $set: { cart: [courseId1] },
    });
  });

  it("POST /api/v1/cart/add should reject invalid ID (400), Draft course (400), duplicate (409), and enrolled (409)", async () => {
    const badIdRes = await request(app)
      .post("/api/v1/cart/add")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: "bad-id" });
    expect(badIdRes.status).toBe(400);

    User.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ _id: "507f1f77bcf86cd799439001", cart: [], courses: [] }),
    });
    Course.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ _id: courseId1, status: "Draft", price: 999, studentEnrolled: [] }),
    });
    const draftRes = await request(app)
      .post("/api/v1/cart/add")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: courseId1 });
    expect(draftRes.status).toBe(400);

    User.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ _id: "507f1f77bcf86cd799439001", cart: [courseId1], courses: [] }),
    });
    Course.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ _id: courseId1, status: "Published", price: 999, studentEnrolled: [] }),
    });
    const dupRes = await request(app)
      .post("/api/v1/cart/add")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: courseId1 });
    expect(dupRes.status).toBe(409);

    User.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ _id: "507f1f77bcf86cd799439001", cart: [], courses: [courseId1] }),
    });
    Course.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ _id: courseId1, status: "Published", price: 999, studentEnrolled: [] }),
    });
    const enrolledRes = await request(app)
      .post("/api/v1/cart/add")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: courseId1 });
    expect(enrolledRes.status).toBe(409);
  });

  it("POST /api/v1/cart/add should persist course via $addToSet and return authoritative cart", async () => {
    User.findById
      .mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ _id: "507f1f77bcf86cd799439001", cart: [], courses: [] }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              _id: "507f1f77bcf86cd799439001",
              courses: [],
              cart: [{ _id: courseId1, courseName: "React", price: 999, status: "Published", studentEnrolled: [] }],
            }),
          }),
        }),
      });
    Course.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ _id: courseId1, status: "Published", price: 999, studentEnrolled: [] }),
    });
    User.findByIdAndUpdate.mockResolvedValue({});

    const res = await request(app)
      .post("/api/v1/cart/add")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: courseId1 });

    expect(res.status).toBe(200);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith("507f1f77bcf86cd799439001", {
      $addToSet: { cart: courseId1 },
    });
    expect(res.body.data.total).toBe(999);
    expect(res.body.data.totalItems).toBe(1);
  });

  it("DELETE /api/v1/cart/remove/:courseId should remove item and return updated totals", async () => {
    User.findByIdAndUpdate.mockResolvedValue({});
    mockPopulatedCart({ _id: "507f1f77bcf86cd799439001", courses: [], cart: [] });

    const res = await request(app)
      .delete(`/api/v1/cart/remove/${courseId1}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith("507f1f77bcf86cd799439001", {
      $pull: { cart: courseId1 },
    });
    expect(res.body.data.totalItems).toBe(0);
  });

  it("POST /api/v1/cart/sync should merge local IDs cleanly, deduplicating and skipping invalid IDs", async () => {
    User.findById
      .mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          _id: "507f1f77bcf86cd799439001",
          cart: [courseId1],
          courses: [],
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              _id: "507f1f77bcf86cd799439001",
              courses: [],
              cart: [
                { _id: courseId1, courseName: "C1", price: 500, status: "Published", studentEnrolled: [] },
                { _id: courseId2, courseName: "C2", price: 700, status: "Published", studentEnrolled: [] },
              ],
            }),
          }),
        }),
      });
    Course.find.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue([
        { _id: courseId1, studentEnrolled: [] },
        { _id: courseId2, studentEnrolled: [] },
      ]),
    });
    User.findByIdAndUpdate.mockResolvedValue({});

    const res = await request(app)
      .post("/api/v1/cart/sync")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseIds: [courseId1, courseId2, "not-an-objectid"] });

    expect(res.status).toBe(200);
    expect(res.body.data.mergedCount).toBe(1);
    expect(res.body.data.total).toBe(1200);
    expect(res.body.data.totalItems).toBe(2);
  });
});
