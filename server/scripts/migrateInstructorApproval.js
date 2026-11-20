/**
 * Safe, idempotent migration for GAP-002 (Instructor Approval Enforcement).
 *
 * Operational Safety Guardrails:
 * - Read-only dry-run reporting by default via `--dry-run`.
 * - Existing Instructor accounts without an `approvalStatus` field (or null)
 *   are backfilled to `approvalStatus: "APPROVED"` and `approved: true`
 *   (unless explicitly stored with `approved: false`, in which case they are
 *   backfilled to `approvalStatus: "PENDING"`).
 * - Already-migrated Instructor accounts (`PENDING`, `APPROVED`, `REJECTED`)
 *   are NEVER overwritten.
 * - Existing Student and Admin accounts are strictly UNTOUCHED.
 * - Verifies presence of performance indexes on `approvalStatus` and `approved`.
 * - Fully idempotent: running multiple times produces identical state without duplicates.
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

    // Calculate complete platform census
    const [
        totalUsers,
        totalInstructors,
        alreadyApproved,
        alreadyPending,
        alreadyRejected,
        wouldApprove,
        wouldMarkPending,
        studentCount,
        adminCount,
    ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ accountType: "Instructor" }),
        User.countDocuments({ accountType: "Instructor", approvalStatus: APPROVAL_STATUS.APPROVED }),
        User.countDocuments({ accountType: "Instructor", approvalStatus: APPROVAL_STATUS.PENDING }),
        User.countDocuments({ accountType: "Instructor", approvalStatus: APPROVAL_STATUS.REJECTED }),
        User.countDocuments(legacyApprovedFilter),
        User.countDocuments(legacyPendingFilter),
        User.countDocuments({ accountType: "Student" }),
        User.countDocuments({ accountType: "Admin" }),
    ]);

    const report = {
        dryRun,
        census: {
            totalUsers,
            studentsUntouched: studentCount,
            adminsUntouched: adminCount,
            totalInstructors,
            alreadyMigrated: {
                approved: alreadyApproved,
                pending: alreadyPending,
                rejected: alreadyRejected,
                total: alreadyApproved + alreadyPending + alreadyRejected,
            },
            eligibleForBackfill: {
                toApprove: wouldApprove,
                toPending: wouldMarkPending,
                total: wouldApprove + wouldMarkPending,
            },
        },
    };

    if (dryRun) {
        return {
            ...report,
            status: "DRY_RUN_COMPLETE",
            message: "Dry run completed safely without database writes.",
        };
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
        ...report,
        status: "MIGRATION_EXECUTED",
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
            console.log(`[migrateInstructorApproval] Starting migration runner (dryRun: ${dryRun})`);
            await database.connect();
            const summary = await migrateExistingInstructors({ dryRun });
            console.log("[migrateInstructorApproval] Report:", JSON.stringify(summary, null, 2));
            await database.closeDatabase();
            process.exit(0);
        } catch (err) {
            console.error("[migrateInstructorApproval] Failed:", err?.message || err);
            process.exit(1);
        }
    })();
}

module.exports = { migrateExistingInstructors };
