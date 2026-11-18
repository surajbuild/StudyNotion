const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/SubSection");
jest.mock("../models/CourseProgress");

const SubSection = require("../models/SubSection");
const CourseProgress = require("../models/CourseProgress");
const app = require("../index");

describe("Course Progress Endpoint (server/controllers/courseProgress.js)", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-tests";
  const studentToken = jwt.sign(
    { id: "student_1", email: "student@test.com", accountType: "Student" },
    JWT_SECRET
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if courseId or subsectionId is missing", async () => {
    const res = await request(app)
      .post("/api/v1/course/updateCourseProgress")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: "c1" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it("should return 404 if subsection does not exist", async () => {
    SubSection.findById.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/v1/course/updateCourseProgress")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: "c1", subsectionId: "sub_not_found" });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Invalid SubSection/i);
  });

  it("should create new progress doc if first video ever completed", async () => {
    SubSection.findById.mockResolvedValue({ _id: "sub_1" });
    CourseProgress.findOne.mockResolvedValue(null);
    CourseProgress.create.mockResolvedValue({
      courseID: "c1",
      userId: "student_1",
      completedVideos: ["sub_1"],
    });

    const res = await request(app)
      .post("/api/v1/course/updateCourseProgress")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: "c1", subsectionId: "sub_1" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(CourseProgress.create).toHaveBeenCalled();
  });

  it("should return 200 without error if already completed", async () => {
    SubSection.findById.mockResolvedValue({ _id: "sub_1" });
    CourseProgress.findOne.mockResolvedValue({
      courseID: "c1",
      userId: "student_1",
      completedVideos: ["sub_1"],
    });

    const res = await request(app)
      .post("/api/v1/course/updateCourseProgress")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: "c1", subsectionId: "sub_1" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/already completed/i);
  });

  it("should add subsection to completedVideos if not yet completed", async () => {
    const mockProgress = {
      courseID: "c1",
      userId: "student_1",
      completedVideos: ["sub_1"],
      save: jest.fn().mockResolvedValue(true),
    };
    SubSection.findById.mockResolvedValue({ _id: "sub_2" });
    CourseProgress.findOne.mockResolvedValue(mockProgress);

    const res = await request(app)
      .post("/api/v1/course/updateCourseProgress")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: "c1", subsectionId: "sub_2" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockProgress.completedVideos).toContain("sub_2");
    expect(mockProgress.save).toHaveBeenCalled();
  });
});
