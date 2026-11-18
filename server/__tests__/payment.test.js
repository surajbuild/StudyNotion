const request = require("supertest");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

jest.mock("../config/razorpay", () => ({
  instance: {
    orders: {
      create: jest.fn(),
    },
  },
}));
jest.mock("../utils/mailSender", () => jest.fn().mockResolvedValue({}));
jest.mock("../models/Course");
jest.mock("../models/User");
jest.mock("../models/CourseProgress");

const { instance } = require("../config/razorpay");
const Course = require("../models/Course");
const User = require("../models/User");
const CourseProgress = require("../models/CourseProgress");
const app = require("../index");

describe("Payment Endpoints (server/controllers/Payments.js)", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-tests";
  const RAZORPAY_SECRET = "test-razorpay-secret";
  process.env.RAZORPAY_SECRET = RAZORPAY_SECRET;

  const studentToken = jwt.sign(
    { id: "student_1", email: "student@test.com", accountType: "Student" },
    JWT_SECRET
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/payment/capturePayment", () => {
    it("should return 400 if courses array is empty or missing", async () => {
      const res = await request(app)
        .post("/api/v1/payment/capturePayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courses: [] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/provide at least one course/i);
    });

    it("should return 404 if course is not found", async () => {
      Course.find.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/v1/payment/capturePayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courses: ["invalid_course_id"] });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Course not found/i);
    });

    it("should return 400 if student is already enrolled", async () => {
      Course.find.mockResolvedValue([
        {
          _id: "c1",
          price: 500,
          studentEnrolled: ["student_1"],
        },
      ]);

      const res = await request(app)
        .post("/api/v1/payment/capturePayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courses: ["c1"] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already enrolled/i);
    });

    it("should initiate Razorpay order on valid courses", async () => {
      Course.find.mockResolvedValue([
        {
          _id: "c1",
          price: 1000,
          studentEnrolled: [],
        },
      ]);
      instance.orders.create.mockResolvedValue({
        id: "order_rzp_123",
        amount: 100000,
        currency: "INR",
      });

      const res = await request(app)
        .post("/api/v1/payment/capturePayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courses: ["c1"] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message.id).toBe("order_rzp_123");
    });
  });

  describe("POST /api/v1/payment/verifyPayment", () => {
    it("should return 400 if signature is invalid", async () => {
      const res = await request(app)
        .post("/api/v1/payment/verifyPayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          razorpay_order_id: "order_123",
          razorpay_payment_id: "pay_123",
          razorpay_signature: "tampered_fake_signature",
          courses: ["c1"],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid signature/i);
    });

    it("should verify payment and enroll student if signature is valid", async () => {
      const orderId = "order_123";
      const paymentId = "pay_123";
      const validSignature = crypto
        .createHmac("sha256", RAZORPAY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      Course.updateMany.mockResolvedValue({});
      CourseProgress.create.mockResolvedValue({ _id: "prog_1" });
      CourseProgress.find.mockResolvedValue([{ _id: "prog_1" }]);
      User.findByIdAndUpdate.mockResolvedValue({});
      User.findById.mockResolvedValue({
        _id: "student_1",
        email: "student@test.com",
        firstName: "Student",
      });
      Course.find.mockResolvedValue([{ _id: "c1", courseName: "React" }]);

      const res = await request(app)
        .post("/api/v1/payment/verifyPayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
          courses: ["c1"],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Payment verified");
      expect(Course.updateMany).toHaveBeenCalled();
      expect(User.findByIdAndUpdate).toHaveBeenCalled();
    });
  });
});
