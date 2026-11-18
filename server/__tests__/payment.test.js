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
jest.mock("../models/Order");

const { instance } = require("../config/razorpay");
const Course = require("../models/Course");
const User = require("../models/User");
const CourseProgress = require("../models/CourseProgress");
const Order = require("../models/Order");
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
      Order.create.mockResolvedValue({
        _id: "order_db_1",
        razorpayOrderId: "order_rzp_123",
        status: "PENDING",
      });

      const res = await request(app)
        .post("/api/v1/payment/capturePayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courses: ["c1"] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message.id).toBe("order_rzp_123");
      expect(Order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: "student_1",
          amount: 1000,
          amountInSubunits: 100000,
          currency: "INR",
          razorpayOrderId: "order_rzp_123",
          status: "PENDING",
        })
      );
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

      const pendingOrder = {
        _id: "order_db_123",
        user: "student_1",
        courses: ["c1"],
        amount: 1000,
        amountInSubunits: 100000,
        currency: "INR",
        razorpayOrderId: orderId,
        status: "PENDING",
        enrollmentCompleted: false,
      };
      Order.findOne
        .mockResolvedValueOnce(pendingOrder) // lookup by razorpayOrderId
        .mockResolvedValueOnce(null); // duplicate razorpayPaymentId check
      Order.findOneAndUpdate.mockResolvedValueOnce({
        ...pendingOrder,
        status: "PAID",
        razorpayPaymentId: paymentId,
      });
      Order.findByIdAndUpdate.mockResolvedValueOnce({
        ...pendingOrder,
        status: "PAID",
        razorpayPaymentId: paymentId,
        enrollmentCompleted: true,
      });

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

  describe("POST /api/v1/payment/enrollFreeCourse (GAP-005)", () => {
    const validCourseId = "507f1f77bcf86cd799439011";
    const instructorToken = jwt.sign(
      { id: "inst_1", email: "inst@test.com", accountType: "Instructor" },
      JWT_SECRET
    );

    it("should reject unauthenticated requests with 401", async () => {
      const res = await request(app)
        .post("/api/v1/payment/enrollFreeCourse")
        .send({ courseId: validCourseId });
      expect(res.status).toBe(401);
    });

    it("should reject Instructor role with 403", async () => {
      const res = await request(app)
        .post("/api/v1/payment/enrollFreeCourse")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ courseId: validCourseId });
      expect(res.status).toBe(403);
    });

    it("should reject malformed course ID with 400", async () => {
      const res = await request(app)
        .post("/api/v1/payment/enrollFreeCourse")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: "not-a-valid-objectid" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid course ID/i);
    });

    it("should reject paid course even if client tampers with price=0 in request body", async () => {
      Course.find.mockResolvedValue([
        {
          _id: validCourseId,
          price: 999,
          status: "Published",
          studentEnrolled: [],
        },
      ]);

      const res = await request(app)
        .post("/api/v1/payment/enrollFreeCourse")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: validCourseId, price: 0 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not free/i);
      expect(Course.updateMany).not.toHaveBeenCalled();
    });

    it("should reject negative-priced or unpublished courses with 400", async () => {
      Course.find.mockResolvedValue([
        { _id: validCourseId, price: -50, status: "Published", studentEnrolled: [] },
      ]);
      const negRes = await request(app)
        .post("/api/v1/payment/enrollFreeCourse")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: validCourseId });
      expect(negRes.status).toBe(400);

      Course.find.mockResolvedValue([
        { _id: validCourseId, price: 0, status: "Draft", studentEnrolled: [] },
      ]);
      const draftRes = await request(app)
        .post("/api/v1/payment/enrollFreeCourse")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: validCourseId });
      expect(draftRes.status).toBe(400);
      expect(draftRes.body.message).toMatch(/not currently available/i);
    });

    it("should reject duplicate enrollment with 409", async () => {
      Course.find.mockResolvedValue([
        {
          _id: validCourseId,
          price: 0,
          status: "Published",
          studentEnrolled: ["student_1"],
        },
      ]);

      const res = await request(app)
        .post("/api/v1/payment/enrollFreeCourse")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: validCourseId });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already enrolled/i);
    });

    it("should enroll authenticated student in a ₹0 published course and ignore spoofed userId", async () => {
      Course.find
        .mockResolvedValueOnce([
          {
            _id: validCourseId,
            courseName: "Free Starter",
            price: 0,
            status: "Published",
            studentEnrolled: [],
          },
        ])
        .mockResolvedValueOnce([{ _id: validCourseId, courseName: "Free Starter" }]);
      CourseProgress.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ _id: "prog_free_1", courseID: validCourseId }]);
      CourseProgress.create.mockResolvedValue({ _id: "prog_free_1" });
      Course.updateMany.mockResolvedValue({});
      User.findByIdAndUpdate.mockResolvedValue({});
      User.findById.mockResolvedValue({
        _id: "student_1",
        email: "student@test.com",
        firstName: "Student",
      });

      const res = await request(app)
        .post("/api/v1/payment/enrollFreeCourse")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courseId: validCourseId, userId: "spoofed_other_user" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Course.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [validCourseId] } },
        { $addToSet: { studentEnrolled: "student_1" } }
      );
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "student_1",
        expect.any(Object)
      );
      expect(instance.orders.create).not.toHaveBeenCalled();
    });

    it("capturePayment should reject ₹0 courses instead of sending 0 paise to Razorpay", async () => {
      Course.find.mockResolvedValue([
        { _id: validCourseId, price: 0, status: "Published", studentEnrolled: [] },
      ]);

      const res = await request(app)
        .post("/api/v1/payment/capturePayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ courses: [validCourseId] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/free enrollment/i);
      expect(instance.orders.create).not.toHaveBeenCalled();
    });
  });

  describe("Order Security, Replay Protection & Order History (GAP-008)", () => {
    const validOrderDbId = "507f1f77bcf86cd799439099";
    const sign = (orderId, paymentId) =>
      crypto
        .createHmac("sha256", RAZORPAY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

    it("should reject unknown orderId (404), cross-user order (403), amount/currency/course mismatch (400)", async () => {
      const orderId = "order_sec_1";
      const paymentId = "pay_sec_1";
      const sig = sign(orderId, paymentId);

      // 404 unknown order
      Order.findOne.mockResolvedValueOnce(null);
      const notFoundRes = await request(app)
        .post("/api/v1/payment/verifyPayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig });
      expect(notFoundRes.status).toBe(404);

      // 403 cross-user order
      Order.findOne.mockResolvedValueOnce({
        _id: validOrderDbId,
        user: "other_student_999",
        courses: ["c1"],
        amountInSubunits: 99900,
        currency: "INR",
        status: "PENDING",
      });
      const crossUserRes = await request(app)
        .post("/api/v1/payment/verifyPayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig });
      expect(crossUserRes.status).toBe(403);

      // 400 wrong amount
      Order.findOne.mockResolvedValueOnce({
        _id: validOrderDbId,
        user: "student_1",
        courses: ["c1"],
        amountInSubunits: 99900,
        currency: "INR",
        status: "PENDING",
      });
      const wrongAmtRes = await request(app)
        .post("/api/v1/payment/verifyPayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sig,
          amount: 100,
        });
      expect(wrongAmtRes.status).toBe(400);
      expect(wrongAmtRes.body.message).toMatch(/amount mismatch/i);

      // 400 wrong currency
      Order.findOne.mockResolvedValueOnce({
        _id: validOrderDbId,
        user: "student_1",
        courses: ["c1"],
        amountInSubunits: 99900,
        currency: "INR",
        status: "PENDING",
      });
      const wrongCurrRes = await request(app)
        .post("/api/v1/payment/verifyPayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sig,
          currency: "USD",
        });
      expect(wrongCurrRes.status).toBe(400);
      expect(wrongCurrRes.body.message).toMatch(/currency mismatch/i);

      // 400 tampered extra course
      Order.findOne.mockResolvedValueOnce({
        _id: validOrderDbId,
        user: "student_1",
        courses: ["c1"],
        amountInSubunits: 99900,
        currency: "INR",
        status: "PENDING",
      });
      const tamperedCoursesRes = await request(app)
        .post("/api/v1/payment/verifyPayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sig,
          courses: ["c1", "unpaid_extra_course"],
        });
      expect(tamperedCoursesRes.status).toBe(400);
      expect(Course.updateMany).not.toHaveBeenCalled();
    });

    it("should reject duplicate razorpay_payment_id across orders (409) and handle repeated verification idempotently (200)", async () => {
      const orderId = "order_dup_1";
      const paymentId = "pay_replayed_1";
      const sig = sign(orderId, paymentId);

      // Replay paymentId from another order -> 409
      Order.findOne
        .mockResolvedValueOnce({
          _id: validOrderDbId,
          user: "student_1",
          courses: ["c1"],
          amountInSubunits: 99900,
          currency: "INR",
          status: "PENDING",
        })
        .mockResolvedValueOnce({
          _id: "507f1f77bcf86cd799439088",
          razorpayPaymentId: paymentId,
        });
      const replayRes = await request(app)
        .post("/api/v1/payment/verifyPayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig });
      expect(replayRes.status).toBe(409);
      expect(Course.updateMany).not.toHaveBeenCalled();

      // Repeated callback on same PAID + enrolled order -> 200 idempotent, zero re-enrollment
      Order.findOne
        .mockResolvedValueOnce({
          _id: validOrderDbId,
          user: "student_1",
          courses: ["c1"],
          amountInSubunits: 99900,
          currency: "INR",
          razorpayPaymentId: paymentId,
          status: "PAID",
          enrollmentCompleted: true,
        })
        .mockResolvedValueOnce({
          _id: validOrderDbId,
          razorpayPaymentId: paymentId,
        });
      const idempotentRes = await request(app)
        .post("/api/v1/payment/verifyPayment")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig });
      expect(idempotentRes.status).toBe(200);
      expect(idempotentRes.body.alreadyProcessed).toBe(true);
      expect(Course.updateMany).not.toHaveBeenCalled();
    });

    it("should mark PENDING order FAILED/CANCELLED and refuse downgrading PAID orders (409)", async () => {
      Order.findOne.mockResolvedValueOnce({
        _id: validOrderDbId,
        user: "student_1",
        status: "PAID",
      });
      const downgradeRes = await request(app)
        .post("/api/v1/payment/markPaymentFailed")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ razorpay_order_id: "order_paid", status: "CANCELLED" });
      expect(downgradeRes.status).toBe(409);

      Order.findOne.mockResolvedValueOnce({
        _id: validOrderDbId,
        user: "student_1",
        status: "PENDING",
      });
      Order.findOneAndUpdate.mockResolvedValueOnce({
        _id: validOrderDbId,
        status: "CANCELLED",
        failureReason: "Dismissed by user",
      });
      const cancelRes = await request(app)
        .post("/api/v1/payment/markPaymentFailed")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ razorpay_order_id: "order_pending", status: "CANCELLED", reason: "Dismissed by user" });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.order.status).toBe("CANCELLED");
    });

    it("should enforce pagination, ownership (403), and ObjectId validation (400) on order history endpoints", async () => {
      const badPageRes = await request(app)
        .get("/api/v1/payment/orders?page=0")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(badPageRes.status).toBe(400);

      const badIdRes = await request(app)
        .get("/api/v1/payment/orders/not-valid")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(badIdRes.status).toBe(400);

      Order.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: validOrderDbId,
          user: "different_student_id",
          status: "PAID",
        }),
      });
      const crossDetailsRes = await request(app)
        .get(`/api/v1/payment/orders/${validOrderDbId}`)
        .set("Authorization", `Bearer ${studentToken}`);
      expect(crossDetailsRes.status).toBe(403);

      Order.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([{ _id: validOrderDbId, status: "PAID", amount: 999 }]),
            }),
          }),
        }),
      });
      Order.countDocuments.mockResolvedValueOnce(1);

      const listRes = await request(app)
        .get("/api/v1/payment/orders?page=1&limit=10")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.orders).toHaveLength(1);
      expect(listRes.body.data.pagination.totalOrders).toBe(1);
    });
  });
});
