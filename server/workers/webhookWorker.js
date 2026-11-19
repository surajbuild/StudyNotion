const mongoose = require("mongoose");
const WebhookEvent = require("../models/WebhookEvent");
const Order = require("../models/Order");
const { finalizeCapturedPayment } = require("../services/paymentReconciliation");

const DEFAULT_LEASE_DURATION_MS = 30 * 1000; // 30 seconds
const BASE_BACKOFF_MS = 2 * 1000; // 2 seconds exponential base
const DEFAULT_POLL_INTERVAL_MS = 3 * 1000; // 3 seconds

let pollIntervalTimer = null;
let isPolling = false;

/**
 * Atomically claims the next eligible webhook event for processing.
 *
 * Eligible events:
 *  - status === 'RECEIVED' AND nextRetryAt <= now
 *  - status === 'PROCESSING' AND leaseUntil <= now (expired lease recovery)
 *
 * Atomically transitions event to status === 'PROCESSING' with a lease timeout.
 *
 * @param {Object} options
 * @param {number} [options.leaseDurationMs]
 * @returns {Promise<Object|null>} Claimed WebhookEvent document or null
 */
async function claimNextEvent({ leaseDurationMs = DEFAULT_LEASE_DURATION_MS } = {}) {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + leaseDurationMs);

    const event = await WebhookEvent.findOneAndUpdate(
        {
            $or: [
                {
                    status: "RECEIVED",
                    nextRetryAt: { $lte: now },
                },
                {
                    status: "PROCESSING",
                    leaseUntil: { $lte: now },
                },
            ],
            attempts: { $lt: 5 },
        },
        {
            $set: {
                status: "PROCESSING",
                leaseUntil,
            },
            $inc: { attempts: 1 },
        },
        {
            new: true,
            sort: { nextRetryAt: 1, createdAt: 1 },
        }
    );

    return event;
}

/**
 * Authoritatively processes a claimed webhook event.
 *
 * @param {Object} event - Claimed WebhookEvent document
 * @returns {Promise<{ success: boolean, [key: string]: any }>}
 */
async function processEvent(event) {
    if (!event) {
        return { success: false, reason: "NO_EVENT" };
    }

    const eventId = event.eventId;
    const eventType = event.eventType;
    const payload = event.payload || {};

    const pEntity =
        payload.payload?.payment?.entity ||
        payload.payment?.entity ||
        event.payload?.payload?.payment?.entity;
    const oEntity =
        payload.payload?.order?.entity ||
        payload.order?.entity ||
        event.payload?.payload?.order?.entity;

    const razorpayOrderId =
        event.razorpayOrderId ||
        oEntity?.id ||
        pEntity?.order_id;
    const razorpayPaymentId =
        event.razorpayPaymentId ||
        pEntity?.id;
    const amountInSubunits =
        pEntity?.amount ?? oEntity?.amount;
    const currency =
        pEntity?.currency || oEntity?.currency;

    try {
        // Case 1: Successful payment signals
        if (eventType === "order.paid" || eventType === "payment.captured") {
            const paymentStatus = pEntity?.status;

            // payment.authorized alone is not sufficient to grant course access
            if (paymentStatus === "authorized" && eventType === "payment.captured") {
                await WebhookEvent.findByIdAndUpdate(event._id, {
                    $set: {
                        status: "RECEIVED",
                        leaseUntil: null,
                        nextRetryAt: new Date(Date.now() + 5000),
                        lastError: "Payment is authorized but not captured; postponed",
                    },
                });
                return { success: false, postponed: true, status: "RECEIVED" };
            }

            const reconciliation = await finalizeCapturedPayment({
                razorpayOrderId,
                razorpayPaymentId,
                amountInSubunits,
                currency,
                source: "WEBHOOK",
                sendEmail: true,
            });

            if (reconciliation.success) {
                await WebhookEvent.findByIdAndUpdate(event._id, {
                    $set: {
                        status: "PROCESSED",
                        orderReference: reconciliation.order?._id,
                        processedAt: new Date(),
                        leaseUntil: null,
                        lastError: "",
                    },
                });
                return {
                    success: true,
                    status: "PROCESSED",
                    alreadyProcessed: reconciliation.alreadyProcessed,
                    order: reconciliation.order,
                };
            }

            // Permanent business conflicts -> NEEDS_REVIEW
            const permanentReasons = new Set([
                "AMOUNT_MISMATCH",
                "CURRENCY_MISMATCH",
                "ORDER_NOT_FOUND",
                "PAYMENT_ALREADY_USED",
                "ORDER_ALREADY_PAID_DIFFERENT_PAYMENT",
                "INVALID_ORDER_STATUS",
                "MISSING_ORDER_ID",
            ]);

            if (permanentReasons.has(reconciliation.reason)) {
                await WebhookEvent.findByIdAndUpdate(event._id, {
                    $set: {
                        status: "NEEDS_REVIEW",
                        leaseUntil: null,
                        lastError: reconciliation.message || reconciliation.reason,
                    },
                });
                return {
                    success: false,
                    needsReview: true,
                    status: "NEEDS_REVIEW",
                    reason: reconciliation.reason,
                    lastError: reconciliation.reason,
                };
            }

            // Transient error: schedule retry with exponential backoff
            const backoff = BASE_BACKOFF_MS * Math.pow(2, event.attempts);
            await WebhookEvent.findByIdAndUpdate(event._id, {
                $set: {
                    status: "RECEIVED",
                    leaseUntil: null,
                    nextRetryAt: new Date(Date.now() + backoff),
                    lastError: reconciliation.message || "Transient reconciliation error",
                },
            });
            return { success: false, retryScheduled: true, status: "RECEIVED" };
        }

        // Case 2: Payment failure signal
        if (eventType === "payment.failed") {
            const failureReason =
                pEntity?.error_description || "Payment failed";

            if (!razorpayOrderId) {
                await WebhookEvent.findByIdAndUpdate(event._id, {
                    $set: {
                        status: "NEEDS_REVIEW",
                        leaseUntil: null,
                        lastError: "payment.failed missing razorpayOrderId",
                    },
                });
                return { success: false, needsReview: true, status: "NEEDS_REVIEW" };
            }

            const order = await Order.findOne({ razorpayOrderId });
            if (!order) {
                await WebhookEvent.findByIdAndUpdate(event._id, {
                    $set: {
                        status: "NEEDS_REVIEW",
                        leaseUntil: null,
                        lastError: `Order not found for failed payment: ${razorpayOrderId}`,
                    },
                });
                return { success: false, needsReview: true, status: "NEEDS_REVIEW" };
            }

            // CRITICAL: NEVER downgrade a PAID order
            if (order.status === "PAID") {
                await WebhookEvent.findByIdAndUpdate(event._id, {
                    $set: {
                        status: "PROCESSED",
                        orderReference: order._id,
                        processedAt: new Date(),
                        leaseUntil: null,
                        lastError: "Order is already PAID; ignored late payment.failed",
                    },
                });
                return { success: true, ignored: true, status: "PROCESSED", reason: "ORDER_ALREADY_PAID" };
            }

            // Safe update for non-PAID order: transition to FAILED
            await Order.findByIdAndUpdate(order._id, {
                $set: { status: "FAILED", failureReason },
            });

            await WebhookEvent.findByIdAndUpdate(event._id, {
                $set: {
                    status: "PROCESSED",
                    orderReference: order._id,
                    processedAt: new Date(),
                    leaseUntil: null,
                    lastError: "",
                },
            });

            return { success: true, failureRecorded: true, status: "PROCESSED" };
        }

        // Case 3: Other / Unknown event types
        await WebhookEvent.findByIdAndUpdate(event._id, {
            $set: {
                status: "PROCESSED",
                processedAt: new Date(),
                leaseUntil: null,
                lastError: `Ignored unhandled event type: ${eventType}`,
            },
        });
        return { success: true, ignored: true, status: "PROCESSED" };
    } catch (err) {
        console.error(
            `[WebhookWorker] Uncaught error processing event ${eventId}:`,
            err?.message || err
        );

        if (event.attempts >= event.maxAttempts) {
            await WebhookEvent.findByIdAndUpdate(event._id, {
                $set: {
                    status: "NEEDS_REVIEW",
                    leaseUntil: null,
                    lastError: `Exceeded max attempts (${event.maxAttempts}): ${err.message}`,
                },
            });
            return { success: false, needsReview: true };
        }

        const backoff = BASE_BACKOFF_MS * Math.pow(2, event.attempts);
        await WebhookEvent.findByIdAndUpdate(event._id, {
            $set: {
                status: "RECEIVED",
                leaseUntil: null,
                nextRetryAt: new Date(Date.now() + backoff),
                lastError: err.message || "Unexpected worker error",
            },
        });
        return { success: false, retryScheduled: true };
    }
}

/**
 * Claims and processes a single pending event.
 *
 * @returns {Promise<{ processed: boolean, event?: Object, result?: Object }>}
 */
async function processNextEvent(options) {
    const event = await claimNextEvent(options);
    if (!event) {
        return { processed: false, event: null };
    }
    const result = await processEvent(event);
    return { processed: true, event, result };
}

/**
 * Drains all currently pending events up to maxBatch size.
 *
 * @param {number} [maxBatch=20]
 * @returns {Promise<number>} Number of events processed
 */
async function processPendingEvents(maxBatch = 20) {
    let count = 0;
    for (let i = 0; i < maxBatch; i++) {
        const { processed } = await processNextEvent();
        if (!processed) break;
        count++;
    }
    return count;
}

/**
 * Starts background polling worker interval.
 *
 * @param {Object} [options]
 * @param {number} [options.intervalMs]
 */
function startWebhookWorker({ intervalMs = DEFAULT_POLL_INTERVAL_MS } = {}) {
    if (pollIntervalTimer) {
        return;
    }
    pollIntervalTimer = setInterval(async () => {
        if (isPolling) return;
        isPolling = true;
        try {
            await processPendingEvents(10);
        } catch (err) {
            console.error("[WebhookWorker] Polling loop error:", err?.message || err);
        } finally {
            isPolling = false;
        }
    }, intervalMs);

    // Allow process to exit cleanly if worker is only active handle
    if (typeof pollIntervalTimer.unref === "function") {
        pollIntervalTimer.unref();
    }
}

/**
 * Stops background polling worker cleanly.
 */
function stopWebhookWorker() {
    if (pollIntervalTimer) {
        clearInterval(pollIntervalTimer);
        pollIntervalTimer = null;
    }
    isPolling = false;
}

// Standalone execution entry point (e.g. node server/workers/webhookWorker.js)
if (require.main === module) {
    const path = require("path");
    const dotenv = require("dotenv");
    const database = require("../config/database");

    dotenv.config({ path: path.join(__dirname, "..", ".env") });

    const runStandalone = async () => {
        console.log("[WebhookWorker] Starting standalone Razorpay Webhook Worker...");
        await database.connect();
        startWebhookWorker({ intervalMs: 2000 });
        console.log("[WebhookWorker] Webhook worker polling active.");

        const gracefulShutdown = async () => {
            console.log("\n[WebhookWorker] Shutting down cleanly...");
            stopWebhookWorker();
            try {
                await mongoose.connection.close();
            } catch {}
            process.exit(0);
        };

        process.on("SIGINT", gracefulShutdown);
        process.on("SIGTERM", gracefulShutdown);
    };

    runStandalone().catch((err) => {
        console.error("[WebhookWorker] Fatal standalone startup failure:", err);
        process.exit(1);
    });
}

module.exports = {
    claimNextEvent,
    processEvent,
    processNextEvent,
    processPendingEvents,
    startWebhookWorker,
    stopWebhookWorker,
};
