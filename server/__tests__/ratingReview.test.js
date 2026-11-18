const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/RatingAndReview");
jest.mock("../models/Course");

const RatingAndReview = require("../models/RatingAndReview");
const Course = require("../models/Course");
const app = require("../index");

describe("Rating and Review Endpoints (server/controllers/RatingAndReview.js)", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-tests";
  const studentToken = jwt.sign(
    { id: "student_1", email: "student@test.com", accountType: "Student" },
    JWT_SECRET
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/course/createRating", () => {
    it("should return 400 if rating is 0 or out of 1-5 bounds", async () => {
      const resZero = await request(app)
        .post("/api/v1/course/createRating")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: "c1", rating: 0, review: "Zero star attempt" });

      expect(resZero.status).toBe(400);
      expect(resZero.body.success).toBe(false);

      const resSix = await request(app)
        .post("/api/v1/course/createRating")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: "c1", rating: 6, review: "Out of bounds" });

      expect(resSix.status).toBe(400);
      expect(resSix.body.success).toBe(false);
    });

    it("should return 404 if student is not enrolled in the course", async () => {
      Course.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/course/createRating")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: "c1", rating: 5, review: "Great!" });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not enrolled/i);
    });

    it("should return 403 if student already reviewed the course", async () => {
      Course.findOne.mockResolvedValue({ _id: "c1" });
      RatingAndReview.findOne.mockResolvedValue({ _id: "rev_1" });

      const res = await request(app)
        .post("/api/v1/course/createRating")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: "c1", rating: 5, review: "Great!" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/already reviewed/i);
    });

    it("should create rating and update course with rating ID", async () => {
      Course.findOne.mockResolvedValue({ _id: "c1" });
      RatingAndReview.findOne.mockResolvedValue(null);
      RatingAndReview.create.mockResolvedValue({
        _id: "rev_new",
        rating: 5,
        review: "Awesome course!",
        course: "c1",
        user: "student_1",
      });
      Course.findByIdAndUpdate.mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/course/createRating")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: "c1", rating: 5, review: "Awesome course!" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Course.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe("GET /api/v1/course/getAverageRating", () => {
    it("should return 400 if courseId is missing", async () => {
      const res = await request(app).get("/api/v1/course/getAverageRating");
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Course ID is required/i);
    });

    it("should return average rating 0 when no ratings exist", async () => {
      RatingAndReview.aggregate.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/course/getAverageRating")
        .query({ courseId: "507f1f77bcf86cd799439011" });

      expect(res.status).toBe(200);
      expect(res.body.averageRating).toBe(0);
    });

    it("should return calculated average rating when ratings exist", async () => {
      RatingAndReview.aggregate.mockResolvedValue([
        { averageRating: 4.5, totalRatings: 10 },
      ]);

      const res = await request(app)
        .get("/api/v1/course/getAverageRating")
        .query({ courseId: "507f1f77bcf86cd799439011" });

      expect(res.status).toBe(200);
      expect(res.body.averageRating).toBe(4.5);
    });
  });

  describe("GET /api/v1/course/getReviews", () => {
    it("should fetch all reviews populated with user and course", async () => {
      RatingAndReview.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([
                  { _id: "r1", rating: 5, review: "Super" },
                ]),
              }),
            }),
          }),
        }),
      });

      const res = await request(app).get("/api/v1/course/getReviews");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });
});
