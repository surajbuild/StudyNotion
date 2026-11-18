const mongoose = require("mongoose");
const User = require("../models/User");
const cache = require("../utils/cache");
const mailSender = require("../utils/mailSender");
const {
    instructorApprovedEmail,
    instructorRejectedEmail,
} = require("../mail/templates/instructorApprovalEmail");
const {
    APPROVAL_STATUS,
    APPROVED_INSTRUCTOR_DB_FILTER,
    PENDING_INSTRUCTOR_DB_FILTER,
    resolveInstructorApprovalStatus,
} = require("../utils/instructorApproval");

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
const MAX_SEARCH_LENGTH = 100;
const MAX_REJECTION_REASON_LENGTH = 500;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_PAGE = 100000;
const ADMIN_STATS_CACHE_KEY = "adminUserManagementStats";

const ALLOWED_ACCOUNT_TYPES = new Set(["ALL", "Student", "Instructor", "Admin"]);
const ALLOWED_APPROVAL_FILTERS = new Set([
    "ALL",
    APPROVAL_STATUS.PENDING,
    APPROVAL_STATUS.APPROVED,
    APPROVAL_STATUS.REJECTED,
]);

const isValidObjectId = (id) =>
    typeof id === "string" && OBJECT_ID_REGEX.test(id) && mongoose.Types.ObjectId.isValid(id);

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Validates query parameters against operator/bracket injection and non-scalar values.
 */
const validateSafeQueryParams = (query = {}) => {
    for (const [key, val] of Object.entries(query)) {
        if (/[$[\]]/.test(key)) {
            return `Invalid query parameter: ${key}`;
        }
        if (val !== undefined && val !== null && typeof val !== "string") {
            return `Invalid query parameter: ${key}`;
        }
    }
    return null;
};

/**
 * Formats a user document into a strictly sanitized admin view.
 * NEVER exposes password, token, resetPasswordExpires, or internal secrets.
 */
const formatUserForAdmin = (u) => {
    if (!u) return null;
    const isInstructor = u.accountType === "Instructor";
    const resolvedStatus = isInstructor ? resolveInstructorApprovalStatus(u) : null;
    return {
        _id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        accountType: u.accountType,
        approvalStatus: resolvedStatus,
        approved: isInstructor ? resolvedStatus === APPROVAL_STATUS.APPROVED : true,
        approvalReviewedAt: u.approvalReviewedAt || null,
        approvalReviewedBy: u.approvalReviewedBy
            ? {
                  _id: u.approvalReviewedBy._id || u.approvalReviewedBy,
                  firstName: u.approvalReviewedBy.firstName || undefined,
                  lastName: u.approvalReviewedBy.lastName || undefined,
                  email: u.approvalReviewedBy.email || undefined,
              }
            : null,
        rejectionReason: u.rejectionReason || null,
        image: u.image,
        contactNumber: u.contactNumber || u.additionalDetails?.contactNumber || null,
        additionalDetails:
            u.additionalDetails && typeof u.additionalDetails === "object" && u.additionalDetails._id
                ? {
                      gender: u.additionalDetails.gender || null,
                      dateOfBirth: u.additionalDetails.dateOfBirth || null,
                      about: u.additionalDetails.about || null,
                      contactNumber: u.additionalDetails.contactNumber || null,
                  }
                : undefined,
        coursesCount: Array.isArray(u.courses) ? u.courses.length : 0,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
    };
};

const parseListingParams = (query = {}, { forceInstructorOnly = false } = {}) => {
    const unsafeErr = validateSafeQueryParams(query);
    if (unsafeErr) return { error: unsafeErr };

    const rawSearch = (query.search ?? query.q ?? "").trim();
    if (rawSearch.length > MAX_SEARCH_LENGTH) {
        return { error: `Search query must be ${MAX_SEARCH_LENGTH} characters or fewer` };
    }

    const rawAccountType = forceInstructorOnly
        ? "Instructor"
        : (query.accountType || "ALL").trim();
    if (!ALLOWED_ACCOUNT_TYPES.has(rawAccountType)) {
        return { error: "Invalid accountType filter. Allowed: ALL, Student, Instructor, Admin" };
    }

    const rawApproval = (query.approvalStatus ?? query.status ?? "ALL").trim().toUpperCase();
    if (!ALLOWED_APPROVAL_FILTERS.has(rawApproval)) {
        return {
            error: "Invalid approvalStatus filter. Allowed: ALL, PENDING, APPROVED, REJECTED",
        };
    }

    let page = DEFAULT_PAGE;
    if (query.page !== undefined && query.page !== "") {
        if (!/^\d+$/.test(query.page.trim())) {
            return { error: "page must be a positive integer" };
        }
        const parsedPage = Number(query.page.trim());
        if (!Number.isSafeInteger(parsedPage) || parsedPage < 1 || parsedPage > MAX_PAGE) {
            return { error: `page must be an integer between 1 and ${MAX_PAGE}` };
        }
        page = parsedPage;
    }

    let limit = DEFAULT_LIMIT;
    if (query.limit !== undefined && query.limit !== "") {
        if (!/^\d+$/.test(query.limit.trim())) {
            return { error: "limit must be a positive integer" };
        }
        const parsedLimit = Number(query.limit.trim());
        if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1) {
            return { error: "limit must be a positive integer" };
        }
        limit = Math.min(parsedLimit, MAX_LIMIT);
    }

    return {
        search: rawSearch,
        accountType: rawAccountType,
        approvalStatus: rawApproval,
        page,
        limit,
    };
};

const buildUserQueryFilter = ({ search, accountType, approvalStatus }) => {
    const andClauses = [];

    if (accountType !== "ALL") {
        andClauses.push({ accountType });
    }

    if (approvalStatus !== "ALL") {
        if (approvalStatus === APPROVAL_STATUS.APPROVED) {
            andClauses.push(APPROVED_INSTRUCTOR_DB_FILTER);
        } else if (approvalStatus === APPROVAL_STATUS.PENDING) {
            andClauses.push(PENDING_INSTRUCTOR_DB_FILTER);
        } else if (approvalStatus === APPROVAL_STATUS.REJECTED) {
            andClauses.push({
                accountType: "Instructor",
                approvalStatus: APPROVAL_STATUS.REJECTED,
            });
        }
    }

    if (search) {
        const tokens = search.split(/\s+/).filter(Boolean).slice(0, 5);
        for (const token of tokens) {
            const regex = new RegExp(escapeRegex(token), "i");
            andClauses.push({
                $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
            });
        }
    }

    if (andClauses.length === 0) return {};
    if (andClauses.length === 1) return andClauses[0];
    return { $and: andClauses };
};

// ============================================================
// GET USER MANAGEMENT STATISTICS
// ============================================================
exports.getUserStats = async (req, res) => {
    try {
        const [
            totalUsers,
            totalStudents,
            totalInstructors,
            totalAdmins,
            pendingInstructors,
            approvedInstructors,
            rejectedInstructors,
        ] = await Promise.all([
            User.countDocuments({}),
            User.countDocuments({ accountType: "Student" }),
            User.countDocuments({ accountType: "Instructor" }),
            User.countDocuments({ accountType: "Admin" }),
            User.countDocuments(PENDING_INSTRUCTOR_DB_FILTER),
            User.countDocuments(APPROVED_INSTRUCTOR_DB_FILTER),
            User.countDocuments({
                accountType: "Instructor",
                approvalStatus: APPROVAL_STATUS.REJECTED,
            }),
        ]);

        const stats = {
            totalUsers: totalUsers || 0,
            totalStudents: totalStudents || 0,
            totalInstructors: totalInstructors || 0,
            totalAdmins: totalAdmins || 0,
            pendingInstructors: pendingInstructors || 0,
            approvedInstructors: approvedInstructors || 0,
            rejectedInstructors: rejectedInstructors || 0,
        };

        return res.status(200).json({
            success: true,
            message: "User management statistics fetched successfully",
            data: stats,
        });
    } catch (error) {
        console.error("getUserStats error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user management statistics",
        });
    }
};

// ============================================================
// LIST USERS (Searchable, Filterable, Paginated)
// ============================================================
const runUserListing = async (req, res, { forceInstructorOnly = false } = {}) => {
    try {
        const parsed = parseListingParams(req.query || {}, { forceInstructorOnly });
        if (parsed.error) {
            return res.status(400).json({
                success: false,
                message: parsed.error,
            });
        }

        const filter = buildUserQueryFilter(parsed);
        const skip = (parsed.page - 1) * parsed.limit;

        const [users, totalUsers] = await Promise.all([
            User.find(filter)
                .select(
                    "firstName lastName email accountType approvalStatus approved approvalReviewedAt approvalReviewedBy rejectionReason image contactNumber courses createdAt updatedAt"
                )
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parsed.limit)
                .lean(),
            User.countDocuments(filter),
        ]);

        const safeUsers = (Array.isArray(users) ? users : []).map(formatUserForAdmin);
        const totalCount = totalUsers || 0;
        const totalPages = Math.max(1, Math.ceil(totalCount / parsed.limit));

        return res.status(200).json({
            success: true,
            message: forceInstructorOnly
                ? "Instructors fetched successfully"
                : "Users fetched successfully",
            data: {
                users: safeUsers,
                pagination: {
                    page: parsed.page,
                    limit: parsed.limit,
                    totalUsers: totalCount,
                    totalPages,
                    hasNextPage: parsed.page < totalPages,
                    hasPrevPage: parsed.page > 1,
                },
            },
        });
    } catch (error) {
        console.error("runUserListing error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch users",
        });
    }
};

exports.getUsers = (req, res) => runUserListing(req, res, { forceInstructorOnly: false });

exports.getInstructors = (req, res) => runUserListing(req, res, { forceInstructorOnly: true });

// ============================================================
// GET INDIVIDUAL USER DETAILS (Safe Projection)
// ============================================================
exports.getUserById = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid user ID is required",
            });
        }

        const user = await User.findById(userId)
            .select(
                "firstName lastName email accountType approvalStatus approved approvalReviewedAt approvalReviewedBy rejectionReason image contactNumber additionalDetails courses createdAt updatedAt"
            )
            .populate("additionalDetails")
            .populate("approvalReviewedBy", "firstName lastName email")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "User details fetched successfully",
            data: formatUserForAdmin(user),
        });
    } catch (error) {
        console.error("getUserById error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user details",
        });
    }
};

// ============================================================
// APPROVE INSTRUCTOR (PENDING or REJECTED -> APPROVED)
// ============================================================
exports.approveInstructor = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid user ID is required",
            });
        }

        // Prevent administrators from approving themselves
        if (String(userId) === String(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "Administrators cannot perform instructor approval actions on their own account",
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (user.accountType !== "Instructor") {
            return res.status(400).json({
                success: false,
                message: "Only instructor accounts can be approved",
            });
        }

        const currentStatus = resolveInstructorApprovalStatus(user);
        if (currentStatus === APPROVAL_STATUS.APPROVED) {
            return res.status(409).json({
                success: false,
                message: "This instructor account is already approved",
            });
        }

        // Only update approval fields — NEVER mutate accountType or credentials
        user.approvalStatus = APPROVAL_STATUS.APPROVED;
        user.approved = true;
        user.approvalReviewedAt = new Date();
        user.approvalReviewedBy = req.user.id;
        user.rejectionReason = null;
        await user.save();

        cache.del(ADMIN_STATS_CACHE_KEY);

        // Best-effort approval email — failure must NEVER reverse the committed approval
        let emailSent = true;
        try {
            await mailSender(
                user.email,
                "Instructor Account Approved — StudyNotion",
                instructorApprovedEmail(user.firstName)
            );
        } catch (mailErr) {
            emailSent = false;
            console.error("Instructor approval email failed:", mailErr.message);
        }

        return res.status(200).json({
            success: true,
            message: "Instructor approved successfully",
            emailSent,
            data: formatUserForAdmin(user),
        });
    } catch (error) {
        console.error("approveInstructor error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to approve instructor",
        });
    }
};

// ============================================================
// REJECT INSTRUCTOR (PENDING -> REJECTED only)
// ============================================================
exports.rejectInstructor = async (req, res) => {
    try {
        const { userId } = req.params;
        const rawReason = req.body?.reason;

        if (!isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid user ID is required",
            });
        }

        let trimmedReason = null;
        if (rawReason !== undefined && rawReason !== null) {
            if (typeof rawReason !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Rejection reason must be a string",
                });
            }
            const cleaned = rawReason.trim();
            if (cleaned.length > MAX_REJECTION_REASON_LENGTH) {
                return res.status(400).json({
                    success: false,
                    message: `Rejection reason must be ${MAX_REJECTION_REASON_LENGTH} characters or fewer`,
                });
            }
            trimmedReason = cleaned || null;
        }

        // Prevent administrators from rejecting themselves
        if (String(userId) === String(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "Administrators cannot perform instructor approval actions on their own account",
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (user.accountType !== "Instructor") {
            return res.status(400).json({
                success: false,
                message: "Only instructor accounts can be rejected",
            });
        }

        const currentStatus = resolveInstructorApprovalStatus(user);
        if (currentStatus === APPROVAL_STATUS.REJECTED) {
            return res.status(409).json({
                success: false,
                message: "This instructor application is already rejected",
            });
        }

        if (currentStatus === APPROVAL_STATUS.APPROVED) {
            return res.status(409).json({
                success: false,
                message:
                    "Cannot reject an already approved instructor through the onboarding approval workflow",
            });
        }

        // Only update approval fields — NEVER mutate accountType or credentials
        user.approvalStatus = APPROVAL_STATUS.REJECTED;
        user.approved = false;
        user.approvalReviewedAt = new Date();
        user.approvalReviewedBy = req.user.id;
        user.rejectionReason = trimmedReason;
        await user.save();

        cache.del(ADMIN_STATS_CACHE_KEY);

        // Best-effort rejection email — failure must NEVER reverse the committed rejection
        let emailSent = true;
        try {
            await mailSender(
                user.email,
                "Instructor Application Update — StudyNotion",
                instructorRejectedEmail(user.firstName, trimmedReason || "")
            );
        } catch (mailErr) {
            emailSent = false;
            console.error("Instructor rejection email failed:", mailErr.message);
        }

        return res.status(200).json({
            success: true,
            message: "Instructor application rejected",
            emailSent,
            data: formatUserForAdmin(user),
        });
    } catch (error) {
        console.error("rejectInstructor error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to reject instructor",
        });
    }
};
