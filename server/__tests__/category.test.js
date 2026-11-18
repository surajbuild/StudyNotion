const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/Category");
jest.mock("../models/Course");

const Category = require("../models/Category");
const Course = require("../models/Course");
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
});
