const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/Category");
jest.mock("../models/Course");
jest.mock("../models/User");

const Category = require("../models/Category");
const Course = require("../models/Course");
const User = require("../models/User");
const app = require("../index");

describe("Category Endpoints (server/controllers/Category.js)", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-tests";
  const adminToken = jwt.sign(
    { id: "admin_1", email: "admin@test.com", accountType: "Admin" },
    JWT_SECRET
  );
  const studentToken = jwt.sign(
    { id: "student_1", email: "student@test.com", accountType: "Student" },
    JWT_SECRET
  );
  const instructorToken = jwt.sign(
    { id: "inst_1", email: "inst@test.com", accountType: "Instructor" },
    JWT_SECRET
  );
  const expiredAdminToken = jwt.sign(
    { id: "admin_1", email: "admin@test.com", accountType: "Admin" },
    JWT_SECRET,
    { expiresIn: "-10s" }
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/course/createCategory", () => {
    it("should return 403 Forbidden if non-admin tries to create category", async () => {
      const res = await request(app)
        .post("/api/v1/course/createCategory")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ name: "Web Dev" });

      expect(res.status).toBe(403);
    });

    it("should return 400 if name is missing", async () => {
      const res = await request(app)
        .post("/api/v1/course/createCategory")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/All fields are required/i);
    });

    it("should allow admin to create a category", async () => {
      Category.create.mockResolvedValue({
        _id: "cat_1",
        name: "Web Development",
        description: "All web dev courses",
      });

      const res = await request(app)
        .post("/api/v1/course/createCategory")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Web Development", description: "All web dev courses" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Web Development");
    });
  });

  describe("GET /api/v1/course/showAllCategories", () => {
    it("should return all categories", async () => {
      Category.find.mockResolvedValue([
        { _id: "c1", name: "Python" },
        { _id: "c2", name: "JavaScript" },
      ]);

      const res = await request(app).get("/api/v1/course/showAllCategories");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe("POST /api/v1/course/getCategoryPageDetails", () => {
    it("should return 404 if category is not found", async () => {
      Category.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .post("/api/v1/course/getCategoryPageDetails")
        .send({ categoryId: "nonexistent_cat" });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Category not found/i);
    });

    it("should return 200 with selectedCategory even if it has 0 courses", async () => {
      const emptyCat = {
        _id: "cat_empty",
        name: "Empty Category",
        courses: [],
      };
      Category.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(emptyCat),
      });
      Category.find.mockResolvedValue([]);
      Course.aggregate.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/v1/course/getCategoryPageDetails")
        .send({ categoryId: "cat_empty" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.selectedCategory.courses).toHaveLength(0);
    });
  });

  describe("Admin Category CRUD & Security (GAP-001)", () => {
    const validCatId = "507f1f77bcf86cd799439011";

    it("should reject unauthenticated, expired JWT, student, and instructor requests on admin endpoints", async () => {
      const endpoints = [
        { method: "get", path: "/api/v1/course/adminDashboard" },
        { method: "post", path: "/api/v1/course/createCategory", body: { name: "AI" } },
        { method: "put", path: "/api/v1/course/updateCategory", body: { categoryId: validCatId, name: "AI" } },
        { method: "delete", path: "/api/v1/course/deleteCategory", body: { categoryId: validCatId } },
      ];

      for (const ep of endpoints) {
        const unauthRes = await request(app)[ep.method](ep.path).send(ep.body || {});
        expect(unauthRes.status).toBe(401);

        const expiredRes = await request(app)
          [ep.method](ep.path)
          .set("Authorization", `Bearer ${expiredAdminToken}`)
          .send(ep.body || {});
        expect(expiredRes.status).toBe(401);

        const studentRes = await request(app)
          [ep.method](ep.path)
          .set("Authorization", `Bearer ${studentToken}`)
          .send(ep.body || {});
        expect(studentRes.status).toBe(403);

        const instructorRes = await request(app)
          [ep.method](ep.path)
          .set("Authorization", `Bearer ${instructorToken}`)
          .send(ep.body || {});
        expect(instructorRes.status).toBe(403);
      }
    });

    it("should reject duplicate category name or slug collision on createCategory with 409", async () => {
      Category.find.mockResolvedValue([{ _id: validCatId, name: "Web Dev" }]);

      const dupRes = await request(app)
        .post("/api/v1/course/createCategory")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "web-dev", description: "Duplicate slug" });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.success).toBe(false);
      expect(Category.create).not.toHaveBeenCalled();
    });

    it("should reject invalid or symbol-only category name with 400", async () => {
      const shortRes = await request(app)
        .post("/api/v1/course/createCategory")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "A" });
      expect(shortRes.status).toBe(400);

      const symbolRes = await request(app)
        .post("/api/v1/course/createCategory")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "!!!" });
      expect(symbolRes.status).toBe(400);
    });

    it("should validate categoryId, prevent duplicates, and update category cleanly", async () => {
      const badIdRes = await request(app)
        .put("/api/v1/course/updateCategory")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ categoryId: "bad-id", name: "Valid Name" });
      expect(badIdRes.status).toBe(400);

      Category.findById.mockResolvedValueOnce(null);
      const notFoundRes = await request(app)
        .put("/api/v1/course/updateCategory")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ categoryId: validCatId, name: "Valid Name" });
      expect(notFoundRes.status).toBe(404);

      Category.findById.mockResolvedValueOnce({
        _id: validCatId,
        name: "Old Name",
        courses: ["course_1"],
      });
      Category.find.mockResolvedValueOnce([{ _id: "507f1f77bcf86cd799439022", name: "Cloud" }]);
      const dupUpdateRes = await request(app)
        .put("/api/v1/course/updateCategory")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ categoryId: validCatId, name: "cloud" });
      expect(dupUpdateRes.status).toBe(409);

      Category.findById.mockResolvedValueOnce({
        _id: validCatId,
        name: "Old Name",
        courses: ["course_1"],
      });
      Category.find.mockResolvedValueOnce([]);
      Category.findByIdAndUpdate.mockResolvedValueOnce({
        _id: validCatId,
        name: "Updated Name",
        description: "Updated desc",
        courses: ["course_1"],
      });

      const okRes = await request(app)
        .put("/api/v1/course/updateCategory")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ categoryId: validCatId, name: "Updated Name", description: "Updated desc" });

      expect(okRes.status).toBe(200);
      expect(okRes.body.success).toBe(true);
      expect(okRes.body.data.name).toBe("Updated Name");
      expect(okRes.body.data.courses).toEqual(["course_1"]);
    });

    it("should block deleting a category with associated courses (409) and allow deleting empty categories (200)", async () => {
      const badIdRes = await request(app)
        .delete("/api/v1/course/deleteCategory")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ categoryId: "invalid" });
      expect(badIdRes.status).toBe(400);

      Category.findById.mockResolvedValueOnce({
        _id: validCatId,
        name: "Web Dev",
        courses: ["c1", "c2"],
      });
      Course.countDocuments.mockResolvedValueOnce(2);

      const blockedRes = await request(app)
        .delete("/api/v1/course/deleteCategory")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ categoryId: validCatId });

      expect(blockedRes.status).toBe(409);
      expect(blockedRes.body.associatedCourseCount).toBe(2);
      expect(Category.findByIdAndDelete).not.toHaveBeenCalled();

      Category.findById.mockResolvedValueOnce({
        _id: validCatId,
        name: "Unused Topic",
        courses: [],
      });
      Course.countDocuments.mockResolvedValueOnce(0);
      Category.findByIdAndDelete.mockResolvedValueOnce({ _id: validCatId });

      const okRes = await request(app)
        .delete("/api/v1/course/deleteCategory")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ categoryId: validCatId });

      expect(okRes.status).toBe(200);
      expect(okRes.body.success).toBe(true);
      expect(Category.findByIdAndDelete).toHaveBeenCalledWith(validCatId);
    });

    it("should return admin dashboard overview stats and enriched categories", async () => {
      Category.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: validCatId, name: "Web Dev", description: "Web" },
          ]),
        }),
      });
      Course.aggregate.mockResolvedValue([
        { _id: validCatId, totalCourseCount: 3, publishedCourseCount: 2 },
      ]);
      Course.countDocuments
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      User.countDocuments
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/course/adminDashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stats).toEqual({
        totalCategories: 1,
        emptyCategories: 0,
        totalCourses: 3,
        publishedCourses: 2,
        draftCourses: 1,
        totalUsers: 15,
        totalStudents: 10,
        totalInstructors: 4,
        totalAdmins: 1,
      });
      expect(res.body.data.categories[0].totalCourseCount).toBe(3);
      expect(res.body.data.categories[0].slug).toBe("web-dev");
    });
  });
});
