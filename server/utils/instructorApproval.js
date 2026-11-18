const APPROVAL_STATUS = Object.freeze({
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
});

const VALID_APPROVAL_STATUSES = new Set(Object.values(APPROVAL_STATUS));

// Only Student and Instructor may self-register through the public signup endpoint.
// Admin accounts must never be creatable via public signup payload manipulation.
const ALLOWED_SIGNUP_ROLES = new Set(["Student", "Instructor"]);

/**
 * Resolves the authoritative approval status for a user document.
 *
 * Policy & Backward Compatibility:
 * - Students and Admins are not subject to instructor approval -> returns null.
 * - Instructors with an explicit approvalStatus ("PENDING" | "APPROVED" | "REJECTED")
 *   return that exact status.
 * - Legacy pre-migration Instructor documents created before GAP-002 (missing
 *   `approvalStatus`): if `approved === false`, treat as PENDING; otherwise
 *   treat as APPROVED so existing valid instructors are never locked out.
 */
const resolveInstructorApprovalStatus = (user) => {
    if (!user || user.accountType !== "Instructor") {
        return null;
    }

    if (typeof user.approvalStatus === "string" && VALID_APPROVAL_STATUSES.has(user.approvalStatus)) {
        return user.approvalStatus;
    }

    if (user.approved === false) {
        return APPROVAL_STATUS.PENDING;
    }

    return APPROVAL_STATUS.APPROVED;
};

/**
 * Returns true when an instructor user is explicitly or legacy-compatibly APPROVED.
 */
const isInstructorApproved = (user) =>
    resolveInstructorApprovalStatus(user) === APPROVAL_STATUS.APPROVED;

/**
 * Strips all sensitive internal fields from a user object/document and attaches
 * normalized `approvalStatus` and `approved` values for safe API responses.
 */
const sanitizeUserForClient = (userDoc) => {
    if (!userDoc) return null;
    const obj = typeof userDoc.toObject === "function" ? userDoc.toObject() : { ...userDoc };

    delete obj.password;
    delete obj.token;
    delete obj.resetPasswordExpires;
    delete obj.__v;

    if (obj.accountType === "Instructor") {
        const resolved = resolveInstructorApprovalStatus(obj);
        obj.approvalStatus = resolved;
        obj.approved = resolved === APPROVAL_STATUS.APPROVED;
    } else {
        obj.approvalStatus = null;
        obj.approved = true;
    }

    return obj;
};

/**
 * MongoDB filter matching instructors who are considered APPROVED
 * (explicitly "APPROVED" OR legacy pre-migration records without approvalStatus and approved !== false).
 */
const APPROVED_INSTRUCTOR_DB_FILTER = {
    accountType: "Instructor",
    $or: [
        { approvalStatus: APPROVAL_STATUS.APPROVED },
        {
            $and: [
                {
                    $or: [
                        { approvalStatus: { $exists: false } },
                        { approvalStatus: null },
                    ],
                },
                { approved: { $ne: false } },
            ],
        },
    ],
};

/**
 * MongoDB filter matching instructors who are PENDING
 * (explicitly "PENDING" OR legacy records without approvalStatus where approved === false).
 */
const PENDING_INSTRUCTOR_DB_FILTER = {
    accountType: "Instructor",
    $or: [
        { approvalStatus: APPROVAL_STATUS.PENDING },
        {
            $and: [
                {
                    $or: [
                        { approvalStatus: { $exists: false } },
                        { approvalStatus: null },
                    ],
                },
                { approved: false },
            ],
        },
    ],
};

module.exports = {
    APPROVAL_STATUS,
    VALID_APPROVAL_STATUSES,
    ALLOWED_SIGNUP_ROLES,
    APPROVED_INSTRUCTOR_DB_FILTER,
    PENDING_INSTRUCTOR_DB_FILTER,
    resolveInstructorApprovalStatus,
    isInstructorApproved,
    sanitizeUserForClient,
};
