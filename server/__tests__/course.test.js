const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/Course");
jest.mock("../models/User");
jest.mock("../models/Category");
jest.mock("../models/Section");
jest.mock("../models/SubSection");
jest.mock("../models/CourseProgress");
jest.mock("../utils/imageUploader", () => ({
  imageUploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: "https://cloudinary.com/fake.jpg" }),
}));

const Course = require("../models/Course");
const User = require("../models/User");
const Category = require("../models/Category");
const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const CourseProgress = require("../models/CourseProgress");
const app = require("../index");

describe("Course Endpoints (server/controllers/Course.js)", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-tests";
  const instructorToken = jwt.sign(
    { id: "instructor_123", email: "inst@test.com", accountType: "Instructor" },
    JWT_SECRET
  );
  const studentToken = jwt.sign(
    { id: "student_123", email: "stud@test.com", accountType: "Student" },
    JWT_SECRET
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/v1/course/getAllCourses", () => {
    it("should fetch all published courses successfully", async () => {
      const mockCourses = [
        { _id: "c1", courseName: "Course 1", price: 500, status: "Published" },
      ];
      Course.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockCourses),
        }),
      });

      const res = await request(app).get("/api/v1/course/getAllCourses");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe("POST /api/v1/course/getCourseDetails", () => {
    it("should return 400 if courseId is missing", async () => {
      const res = await request(app)
        .post("/api/v1/course/getCourseDetails")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Course ID is required/i);
    });

    it("should return 400 if course is not found", async () => {
      Course.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .post("/api/v1/course/getCourseDetails")
        .send({ courseId: "nonexistent_id" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Could not find course/i);
    });

    it("should return course details with calculated duration", async () => {
      const mockCourse = {
        _id: "c1",
        courseName: "MERN Stack",
        courseContent: [
          {
            subSection: [
              { timeDuration: "1800" }, // 30m
              { timeDuration: "3600" }, // 1h
            ],
          },
        ],
      };

      Course.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockCourse),
      });

      const res = await request(app)
        .post("/api/v1/course/getCourseDetails")
        .send({ courseId: "c1" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.courseDetails).toBeDefined();
      expect(res.body.data.totalDuration).toBe("1h 30m");
    });
  });

  describe("POST /api/v1/course/createCourse", () => {
    it("should reject student attempt with 403 Forbidden", async () => {
      const res = await request(app)
        .post("/api/v1/course/createCourse")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          courseName: "Test",
          courseDescription: "Desc",
          whatYouWillLearn: "Learn",
          price: 500,
        });

      expect(res.status).toBe(403);
    });

    it("should return 400 if mandatory fields are missing", async () => {
      const res = await request(app)
        .post("/api/v1/course/createCourse")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ courseName: "Test" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/mandatory/i);
    });

    it("should reject negative course price with 400", async () => {
      const res = await request(app)
        .post("/api/v1/course/createCourse")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          courseName: "Negative Course",
          courseDescription: "Desc",
          whatYouWillLearn: "Learn",
          price: -100,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/non-negative/i);
    });

    it("should allow creating a free course with price 0", async () => {
      User.findById.mockResolvedValue({
        _id: "instructor_123",
        accountType: "Instructor",
      });
      Course.create.mockResolvedValue({
        _id: "free_course_1",
        courseName: "Free Course",
        price: 0,
        status: "Draft",
      });
      User.findByIdAndUpdate.mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/course/createCourse")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          courseName: "Free Course",
          courseDescription: "Zero price course",
          whatYouWillLearn: "Basics",
          price: 0,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.price).toBe(0);
    });

    it("should successfully create a course for an instructor", async () => {
      User.findById.mockResolvedValue({
        _id: "instructor_123",
        accountType: "Instructor",
      });
      Category.findById.mockResolvedValue({ _id: "cat_1" });
      Course.create.mockResolvedValue({
        _id: "new_course_id",
        courseName: "Full Stack Course",
        instructor: "instructor_123",
        price: 999,
        status: "Draft",
      });
      User.findByIdAndUpdate.mockResolvedValue({});
      Category.findByIdAndUpdate.mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/course/createCourse")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          courseName: "Full Stack Course",
          courseDescription: "Detailed Description",
          whatYouWillLearn: "Everything",
          price: 999,
          category: "cat_1",
          tag: JSON.stringify(["React", "Node"]),
          instructions: JSON.stringify(["Basic JS", "Laptop"]),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe("new_course_id");
      expect(Course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: ["React", "Node"],
          instructions: ["Basic JS", "Laptop"],
        })
      );
    });
  });

  describe("POST /api/v1/course/editCourse (Security & Ownership)", () => {
    it("should reject edit if course does not belong to the instructor", async () => {
      Course.findById.mockResolvedValue({
        _id: "course_other",
        instructor: "different_instructor_999",
      });

      const res = await request(app)
        .post("/api/v1/course/editCourse")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ courseId: "course_other", courseName: "Hacked Course Name" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/permission/i);
    });

    it("should allow course edit if instructor owns the course", async () => {
      const mockCourse = {
        _id: "course_owned",
        instructor: "instructor_123",
        courseName: "Old Name",
        save: jest.fn().mockResolvedValue(true),
      };
      Course.findById.mockImplementation((id) => {
        if (id === "course_owned") {
          return {
            ...mockCourse,
            populate: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue({ ...mockCourse, courseName: "New Name" }),
          };
        }
        return null;
      });

      const res = await request(app)
        .post("/api/v1/course/editCourse")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ courseId: "course_owned", courseName: "New Name" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("DELETE /api/v1/course/deleteCourse (Cascade Cleanup)", () => {
    it("should return 403 if instructor does not own the course", async () => {
      Course.findById.mockResolvedValue({
        _id: "c_other",
        instructor: "other_id",
      });

      const res = await request(app)
        .delete("/api/v1/course/deleteCourse")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ courseId: "c_other" });

      expect(res.status).toBe(403);
    });

    it("should cascade delete sections, subsections, and pull course from user and category", async () => {
      const mockCourse = {
        _id: "c_owned",
        instructor: "instructor_123",
        courseContent: ["sec_1"],
        category: "cat_1",
      };
      Course.findById.mockResolvedValue(mockCourse);
      Section.find.mockResolvedValue([
        { _id: "sec_1", subSection: ["sub_1", "sub_2"] },
      ]);
      SubSection.deleteMany.mockResolvedValue({});
      Section.deleteMany.mockResolvedValue({});
      User.findByIdAndUpdate.mockResolvedValue({});
      Category.findByIdAndUpdate.mockResolvedValue({});
      User.updateMany.mockResolvedValue({});
      Course.findByIdAndDelete.mockResolvedValue({});

      const res = await request(app)
        .delete("/api/v1/course/deleteCourse")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ courseId: "c_owned" });

      expect(res.status).toBe(200);
      expect(SubSection.deleteMany).toHaveBeenCalled();
      expect(Section.deleteMany).toHaveBeenCalled();
      expect(User.findByIdAndUpdate).toHaveBeenCalled(); // cleaned up instructor
      expect(Course.findByIdAndDelete).toHaveBeenCalledWith("c_owned");
    });
  });

  describe("POST /api/v1/course/getFullCourseDetails (Access Control)", () => {
    it("should return 403 if student is not enrolled", async () => {
      const mockCourse = {
        _id: "c1",
        studentEnrolled: ["other_student_id"],
        courseContent: [],
      };
      Course.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockCourse),
      });

      const res = await request(app)
        .post("/api/v1/course/getFullCourseDetails")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: "c1" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not enrolled/i);
    });

    it("should allow enrolled student to get full course details", async () => {
      const mockCourse = {
        _id: "c1",
        studentEnrolled: ["student_123"],
        courseContent: [
          {
            subSection: [{ timeDuration: "60" }],
          },
        ],
      };
      Course.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockCourse),
      });
      CourseProgress.findOne.mockResolvedValue({
        completedVideos: ["vid_1"],
      });

      const res = await request(app)
        .post("/api/v1/course/getFullCourseDetails")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: "c1" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.completedVideos).toEqual(["vid_1"]);
    });
  });

  describe("GET /api/v1/course/search (GAP-004 Search, Filters, Sorting & Pagination)", () => {
    it("should return published paginated courses with default params", async () => {
      Course.aggregate.mockResolvedValue([
        {
          metadata: [{ totalCourses: 2 }],
          courses: [
            { _id: "c1", courseName: "React Mastery", price: 999, status: "Published" },
            { _id: "c2", courseName: "Free JS Intro", price: 0, status: "Published" },
          ],
        },
      ]);

      const res = await request(app).get("/api/v1/course/search");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.courses).toHaveLength(2);
      expect(res.body.data.pagination).toEqual({
        page: 1,
        limit: 9,
        totalCourses: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      // Verify pipeline always restricts to Published courses
      const pipeline = Course.aggregate.mock.calls[0][0];
      expect(pipeline[0]).toEqual({ $match: { status: "Published" } });
    });

    it("should safely escape regex special characters in q and search multiple fields", async () => {
      Course.aggregate.mockResolvedValue([{ metadata: [], courses: [] }]);

      const res = await request(app)
        .get("/api/v1/course/search")
        .query({ q: "C++ (Node.js)" });

      expect(res.status).toBe(200);
      const matchStage = Course.aggregate.mock.calls[0][0][0].$match;
      expect(matchStage.$and).toBeDefined();
      expect(matchStage.$and[0]).toEqual({ status: "Published" });
      // First token "C++" escaped to "C\\+\\+"
      const firstTokenOr = matchStage.$and[1].$or;
      expect(firstTokenOr[0].courseName).toBeInstanceOf(RegExp);
      expect(firstTokenOr[0].courseName.source).toBe("C\\+\\+");
      expect(firstTokenOr[0].courseName.flags).toContain("i");
    });

    it("should reject invalid query parameters with 400", async () => {
      const invalidQueries = [
        { category: "not-a-valid-objectid" },
        { priceType: "discounted" },
        { minPrice: "-10" },
        { maxPrice: "abc" },
        { minPrice: "1000", maxPrice: "500" },
        { minRating: "6" },
        { minRating: "-1" },
        { sort: "random_sort" },
        { page: "0" },
        { page: "-3" },
        { page: "abc" },
        { limit: "0" },
        { limit: "-5" },
        { q: "a".repeat(101) },
      ];

      for (const query of invalidQueries) {
        const res = await request(app).get("/api/v1/course/search").query(query);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      }

      // Reject operator injection & duplicate array query params
      const injectionRes = await request(app).get("/api/v1/course/search?q[$ne]=1");
      expect(injectionRes.status).toBe(400);
      const dupArrayRes = await request(app).get("/api/v1/course/search?q=a&q=b");
      expect(dupArrayRes.status).toBe(400);
      expect(Course.aggregate).not.toHaveBeenCalled();
    });

    it("should clamp overly large limit values to MAX_LIMIT (50)", async () => {
      Course.aggregate.mockResolvedValue([{ metadata: [{ totalCourses: 120 }], courses: [] }]);

      const res = await request(app)
        .get("/api/v1/course/search")
        .query({ limit: "500", page: "2" });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.limit).toBe(50);
      expect(res.body.data.pagination.totalPages).toBe(3);
      expect(res.body.data.pagination.hasNextPage).toBe(true);
      expect(res.body.data.pagination.hasPrevPage).toBe(true);

      const pipeline = Course.aggregate.mock.calls[0][0];
      const facetStage = pipeline.find((stage) => stage.$facet);
      expect(facetStage.$facet.courses).toEqual(
        expect.arrayContaining([{ $skip: 50 }, { $limit: 50 }])
      );
    });

    it("should build combined filter and rating sort pipeline", async () => {
      Course.aggregate.mockResolvedValue([{ metadata: [{ totalCourses: 1 }], courses: [] }]);
      const validCatId = "507f1f77bcf86cd799439011";

      const res = await request(app).get("/api/v1/course/search").query({
        q: "mern",
        category: validCatId,
        priceType: "paid",
        minPrice: "500",
        maxPrice: "2000",
        minRating: "4",
        sort: "rating",
        page: "1",
        limit: "6",
      });

      expect(res.status).toBe(200);
      const pipeline = Course.aggregate.mock.calls[0][0];
      const hasRatingMatch = pipeline.some(
        (stage) => stage.$match && stage.$match.averageRating?.$gte === 4
      );
      expect(hasRatingMatch).toBe(true);
      const facetStage = pipeline.find((stage) => stage.$facet);
      expect(facetStage.$facet.courses[0]).toEqual({
        $sort: { averageRating: -1, reviewCount: -1, createdAt: -1, _id: -1 },
      });
    });

    it("should return 500 when aggregation fails", async () => {
      Course.aggregate.mockRejectedValue(new Error("DB aggregation timeout"));

      const res = await request(app).get("/api/v1/course/search");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Failed to search courses/i);
    });
  });
});
