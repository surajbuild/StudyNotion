/**
 * Safe, idempotent migration for GAP-002 (Instructor Approval Enforcement).
 *
 * Behavior:
 * - Existing Instructor accounts without an `approvalStatus` field (or null)
 *   are backfilled to `approvalStatus: "APPROVED"` and `approved: true`
 *   (unless explicitly stored with `approved: false`, in which case they are
 *   backfilled to `approvalStatus: "PENDING"`).
 * - Already-migrated Instructor accounts (`PENDING`, `APPROVED`, `REJECTED`)
 *   are NEVER overwritten.
 * - Existing Student and Admin accounts are untouched (only ensures `approved: true`
 *   if missing, never assigns an instructor approvalStatus).
 */
const User = require("../models/User");
const { APPROVAL_STATUS } = require("../utils/instructorApproval");

const migrateExistingInstructors = async ({ dryRun = false } = {}) => {
    const legacyApprovedFilter = {
        accountType: "Instructor",
        $or: [{ approvalStatus: { $exists: false } }, { approvalStatus: null }],
        approved: { $ne: false },
    };

    const legacyPendingFilter = {
        accountType: "Instructor",
        $or: [{ approvalStatus: { $exists: false } }, { approvalStatus: null }],
        approved: false,
    };

    if (dryRun) {
        const [wouldApprove, wouldMarkPending] = await Promise.all([
            User.countDocuments(legacyApprovedFilter),
            User.countDocuments(legacyPendingFilter),
        ]);
        return { dryRun: true, wouldApprove, wouldMarkPending };
    }

    const [approvedResult, pendingResult] = await Promise.all([
        User.updateMany(legacyApprovedFilter, {
            $set: {
                approvalStatus: APPROVAL_STATUS.APPROVED,
                approved: true,
            },
        }),
        User.updateMany(legacyPendingFilter, {
            $set: {
                approvalStatus: APPROVAL_STATUS.PENDING,
                approved: false,
            },
        }),
    ]);

    return {
        dryRun: false,
        approvedBackfilled: approvedResult.modifiedCount ?? approvedResult.nModified ?? 0,
        pendingBackfilled: pendingResult.modifiedCount ?? pendingResult.nModified ?? 0,
    };
};

if (require.main === module) {
    const dotenv = require("dotenv");
    const path = require("path");
    const mongoose = require("mongoose");
    const database = require("../config/database");

    dotenv.config({ path: path.join(__dirname, "../.env") });
    const dryRun = process.argv.includes("--dry-run");

    (async () => {
        try {
            await database.connect();
            const summary = await migrateExistingInstructors({ dryRun });
            console.log("[migrateInstructorApproval] Summary:", JSON.stringify(summary));
            await mongoose.disconnect();
            process.exit(0);
        } catch (err) {
            console.error("[migrateInstructorApproval] Failed:", err);
            process.exit(1);
        }
    })();
}

module.exports = { migrateExistingInstructors };
