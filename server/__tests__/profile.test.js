const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/User");
jest.mock("../models/Profile");
jest.mock("../models/Course");
jest.mock("../models/CourseProgress");
jest.mock("../utils/imageUploader", () => ({
  imageUploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: "https://cloudinary.com/avatar.jpg" }),
}));

const User = require("../models/User");
const Profile = require("../models/Profile");
const Course = require("../models/Course");
const CourseProgress = require("../models/CourseProgress");
const app = require("../index");

describe("Profile Endpoints (server/controllers/Profile.js)", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-tests";
  const studentToken = jwt.sign(
    { id: "student_1", email: "student@test.com", accountType: "Student" },
    JWT_SECRET
  );
  const instructorToken = jwt.sign(
    { id: "inst_1", email: "instructor@test.com", accountType: "Instructor" },
    JWT_SECRET
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/v1/profile/getUserDetails", () => {
    it("should return 401 if unauthenticated", async () => {
      const res = await request(app).get("/api/v1/profile/getUserDetails");
      expect(res.status).toBe(401);
    });

    it("should return populated user details for authenticated user", async () => {
      User.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: "student_1",
            firstName: "John",
            lastName: "Doe",
            additionalDetails: { gender: "Male", contactNumber: "1234567890" },
          }),
        }),
      });

      const res = await request(app)
        .get("/api/v1/profile/getUserDetails")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.userDetails.firstName).toBe("John");
    });
  });

  describe("PUT /api/v1/profile/updateProfile", () => {
    it("should update profile and additionalDetails successfully", async () => {
      const mockUser = {
        _id: "student_1",
        firstName: "OldName",
        additionalDetails: "prof_1",
        save: jest.fn().mockResolvedValue(true),
      };
      const mockProfile = {
        _id: "prof_1",
        gender: "Male",
        contactNumber: "1234567890",
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockImplementation((id) => {
        if (id === "student_1") {
          return {
            ...mockUser,
            populate: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ ...mockUser, firstName: "NewName" }),
            }),
          };
        }
        return null;
      });
      Profile.findById.mockResolvedValue(mockProfile);

      const res = await request(app)
        .put("/api/v1/profile/updateProfile")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          firstName: "NewName",
          gender: "Male",
          contactNumber: "9876543210",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profileDetails).toBeDefined();
    });
  });

  describe("DELETE /api/v1/profile/deleteProfile", () => {
    it("should delete profile, progress, remove from courses, and delete user", async () => {
      User.findById.mockResolvedValue({
        _id: "student_1",
        additionalDetails: "prof_1",
        courses: ["c1"],
      });
      Profile.findByIdAndDelete.mockResolvedValue({});
      Course.updateMany.mockResolvedValue({});
      CourseProgress.deleteMany.mockResolvedValue({});
      User.findByIdAndDelete.mockResolvedValue({});

      const res = await request(app)
        .delete("/api/v1/profile/deleteProfile")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Profile.findByIdAndDelete).toHaveBeenCalledWith("prof_1");
      expect(Course.updateMany).toHaveBeenCalled();
      expect(CourseProgress.deleteMany).toHaveBeenCalled();
      expect(User.findByIdAndDelete).toHaveBeenCalled();
    });
  });

  describe("GET /api/v1/profile/instructorDashboard", () => {
    it("should return course analytics and earnings for instructor", async () => {
      Course.find.mockResolvedValue([
        {
          _id: "c1",
          courseName: "MERN Course",
          courseDescription: "Full course",
          studentEnrolled: ["s1", "s2"],
          price: 1000,
        },
      ]);

      const res = await request(app)
        .get("/api/v1/profile/instructorDashboard")
        .set("Authorization", `Bearer ${instructorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.courses).toHaveLength(1);
      expect(res.body.courses[0].totalStudentsEnrolled).toBe(2);
      expect(res.body.courses[0].totalAmountGenerated).toBe(2000);
    });
  });
});
