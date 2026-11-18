const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/Course");
jest.mock("../models/Section");
jest.mock("../models/SubSection");
jest.mock("../models/User");
jest.mock("../utils/imageUploader", () => ({
  imageUploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: "https://cloudinary.com/fake-video.mp4" }),
}));

const Course = require("../models/Course");
const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const User = require("../models/User");
const app = require("../index");

describe("Section & SubSection Endpoints", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-tests";
  const instructorToken = jwt.sign(
    { id: "inst_1", email: "inst@test.com", accountType: "Instructor" },
    JWT_SECRET
  );

  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockResolvedValue({
      _id: "inst_1",
      accountType: "Instructor",
      approvalStatus: "APPROVED",
      approved: true,
    });
  });

  describe("Section Endpoints", () => {
    it("POST /api/v1/course/addSection should create section and push to course", async () => {
      Section.create.mockResolvedValue({ _id: "sec_1", sectionName: "Section 1" });
      Course.findByIdAndUpdate.mockResolvedValue({});
      Course.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: "c1",
          courseContent: [{ _id: "sec_1", sectionName: "Section 1" }],
        }),
      });

      const res = await request(app)
        .post("/api/v1/course/addSection")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ sectionName: "Section 1", courseId: "c1" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Course.findByIdAndUpdate).toHaveBeenCalledWith(
        "c1",
        { $push: { courseContent: "sec_1" } },
        { new: true }
      );
    });

    it("POST /api/v1/course/updateSection should update section name", async () => {
      Section.findByIdAndUpdate.mockResolvedValue({});
      Course.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: "c1",
          courseContent: [{ _id: "sec_1", sectionName: "Updated Name" }],
        }),
      });

      const res = await request(app)
        .post("/api/v1/course/updateSection")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ sectionName: "Updated Name", sectionId: "sec_1", courseId: "c1" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.courseContent[0].sectionName).toBe("Updated Name");
    });

    it("POST /api/v1/course/deleteSection should cascade delete subsections and pull from course", async () => {
      Section.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "sec_1",
          subSection: [{ _id: "sub_1" }],
        }),
      });
      SubSection.deleteMany.mockResolvedValue({});
      Section.findByIdAndDelete.mockResolvedValue({});
      Course.findByIdAndUpdate.mockResolvedValue({});
      Course.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: "c1", courseContent: [] }),
      });

      const res = await request(app)
        .post("/api/v1/course/deleteSection")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ sectionId: "sec_1", courseId: "c1" });

      expect(res.status).toBe(200);
      expect(SubSection.deleteMany).toHaveBeenCalled();
      expect(Section.findByIdAndDelete).toHaveBeenCalledWith("sec_1");
      expect(Course.findByIdAndUpdate).toHaveBeenCalledWith(
        "c1",
        { $pull: { courseContent: "sec_1" } },
        { new: true }
      );
    });
  });

  describe("SubSection Endpoints", () => {
    it("POST /api/v1/course/addSubSection should return 400 if required fields are missing", async () => {
      const res = await request(app)
        .post("/api/v1/course/addSubSection")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ title: "Lecture 1" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("POST /api/v1/course/updateSubSection should update and return updated section", async () => {
      SubSection.findByIdAndUpdate.mockResolvedValue({});
      Section.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "sec_1",
          subSection: [{ _id: "sub_1", title: "Updated Title" }],
        }),
      });

      const res = await request(app)
        .post("/api/v1/course/updateSubSection")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({
          subSectionId: "sub_1",
          sectionId: "sec_1",
          title: "Updated Title",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subSection[0].title).toBe("Updated Title");
    });

    it("POST /api/v1/course/deleteSubSection should delete subsection and return updated section", async () => {
      SubSection.findByIdAndDelete.mockResolvedValue({});
      Section.updateMany.mockResolvedValue({});
      Section.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "sec_1",
          subSection: [],
        }),
      });

      const res = await request(app)
        .post("/api/v1/course/deleteSubSection")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ subSectionId: "sub_1", sectionId: "sec_1" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(SubSection.findByIdAndDelete).toHaveBeenCalledWith("sub_1");
    });

    it("should block pending and rejected instructors from section/subsection mutations (403)", async () => {
      User.findById.mockResolvedValue({
        _id: "inst_1",
        accountType: "Instructor",
        approvalStatus: "PENDING",
        approved: false,
      });

      const pendingRes = await request(app)
        .post("/api/v1/course/addSection")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ sectionName: "Blocked Section", courseId: "c1" });
      expect(pendingRes.status).toBe(403);
      expect(pendingRes.body.code).toBe("INSTRUCTOR_PENDING_APPROVAL");

      User.findById.mockResolvedValue({
        _id: "inst_1",
        accountType: "Instructor",
        approvalStatus: "REJECTED",
        approved: false,
      });

      const rejectedRes = await request(app)
        .post("/api/v1/course/addSubSection")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ sectionId: "sec_1", title: "Blocked Lecture" });
      expect(rejectedRes.status).toBe(403);
      expect(rejectedRes.body.code).toBe("INSTRUCTOR_REJECTED");
    });
  });
});
