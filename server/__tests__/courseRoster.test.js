const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/Course");
jest.mock("../models/User");
jest.mock("../models/CourseProgress");
jest.mock("../models/Order");

const Course = require("../models/Course");
const User = require("../models/User");
const CourseProgress = require("../models/CourseProgress");
const Order = require("../models/Order");
const {
  extractCourseLectureIds,
  calculateCourseProgress,
} = require("../utils/courseProgressHelper");
const app = require("../index");

describe("Instructor Student Roster & Progress Tracking (F-INS-11)", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-tests";
  const ownerInstId = "507f1f77bcf86cd799439011";
  const otherInstId = "507f1f77bcf86cd799439012";
  const studentId1 = "507f1f77bcf86cd799439021";
  const studentId2 = "507f1f77bcf86cd799439022";
  const adminId = "507f1f77bcf86cd799439001";
  const validCourseId = "507f1f77bcf86cd799439099";

  const ownerToken = jwt.sign(
    { id: ownerInstId, email: "owner@test.com", accountType: "Instructor" },
    JWT_SECRET
  );
  const otherInstToken = jwt.sign(
    { id: otherInstId, email: "other@test.com", accountType: "Instructor" },
    JWT_SECRET
  );
  const studentToken = jwt.sign(
    { id: studentId1, email: "student1@test.com", accountType: "Student" },
    JWT_SECRET
  );
  const adminToken = jwt.sign(
    { id: adminId, email: "admin@test.com", accountType: "Admin" },
    JWT_SECRET
  );
  const expiredToken = jwt.sign(
    { id: ownerInstId, email: "owner@test.com", accountType: "Instructor" },
    JWT_SECRET,
    { expiresIn: "-5s" }
  );

  const mockCourseQuery = (courseDoc) => {
    Course.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(courseDoc),
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockResolvedValue({
      _id: ownerInstId,
      accountType: "Instructor",
      approvalStatus: "APPROVED",
      approved: true,
    });
  });

  describe("Shared Progress Helper (courseProgressHelper.js)", () => {
    it("handles zero lectures, duplicates, deleted lectures, and caps completion at 100%", () => {
      // Zero lectures
      expect(calculateCourseProgress(new Set(), [{ completedVideos: ["sub1"] }])).toEqual({
        totalLectures: 0,
        completedLectures: 0,
        remainingLectures: 0,
        completionPercentage: 0,
      });

      // Extract lecture IDs safely ignoring null sections/subsections
      const ids = extractCourseLectureIds({
        courseContent: [
          null,
          { subSection: [{ _id: "sub1" }, null, { _id: "sub2" }] },
          { subSection: [{ _id: "sub3" }, { _id: "sub1" }] }, // dup sub1
        ],
      });
      expect(ids.size).toBe(3);

      // Duplicate CourseProgress docs + repeated IDs + deleted/unrelated lecture IDs
      const progress = calculateCourseProgress(ids, [
        { completedVideos: ["sub1", "sub1", "deleted_sub_999"] },
        { completedVideos: ["sub1", "sub2"] },
      ]);
      expect(progress).toEqual({
        totalLectures: 3,
        completedLectures: 2,
        remainingLectures: 1,
        completionPercentage: 66.67,
      });
    });
  });

  describe("Authorization, Ownership & Validation Guards", () => {
    it("rejects unauthenticated and expired JWT requests with 401", async () => {
      const noAuth = await request(app).get(`/api/v1/course/${validCourseId}/enrolled-students`);
      expect(noAuth.status).toBe(401);

      const expired = await request(app)
        .get(`/api/v1/course/${validCourseId}/enrolled-students`)
        .set("Authorization", `Bearer ${expiredToken}`);
      expect(expired.status).toBe(401);
    });

    it("rejects Student, Admin, PENDING instructor, and REJECTED instructor with 403", async () => {
      expect(
        (
          await request(app)
            .get(`/api/v1/course/${validCourseId}/enrolled-students`)
            .set("Authorization", `Bearer ${studentToken}`)
        ).status
      ).toBe(403);

      expect(
        (
          await request(app)
            .get(`/api/v1/course/${validCourseId}/enrolled-students`)
            .set("Authorization", `Bearer ${adminToken}`)
        ).status
      ).toBe(403);

      User.findById.mockResolvedValueOnce({
        _id: ownerInstId,
        accountType: "Instructor",
        approvalStatus: "PENDING",
        approved: false,
      });
      const pendingRes = await request(app)
        .get(`/api/v1/course/${validCourseId}/enrolled-students`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(pendingRes.status).toBe(403);
      expect(pendingRes.body.code).toBe("INSTRUCTOR_PENDING_APPROVAL");

      User.findById.mockResolvedValueOnce({
        _id: ownerInstId,
        accountType: "Instructor",
        approvalStatus: "REJECTED",
        approved: false,
      });
      const rejectedRes = await request(app)
        .get(`/api/v1/course/${validCourseId}/enrolled-students`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(rejectedRes.status).toBe(403);
      expect(rejectedRes.body.code).toBe("INSTRUCTOR_REJECTED");
    });

    it("validates courseId (400), rejects unsafe query keys (400), and returns 404 for missing course", async () => {
      const badId = await request(app)
        .get("/api/v1/course/invalid-id/enrolled-students")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(badId.status).toBe(400);

      const badQuery = await request(app)
        .get(`/api/v1/course/${validCourseId}/enrolled-students?search[$ne]=a`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(badQuery.status).toBe(400);

      mockCourseQuery(null);
      const notFound = await request(app)
        .get(`/api/v1/course/${validCourseId}/enrolled-students`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(notFound.status).toBe(404);
    });

    it("blocks another approved instructor from accessing a course they do not own (even with spoofed instructorId)", async () => {
      User.findById.mockResolvedValueOnce({
        _id: otherInstId,
        accountType: "Instructor",
        approvalStatus: "APPROVED",
        approved: true,
      });
      mockCourseQuery({
        _id: validCourseId,
        courseName: "Owner Course",
        instructor: ownerInstId,
        studentEnrolled: [studentId1],
        courseContent: [],
      });

      const res = await request(app)
        .get(`/api/v1/course/${validCourseId}/enrolled-students`)
        .query({ instructorId: ownerInstId })
        .set("Authorization", `Bearer ${otherInstToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/permission/i);
      expect(User.find).not.toHaveBeenCalled();
    });
  });

  describe("Roster Data, Enrollment Dates, Progress Calculation & Pagination", () => {
    it("returns clean empty roster when course has 0 enrolled students", async () => {
      mockCourseQuery({
        _id: validCourseId,
        courseName: "Empty Roster Course",
        status: "Published",
        instructor: ownerInstId,
        studentEnrolled: [],
        courseContent: [{ subSection: [{ _id: "sub1" }, { _id: "sub2" }] }],
      });

      const res = await request(app)
        .get(`/api/v1/course/${validCourseId}/enrolled-students`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.students).toEqual([]);
      expect(res.body.data.summary).toEqual({
        totalEnrolled: 0,
        totalLectures: 2,
        averageCompletionPercentage: 0,
        completedStudentsCount: 0,
      });
    });

    it("returns accurate progress, authoritative enrollment dates (and null when unavailable), and strips sensitive fields", async () => {
      const enrolledDate1 = new Date("2026-11-10T10:00:00.000Z");
      const orderDate2 = new Date("2026-11-12T12:00:00.000Z");

      mockCourseQuery({
        _id: validCourseId,
        courseName: "Full-Stack MERN",
        status: "Published",
        thumbnail: "https://example.com/thumb.png",
        instructor: ownerInstId,
        studentEnrolled: [studentId1, studentId2],
        courseContent: [
          { subSection: [{ _id: "sub1" }, { _id: "sub2" }] },
        ],
      });

      User.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: studentId1,
            firstName: "Alice",
            lastName: "Learner",
            email: "alice@test.com",
            image: "https://example.com/a.png",
          },
          {
            _id: studentId2,
            firstName: "Bob",
            lastName: "Coder",
            email: "bob@test.com",
            image: "https://example.com/b.png",
          },
        ]),
      });
      User.countDocuments.mockResolvedValue(2);

      // Alice has duplicate completedVideos + deleted lecture ref + explicit enrolledAt; Bob has 2/2 via Order fallback
      CourseProgress.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            userId: studentId1,
            completedVideos: ["sub1", "sub1", "deleted_sub"],
            enrolledAt: enrolledDate1,
          },
          {
            userId: studentId2,
            completedVideos: ["sub1", "sub2"],
            enrolledAt: null,
          },
        ]),
      });

      Order.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { user: studentId2, paidAt: orderDate2, createdAt: orderDate2 },
        ]),
      });

      const res = await request(app)
        .get(`/api/v1/course/${validCourseId}/enrolled-students`)
        .query({ page: "1", limit: "10" })
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toEqual({
        totalEnrolled: 2,
        totalLectures: 2,
        averageCompletionPercentage: 75,
        completedStudentsCount: 1,
      });

      const [alice, bob] = res.body.data.students;
      expect(alice.enrolledAt).toBe(enrolledDate1.toISOString());
      expect(alice.progress).toEqual({
        totalLectures: 2,
        completedLectures: 1,
        remainingLectures: 1,
        completionPercentage: 50,
      });
      expect(alice.password).toBeUndefined();
      expect(alice.token).toBeUndefined();

      expect(bob.enrolledAt).toBe(orderDate2.toISOString());
      expect(bob.progress).toEqual({
        totalLectures: 2,
        completedLectures: 2,
        remainingLectures: 0,
        completionPercentage: 100,
      });
    });

    it("handles 0-lecture courses and historical enrollments without fabricating enrollment dates", async () => {
      mockCourseQuery({
        _id: validCourseId,
        courseName: "Zero Lecture Draft",
        status: "Draft",
        instructor: ownerInstId,
        studentEnrolled: [studentId1],
        courseContent: [],
      });

      User.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: studentId1,
            firstName: "Legacy",
            lastName: "Student",
            email: "legacy@test.com",
            image: "https://example.com/l.png",
          },
        ]),
      });
      User.countDocuments.mockResolvedValue(1);
      CourseProgress.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Order.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await request(app)
        .get(`/api/v1/course/${validCourseId}/enrolled-students`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.students[0].enrolledAt).toBeNull();
      expect(res.body.data.students[0].progress).toEqual({
        totalLectures: 0,
        completedLectures: 0,
        remainingLectures: 0,
        completionPercentage: 0,
      });
    });
  });
});
