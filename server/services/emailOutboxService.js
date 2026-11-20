const { EmailOutbox, EMAIL_OUTBOX_STATUS, EMAIL_TYPES } = require("../models/EmailOutbox");
const mailSender = require("../utils/mailSender");

/**
 * Calculates exponential retry backoff in milliseconds:
 * 1st retry: ~30s, 2nd: ~2m, 3rd: ~8m, 4th: ~30m, 5th: ~2h
 */
function calculateBackoffMs(attempts) {
    const base = 30 * 1000;
    const factor = Math.pow(4, Math.max(0, attempts - 1));
    return Math.min(base * factor, 2 * 60 * 60 * 1000);
}

/**
 * Dispatches an individual outbox item via mailSender and updates its state.
 */
async function dispatchOutboxItem(item) {
    try {
        await mailSender(item.to, item.subject, item.body);

        await EmailOutbox.updateOne(
            { _id: item._id },
            {
                $set: {
                    status: EMAIL_OUTBOX_STATUS.SENT,
                    sentAt: new Date(),
                    lastError: null,
                    leaseUntil: null,
                },
            }
        );

        return { sent: true };
    } catch (err) {
        const errorMsg = err?.message || String(err);
        const nextAttempts = item.attempts + 1;
        const isMaxReached = nextAttempts >= item.maxAttempts;

        const nextStatus = isMaxReached
            ? EMAIL_OUTBOX_STATUS.FAILED
            : EMAIL_OUTBOX_STATUS.PENDING;

        const nextLease = isMaxReached
            ? null
            : new Date(Date.now() + calculateBackoffMs(nextAttempts));

        await EmailOutbox.updateOne(
            { _id: item._id },
            {
                $set: {
                    status: nextStatus,
                    attempts: nextAttempts,
                    lastError: errorMsg,
                    leaseUntil: nextLease,
                },
            }
        );

        return { sent: false, error: errorMsg, maxReached: isMaxReached };
    }
}

/**
 * Safely enqueues a transactional email into the durable MongoDB outbox.
 * Prevents duplicates via unique (referenceId, emailType) index.
 */
async function enqueueEmail({
    to,
    subject,
    body,
    emailType,
    referenceId,
    immediateSend = true,
    metadata = {},
}) {
    if (!to || !subject || !body || !emailType || !referenceId) {
        throw new Error("Missing required email outbox fields");
    }

    // Upsert outbox document idempotently
    const doc = await EmailOutbox.findOneAndUpdate(
        { referenceId, emailType },
        {
            $setOnInsert: {
                to: to.toLowerCase().trim(),
                subject,
                body,
                emailType,
                referenceId,
                status: EMAIL_OUTBOX_STATUS.PENDING,
                attempts: 0,
                maxAttempts: 5,
                metadata,
            },
        },
        { upsert: true, new: true }
    );

    // If already sent, do not re-send
    if (doc.status === EMAIL_OUTBOX_STATUS.SENT) {
        return { enqueued: false, alreadySent: true, outboxId: doc._id };
    }

    if (immediateSend) {
        const result = await dispatchOutboxItem(doc);
        return {
            enqueued: true,
            sentImmediately: result.sent,
            outboxId: doc._id,
            error: result.error,
        };
    }

    return { enqueued: true, sentImmediately: false, outboxId: doc._id };
}

/**
 * Claims the next available pending or expired-lease email atomically.
 */
async function claimNextEmail({ leaseMs = 60000 } = {}) {
    const now = new Date();
    return await EmailOutbox.findOneAndUpdate(
        {
            $or: [
                { status: EMAIL_OUTBOX_STATUS.PENDING, leaseUntil: { $lte: now } },
                { status: EMAIL_OUTBOX_STATUS.PENDING, leaseUntil: null },
                { status: EMAIL_OUTBOX_STATUS.PROCESSING, leaseUntil: { $lte: now } },
            ],
            attempts: { $lt: 5 },
        },
        {
            $set: {
                status: EMAIL_OUTBOX_STATUS.PROCESSING,
                leaseUntil: new Date(Date.now() + leaseMs),
            },
        },
        { sort: { createdAt: 1 }, new: true }
    );
}

/**
 * Processes a batch of pending emails from the durable outbox.
 */
async function processPendingOutbox({ maxBatch = 10 } = {}) {
    let processed = 0;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < maxBatch; i++) {
        const item = await claimNextEmail();
        if (!item) break;

        processed++;
        const result = await dispatchOutboxItem(item);
        if (result.sent) {
            sentCount++;
        } else {
            failedCount++;
        }
    }

    return { processed, sentCount, failedCount };
}

/**
 * Returns outbox observability metrics.
 */
async function getOutboxStats() {
    const [pending, processing, sent, failed, total] = await Promise.all([
        EmailOutbox.countDocuments({ status: EMAIL_OUTBOX_STATUS.PENDING }),
        EmailOutbox.countDocuments({ status: EMAIL_OUTBOX_STATUS.PROCESSING }),
        EmailOutbox.countDocuments({ status: EMAIL_OUTBOX_STATUS.SENT }),
        EmailOutbox.countDocuments({ status: EMAIL_OUTBOX_STATUS.FAILED }),
        EmailOutbox.countDocuments({}),
    ]);

    return { total, pending, processing, sent, failed };
}

module.exports = {
    enqueueEmail,
    claimNextEmail,
    dispatchOutboxItem,
    processPendingOutbox,
    getOutboxStats,
    calculateBackoffMs,
    EMAIL_OUTBOX_STATUS,
    EMAIL_TYPES,
};
