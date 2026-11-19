const request = require("supertest");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

jest.mock("../models/WebhookEvent");
jest.mock("../models/Order");
jest.mock("../models/User");
jest.mock("../services/paymentReconciliation", () => ({
    finalizeCapturedPayment: jest.fn(),
    enrollStudents: jest.fn(),
    sendReceiptEmailIdempotent: jest.fn(),
}));

const WebhookEvent = require("../models/WebhookEvent");
const Order = require("../models/Order");
const User = require("../models/User");
const { finalizeCapturedPayment } = require("../services/paymentReconciliation");
const {
    verifyWebhookSignature,
    sanitizeWebhookPayload,
} = require("../controllers/Webhook");
const {
    claimNextEvent,
    processEvent,
} = require("../workers/webhookWorker");
const app = require("../index");

describe("Razorpay Webhook Controller & Worker Unit Tests (Cycle #13)", () => {
    const TEST_WEBHOOK_SECRET = "test-webhook-secret-unit-12345";
    const OLD_WEBHOOK_SECRET = "test-webhook-old-secret-98765";
    const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-tests";

    const adminToken = jwt.sign(
        { id: "admin_1", email: "admin@test.com", accountType: "Admin" },
        JWT_SECRET
    );
    const studentToken = jwt.sign(
        { id: "student_1", email: "student@test.com", accountType: "Student" },
        JWT_SECRET
    );

    const signPayload = (bodyStr, secret = TEST_WEBHOOK_SECRET) => {
        return crypto.createHmac("sha256", secret).update(bodyStr).digest("hex");
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        delete process.env.RAZORPAY_WEBHOOK_OLD_SECRET;
    });

    describe("Signature Verification Helper", () => {
        it("should return true for valid HMAC signature", () => {
            const body = Buffer.from(JSON.stringify({ test: 123 }));
            const sig = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(body).digest("hex");
            expect(verifyWebhookSignature(body, sig, TEST_WEBHOOK_SECRET)).toBe(true);
        });

        it("should return false for tampered payload or invalid signature", () => {
            const body = Buffer.from(JSON.stringify({ test: 123 }));
            const tampered = Buffer.from(JSON.stringify({ test: 456 }));
            const sig = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(body).digest("hex");
            expect(verifyWebhookSignature(tampered, sig, TEST_WEBHOOK_SECRET)).toBe(false);
        });

        it("should return false for non-buffer raw body or malformed signature length", () => {
            expect(verifyWebhookSignature("not-a-buffer", "abc", TEST_WEBHOOK_SECRET)).toBe(false);
            expect(verifyWebhookSignature(Buffer.from("a"), "short-sig", TEST_WEBHOOK_SECRET)).toBe(false);
            expect(verifyWebhookSignature(Buffer.from("a"), "g".repeat(64), TEST_WEBHOOK_SECRET)).toBe(false); // non-hex
        });

        it("should succeed with old secret during secret rotation window", () => {
            const body = Buffer.from(JSON.stringify({ test: 123 }));
            const sigOld = crypto.createHmac("sha256", OLD_WEBHOOK_SECRET).update(body).digest("hex");
            expect(
                verifyWebhookSignature(body, sigOld, TEST_WEBHOOK_SECRET, OLD_WEBHOOK_SECRET)
            ).toBe(true);
        });
    });

    describe("Payload Sanitization Helper", () => {
        it("should extract financial & envelope fields while omitting customer PII", () => {
            const raw = {
                entity: "event",
                event: "order.paid",
                created_at: 1700000000,
                contains: ["order", "payment"],
                payload: {
                    payment: {
                        entity: {
                            id: "pay_123",
                            amount: 100000,
                            currency: "INR",
                            status: "captured",
                            order_id: "order_123",
                            customer_email: "sensitive@user.com",
                            customer_contact: "+919999999999",
                            card: { number: "411111******1111" },
                        },
                    },
                    order: {
                        entity: {
                            id: "order_123",
                            amount: 100000,
                            currency: "INR",
                            status: "paid",
                        },
                    },
                },
            };

            const sanitized = sanitizeWebhookPayload(raw);
            expect(sanitized.payload.payment.entity.id).toBe("pay_123");
            expect(sanitized.payload.payment.entity.amount).toBe(100000);
            expect(sanitized.payload.payment.entity.customer_email).toBeUndefined();
            expect(sanitized.payload.payment.entity.customer_contact).toBeUndefined();
            expect(sanitized.payload.payment.entity.card).toBeUndefined();
        });
    });

    describe("POST /api/v1/payment/webhook (Endpoint Ingress)", () => {
        const samplePayload = {
            entity: "event",
            event: "payment.captured",
            contains: ["payment"],
            payload: {
                payment: {
                    entity: {
                        id: "pay_test_ingress_1",
                        order_id: "order_test_ingress_1",
                        amount: 99900,
                        currency: "INR",
                        status: "captured",
                    },
                },
            },
        };

        it("should return 500 if RAZORPAY_WEBHOOK_SECRET is missing from environment", async () => {
            delete process.env.RAZORPAY_WEBHOOK_SECRET;
            const bodyStr = JSON.stringify(samplePayload);
            const res = await request(app)
                .post("/api/v1/payment/webhook")
                .set("Content-Type", "application/json")
                .set("X-Razorpay-Signature", signPayload(bodyStr, "any"))
                .set("X-Razorpay-Event-Id", "evt_1")
                .send(bodyStr);

            expect(res.status).toBe(500);
            expect(res.body.message).toMatch(/not configured/i);
        });

        it("should return 400 if X-Razorpay-Signature is missing", async () => {
            const bodyStr = JSON.stringify(samplePayload);
            const res = await request(app)
                .post("/api/v1/payment/webhook")
                .set("Content-Type", "application/json")
                .set("X-Razorpay-Event-Id", "evt_1")
                .send(bodyStr);

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Missing webhook signature/i);
        });

        it("should return 400 if signature is invalid", async () => {
            const bodyStr = JSON.stringify(samplePayload);
            const res = await request(app)
                .post("/api/v1/payment/webhook")
                .set("Content-Type", "application/json")
                .set("X-Razorpay-Signature", "0".repeat(64))
                .set("X-Razorpay-Event-Id", "evt_1")
                .send(bodyStr);

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Invalid webhook signature/i);
        });

        it("should return 400 if raw body is empty", async () => {
            const res = await request(app)
                .post("/api/v1/payment/webhook")
                .set("Content-Type", "application/json")
                .set("X-Razorpay-Signature", "0".repeat(64))
                .set("X-Razorpay-Event-Id", "evt_1")
                .send("");

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Missing or invalid raw request body/i);
        });

        it("should return 400 if event ID is missing", async () => {
            const payloadNoId = { entity: "event", event: "payment.captured", payload: {} };
            const bodyStr = JSON.stringify(payloadNoId);
            const sig = signPayload(bodyStr);

            const res = await request(app)
                .post("/api/v1/payment/webhook")
                .set("Content-Type", "application/json")
                .set("X-Razorpay-Signature", sig)
                .send(bodyStr);

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Missing or invalid event ID/i);
        });

        it("should record verified event and acknowledge 200 OK within fast SLA", async () => {
            const bodyStr = JSON.stringify(samplePayload);
            const sig = signPayload(bodyStr);

            WebhookEvent.create.mockResolvedValueOnce({
                eventId: "evt_valid_123",
                eventType: "payment.captured",
                status: "RECEIVED",
            });

            const res = await request(app)
                .post("/api/v1/payment/webhook")
                .set("Content-Type", "application/json")
                .set("X-Razorpay-Signature", sig)
                .set("X-Razorpay-Event-Id", "evt_valid_123")
                .send(bodyStr);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe("RECEIVED");
            expect(WebhookEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventId: "evt_valid_123",
                    eventType: "payment.captured",
                    status: "RECEIVED",
                })
            );
        });

        it("should handle duplicate event delivery (code 11000) with 200 OK and duplicate: true", async () => {
            const bodyStr = JSON.stringify(samplePayload);
            const sig = signPayload(bodyStr);

            const duplicateErr = new Error("E11000 duplicate key error");
            duplicateErr.code = 11000;
            WebhookEvent.create.mockRejectedValueOnce(duplicateErr);

            const res = await request(app)
                .post("/api/v1/payment/webhook")
                .set("Content-Type", "application/json")
                .set("X-Razorpay-Signature", sig)
                .set("X-Razorpay-Event-Id", "evt_dup_999")
                .send(bodyStr);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.duplicate).toBe(true);
            expect(res.body.message).toMatch(/already recorded/i);
        });

        it("should return 500 when database persistence fails so Razorpay can retry", async () => {
            const bodyStr = JSON.stringify(samplePayload);
            const sig = signPayload(bodyStr);

            WebhookEvent.create.mockRejectedValueOnce(new Error("Mongo connection timeout"));

            const res = await request(app)
                .post("/api/v1/payment/webhook")
                .set("Content-Type", "application/json")
                .set("X-Razorpay-Signature", sig)
                .set("X-Razorpay-Event-Id", "evt_transient_err")
                .send(bodyStr);

            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Failed to persist webhook event/i);
        });

        it("should authenticate with old secret when RAZORPAY_WEBHOOK_OLD_SECRET is configured", async () => {
            process.env.RAZORPAY_WEBHOOK_OLD_SECRET = OLD_WEBHOOK_SECRET;
            const bodyStr = JSON.stringify(samplePayload);
            const sig = signPayload(bodyStr, OLD_WEBHOOK_SECRET);

            WebhookEvent.create.mockResolvedValueOnce({
                eventId: "evt_rotation_1",
                eventType: "payment.captured",
                status: "RECEIVED",
            });

            const res = await request(app)
                .post("/api/v1/payment/webhook")
                .set("Content-Type", "application/json")
                .set("X-Razorpay-Signature", sig)
                .set("X-Razorpay-Event-Id", "evt_rotation_1")
                .send(bodyStr);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe("Webhook Worker Logic (server/workers/webhookWorker.js)", () => {
        it("should postpone processing when payment status is authorized but not captured", async () => {
            const authorizedEvent = {
                _id: "evt_auth_only",
                eventId: "evt_auth_1",
                eventType: "payment.captured",
                payload: {
                    payment: {
                        entity: {
                            id: "pay_auth_1",
                            status: "authorized",
                        },
                    },
                },
            };

            WebhookEvent.findByIdAndUpdate.mockResolvedValueOnce({});
            const res = await processEvent(authorizedEvent);

            expect(res.success).toBe(false);
            expect(res.postponed).toBe(true);
            expect(finalizeCapturedPayment).not.toHaveBeenCalled();
            expect(WebhookEvent.findByIdAndUpdate).toHaveBeenCalledWith(
                "evt_auth_only",
                expect.objectContaining({
                    $set: expect.objectContaining({
                        status: "RECEIVED",
                        lastError: expect.stringMatching(/authorized but not captured/i),
                    }),
                })
            );
        });

        it("should reconcile captured payment and mark event PROCESSED on success", async () => {
            const capturedEvent = {
                _id: "evt_captured_id",
                eventId: "evt_cap_1",
                eventType: "payment.captured",
                razorpayOrderId: "order_rzp_100",
                razorpayPaymentId: "pay_rzp_100",
                payload: {
                    payment: {
                        entity: {
                            id: "pay_rzp_100",
                            order_id: "order_rzp_100",
                            amount: 50000,
                            currency: "INR",
                            status: "captured",
                        },
                    },
                },
            };

            finalizeCapturedPayment.mockResolvedValueOnce({
                success: true,
                alreadyProcessed: false,
                order: { _id: "order_db_100" },
            });
            WebhookEvent.findByIdAndUpdate.mockResolvedValueOnce({});

            const res = await processEvent(capturedEvent);

            expect(res.success).toBe(true);
            expect(finalizeCapturedPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    razorpayOrderId: "order_rzp_100",
                    razorpayPaymentId: "pay_rzp_100",
                    amountInSubunits: 50000,
                    currency: "INR",
                    source: "WEBHOOK",
                })
            );
            expect(WebhookEvent.findByIdAndUpdate).toHaveBeenCalledWith(
                "evt_captured_id",
                expect.objectContaining({
                    $set: expect.objectContaining({
                        status: "PROCESSED",
                        orderReference: "order_db_100",
                    }),
                })
            );
        });

        it("should transition event to NEEDS_REVIEW upon permanent business mismatch", async () => {
            const mismatchEvent = {
                _id: "evt_mismatch_id",
                eventId: "evt_mismatch_1",
                eventType: "order.paid",
                razorpayOrderId: "order_rzp_mismatch",
                payload: {
                    order: {
                        entity: {
                            id: "order_rzp_mismatch",
                            amount: 100000,
                        },
                    },
                },
            };

            finalizeCapturedPayment.mockResolvedValueOnce({
                success: false,
                reason: "AMOUNT_MISMATCH",
                message: "Amount mismatch detected",
            });
            WebhookEvent.findByIdAndUpdate.mockResolvedValueOnce({});

            const res = await processEvent(mismatchEvent);

            expect(res.success).toBe(false);
            expect(res.needsReview).toBe(true);
            expect(WebhookEvent.findByIdAndUpdate).toHaveBeenCalledWith(
                "evt_mismatch_id",
                expect.objectContaining({
                    $set: expect.objectContaining({
                        status: "NEEDS_REVIEW",
                        lastError: "Amount mismatch detected",
                    }),
                })
            );
        });

        it("should handle payment.failed without downgrading an already PAID order", async () => {
            const failedEvent = {
                _id: "evt_failed_id",
                eventId: "evt_fail_1",
                eventType: "payment.failed",
                razorpayOrderId: "order_paid_already",
                payload: {
                    payment: {
                        entity: {
                            order_id: "order_paid_already",
                            error_description: "Bank server timeout",
                        },
                    },
                },
            };

            Order.findOne.mockResolvedValueOnce({
                _id: "order_db_paid",
                status: "PAID",
            });
            WebhookEvent.findByIdAndUpdate.mockResolvedValueOnce({});

            const res = await processEvent(failedEvent);

            expect(res.success).toBe(true);
            expect(res.ignored).toBe(true);
            expect(Order.findByIdAndUpdate).not.toHaveBeenCalled();
            expect(WebhookEvent.findByIdAndUpdate).toHaveBeenCalledWith(
                "evt_failed_id",
                expect.objectContaining({
                    $set: expect.objectContaining({
                        status: "PROCESSED",
                        lastError: expect.stringMatching(/already PAID; ignored/i),
                    }),
                })
            );
        });

        it("should safely mark unhandled event types as PROCESSED without error", async () => {
            const unknownEvent = {
                _id: "evt_unknown_id",
                eventId: "evt_unk_1",
                eventType: "refund.speed_changed",
                payload: {},
            };

            WebhookEvent.findByIdAndUpdate.mockResolvedValueOnce({});
            const res = await processEvent(unknownEvent);

            expect(res.success).toBe(true);
            expect(res.ignored).toBe(true);
            expect(WebhookEvent.findByIdAndUpdate).toHaveBeenCalledWith(
                "evt_unknown_id",
                expect.objectContaining({
                    $set: expect.objectContaining({
                        status: "PROCESSED",
                    }),
                })
            );
        });
    });

    describe("Admin Webhook Monitoring & Manual Recovery", () => {
        it("should reject unauthenticated access to /admin/webhook-events with 401", async () => {
            const res = await request(app).get("/api/v1/admin/webhook-events");
            expect(res.status).toBe(401);
        });

        it("should reject Student access to /admin/webhook-events with 403", async () => {
            const res = await request(app)
                .get("/api/v1/admin/webhook-events")
                .set("Authorization", `Bearer ${studentToken}`);
            expect(res.status).toBe(403);
        });

        it("should allow Admin to fetch paginated webhook events", async () => {
            WebhookEvent.find.mockReturnValueOnce({
                sort: jest.fn().mockReturnValue({
                    skip: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue([
                                { eventId: "evt_1", status: "PROCESSED" },
                                { eventId: "evt_2", status: "NEEDS_REVIEW" },
                            ]),
                        }),
                    }),
                }),
            });
            WebhookEvent.countDocuments.mockResolvedValueOnce(2);

            const res = await request(app)
                .get("/api/v1/admin/webhook-events?page=1&limit=10")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.events).toHaveLength(2);
            expect(res.body.data.pagination.totalEvents).toBe(2);
        });

        it("should allow Admin to manually retry an event by resetting status to RECEIVED", async () => {
            WebhookEvent.findOne.mockResolvedValueOnce({
                _id: "507f1f77bcf86cd799439011",
                eventId: "evt_stuck_1",
                status: "NEEDS_REVIEW",
            });
            WebhookEvent.findByIdAndUpdate.mockResolvedValueOnce({
                _id: "507f1f77bcf86cd799439011",
                eventId: "evt_stuck_1",
                status: "RECEIVED",
                attempts: 0,
            });

            const res = await request(app)
                .post("/api/v1/admin/webhook-events/evt_stuck_1/retry")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/queued for manual retry/i);
            expect(WebhookEvent.findByIdAndUpdate).toHaveBeenCalledWith(
                "507f1f77bcf86cd799439011",
                expect.objectContaining({
                    $set: expect.objectContaining({
                        status: "RECEIVED",
                        attempts: 0,
                    }),
                }),
                { new: true }
            );
        });
    });
});
