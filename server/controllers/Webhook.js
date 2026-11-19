const mongoose = require("mongoose");
const crypto = require("crypto");
const WebhookEvent = require("../models/WebhookEvent");
const { processNextEvent, processEvent } = require("../workers/webhookWorker");

const SIGNATURE_REGEX = /^[a-fA-F0-9]{64}$/;

/**
 * Sanitizes the raw webhook payload to store only necessary financial & diagnostic fields,
 * avoiding unnecessary persistence of customer personal identification details (PII).
 *
 * @param {Object} raw
 * @returns {Object}
 */
function sanitizeWebhookPayload(raw) {
    if (!raw || typeof raw !== "object") return {};
    const sanitized = {
        entity: raw.entity,
        event: raw.event,
        created_at: raw.created_at,
        contains: raw.contains,
        payload: {},
    };

    if (raw.payload?.payment?.entity) {
        const p = raw.payload.payment.entity;
        sanitized.payload.payment = {
            entity: {
                id: p.id,
                entity: p.entity,
                amount: p.amount,
                currency: p.currency,
                status: p.status,
                order_id: p.order_id,
                method: p.method,
                error_code: p.error_code,
                error_description: p.error_description,
                error_source: p.error_source,
                error_step: p.error_step,
                error_reason: p.error_reason,
            },
        };
    }

    if (raw.payload?.order?.entity) {
        const o = raw.payload.order.entity;
        sanitized.payload.order = {
            entity: {
                id: o.id,
                entity: o.entity,
                amount: o.amount,
                amount_paid: o.amount_paid,
                amount_due: o.amount_due,
                currency: o.currency,
                receipt: o.receipt,
                status: o.status,
                attempts: o.attempts,
            },
        };
    }

    return sanitized;
}

/**
 * Validates the Razorpay webhook signature using constant-time comparison.
 * Supports zero-downtime secret rotation via RAZORPAY_WEBHOOK_OLD_SECRET.
 *
 * @param {Buffer} rawBody
 * @param {string} signature
 * @param {string} primarySecret
 * @param {string} [oldSecret]
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signature, primarySecret, oldSecret) {
    if (!Buffer.isBuffer(rawBody) || typeof signature !== "string" || !primarySecret) {
        return false;
    }

    const trimmedSig = signature.trim();
    if (!SIGNATURE_REGEX.test(trimmedSig)) {
        return false;
    }

    const expectedPrimary = crypto
        .createHmac("sha256", primarySecret)
        .update(rawBody)
        .digest("hex");

    const expectedBuf = Buffer.from(expectedPrimary, "utf8");
    const providedBuf = Buffer.from(trimmedSig, "utf8");

    if (expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf)) {
        return true;
    }

    // Support secret rotation fallback
    if (oldSecret && typeof oldSecret === "string") {
        const expectedOld = crypto
            .createHmac("sha256", oldSecret)
            .update(rawBody)
            .digest("hex");
        const oldBuf = Buffer.from(expectedOld, "utf8");
        if (oldBuf.length === providedBuf.length && crypto.timingSafeEqual(oldBuf, providedBuf)) {
            return true;
        }
    }

    return false;
}

/**
 * POST /api/v1/payment/webhook
 *
 * Razorpay webhook ingress endpoint:
 *  1. Receives raw Buffer request body before JSON parsing.
 *  2. Strictly validates HMAC-SHA256 signature using timingSafeEqual.
 *  3. Parses JSON payload ONLY after signature verification.
 *  4. Enforces event envelope & unique event ID validation.
 *  5. Durably records verified event to MongoDB with duplicate protection.
 *  6. Acknowledges HTTP 200 within Razorpay's 5-second expectation.
 *  7. Triggers durable worker processing.
 */
exports.handleRazorpayWebhook = async (req, res) => {
    const primarySecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const oldSecret = process.env.RAZORPAY_WEBHOOK_OLD_SECRET;

    if (!primarySecret) {
        console.error("[Webhook] Rejected: RAZORPAY_WEBHOOK_SECRET is not configured");
        return res.status(500).json({
            success: false,
            message: "Webhook secret not configured",
        });
    }

    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Missing or invalid raw request body",
        });
    }

    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
        return res.status(400).json({
            success: false,
            message: "Missing webhook signature",
        });
    }

    const isValid = verifyWebhookSignature(rawBody, signature, primarySecret, oldSecret);
    if (!isValid) {
        // Safe truncated signature fingerprint logging (never logs secret or full signature)
        const sigFingerprint = signature.slice(0, 8);
        console.warn(`[Webhook] Signature verification failed for fingerprint: ${sigFingerprint}...`);
        return res.status(400).json({
            success: false,
            message: "Invalid webhook signature",
        });
    }

    // JSON parsing strictly executed ONLY after signature verification succeeds
    let payload;
    try {
        payload = JSON.parse(rawBody.toString("utf8"));
    } catch (parseErr) {
        return res.status(400).json({
            success: false,
            message: "Malformed JSON payload",
        });
    }

    const eventId =
        req.headers["x-razorpay-event-id"] ||
        payload.event_id ||
        payload.id;

    if (!eventId || typeof eventId !== "string" || !eventId.trim()) {
        return res.status(400).json({
            success: false,
            message: "Missing or invalid event ID",
        });
    }

    const eventType = payload.event;
    if (!eventType || typeof eventType !== "string" || !eventType.trim()) {
        return res.status(400).json({
            success: false,
            message: "Missing or invalid event type",
        });
    }

    const pEntity = payload.payload?.payment?.entity || payload.payment?.entity;
    const oEntity = payload.payload?.order?.entity || payload.order?.entity;

    const razorpayOrderId =
        oEntity?.id ||
        pEntity?.order_id ||
        undefined;
    const razorpayPaymentId =
        pEntity?.id ||
        undefined;

    try {
        // Durable atomic event persistence
        const webhookDoc = await WebhookEvent.create({
            eventId: eventId.trim(),
            eventType: eventType.trim(),
            razorpayOrderId,
            razorpayPaymentId,
            status: "RECEIVED",
            attempts: 0,
            payload: sanitizeWebhookPayload(payload),
            receivedAt: new Date(),
            nextRetryAt: new Date(),
        });

        // Fast asynchronous worker dispatch (non-blocking)
        if (process.env.STUDYNOTION_DISABLE_AUTO_WORKER !== "true") {
            setImmediate(() => {
                processNextEvent().catch((workerErr) => {
                    console.error("[WebhookWorker] Immediate dispatch notice:", workerErr?.message || workerErr);
                });
            });
        }

        return res.status(200).json({
            success: true,
            message: "Webhook event recorded",
            eventId: webhookDoc.eventId,
            status: "RECEIVED",
        });
    } catch (dbErr) {
        if (dbErr?.code === 11000) {
            // Duplicate event delivery: acknowledge receipt without duplicate processing job
            return res.status(200).json({
                success: true,
                message: "Duplicate event already recorded",
                eventId: eventId.trim(),
                duplicate: true,
            });
        }

        console.error("[Webhook] Failed to persist event to MongoDB:", dbErr?.message || dbErr);
        // Return 500 so Razorpay retries if our database is transiently unavailable
        return res.status(500).json({
            success: false,
            message: "Failed to persist webhook event",
        });
    }
};

/**
 * GET /api/v1/admin/webhook-events
 * Safe operational inspection endpoint for Administrators to monitor event status.
 */
exports.getWebhookEvents = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query || {};
        const query = {};
        if (status && typeof status === "string") {
            const normalizedStatus = status.trim().toUpperCase();
            if (["RECEIVED", "PROCESSING", "PROCESSED", "FAILED", "NEEDS_REVIEW"].includes(normalizedStatus)) {
                query.status = normalizedStatus;
            }
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        const [events, total] = await Promise.all([
            WebhookEvent.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            WebhookEvent.countDocuments(query),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                events,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    totalEvents: total,
                    totalPages: Math.ceil(total / limitNum) || 0,
                },
            },
        });
    } catch (err) {
        console.error("getWebhookEvents error:", err?.message || err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch webhook events",
        });
    }
};

/**
 * POST /api/v1/admin/webhook-events/:eventId/retry
 * Safe operational manual retry endpoint for Administrators to recover stuck or NEEDS_REVIEW events.
 */
exports.retryWebhookEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        if (!eventId) {
            return res.status(400).json({ success: false, message: "eventId param required" });
        }

        const event = await WebhookEvent.findOne({
            $or: [{ eventId }, { _id: mongoose.Types.ObjectId.isValid(eventId) ? eventId : null }],
        });

        if (!event) {
            return res.status(404).json({ success: false, message: "Webhook event not found" });
        }

        const resetDoc = await WebhookEvent.findByIdAndUpdate(
            event._id,
            {
                $set: {
                    status: "RECEIVED",
                    attempts: 0,
                    leaseUntil: null,
                    nextRetryAt: new Date(),
                    lastError: `Manual retry initiated by admin at ${new Date().toISOString()}`,
                },
            },
            { new: true }
        );

        setImmediate(() => {
            processEvent(resetDoc).catch((workerErr) => {
                console.error("[WebhookWorker] Manual retry dispatch notice:", workerErr?.message || workerErr);
            });
        });

        return res.status(200).json({
            success: true,
            message: "Webhook event queued for manual retry",
            data: { event: resetDoc },
        });
    } catch (err) {
        console.error("retryWebhookEvent error:", err?.message || err);
        return res.status(500).json({
            success: false,
            message: "Failed to retry webhook event",
        });
    }
};

exports.verifyWebhookSignature = verifyWebhookSignature;
exports.sanitizeWebhookPayload = sanitizeWebhookPayload;
