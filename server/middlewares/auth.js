const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { isTestMode } = require("../config/testSafety");
if (!isTestMode()) {
    require("dotenv").config();
}
const User = require("../models/User");
const {
    APPROVAL_STATUS,
    resolveInstructorApprovalStatus,
} = require("../utils/instructorApproval");

// ============================================================
// auth — verifies the JWT attached to every protected request
// ============================================================
exports.auth = async (req, res, next) => {
    try {
        let token = null;

        // SEC-006: Accept tokens strictly from Authorization header or secure cookies.
        // req.body.token is explicitly rejected to prevent token injection / CSRF body confusion.
        const authHeader = req.header("Authorization") || req.header("authorization");
        if (authHeader && typeof authHeader === "string") {
            if (authHeader.startsWith("Bearer ")) {
                token = authHeader.slice(7).trim();
            } else if (!authHeader.startsWith("Bearer ")) {
                token = authHeader.trim();
            }
        }

        if (!token && req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing",
            });
        }

        // Verify the token signature and expiry against our secret
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: "Token is invalid or has expired",
            });
        }

        // SEC-003: Check token revocation against authoritative database tokenVersion.
        // Active whenever MongoDB is connected (production, staging, E2E, and integration tests)
        // or during dedicated unit tests with req.__testRevocation set.
        const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;
        if (isDbConnected || req.__testRevocation) {
            let dbUser = null;
            try {
                const query = User.findById(decoded.id);
                if (query && typeof query.select === "function") {
                    dbUser = await query.select("tokenVersion").lean();
                } else if (query && typeof query.then === "function") {
                    dbUser = await query;
                } else {
                    dbUser = query;
                }
            } catch (e) {
                dbUser = null;
            }

            if (!dbUser) {
                return res.status(401).json({
                    success: false,
                    message: "User account no longer exists",
                });
            }

            const currentDbVersion = dbUser.tokenVersion ?? 0;
            const tokenVersion = decoded.tokenVersion;

            // Legacy tokens issued prior to tokenVersion migration have decoded.tokenVersion === undefined.
            // They remain valid ONLY as long as currentDbVersion is 0. Once password is changed/reset, they are revoked.
            if (tokenVersion === undefined) {
                if (currentDbVersion !== 0) {
                    return res.status(401).json({
                        success: false,
                        code: "TOKEN_REVOKED",
                        message: "Token has been revoked due to a password change or reset. Please sign in again.",
                    });
                }
            } else if (tokenVersion !== currentDbVersion) {
                return res.status(401).json({
                    success: false,
                    code: "TOKEN_REVOKED",
                    message: "Token has been revoked due to a password change or reset. Please sign in again.",
                });
            }
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(401).json({
            success: false,
            message: "Something went wrong while validating the token",
        });
    }
};

// ============================================================
// isStudent — guards routes that only students can access
// ============================================================
exports.isStudent = async (req, res, next) => {
    try {
        if (req.user.accountType !== "Student") {
            return res.status(403).json({
                success: false,
                message: "This route is accessible to students only",
            });
        }
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Could not verify user role",
        });
    }
};

// ============================================================
// isInstructor — guards routes that only instructors can access
// ============================================================
exports.isInstructor = async (req, res, next) => {
    try {
        if (req.user.accountType !== "Instructor") {
            return res.status(403).json({
                success: false,
                message: "This route is accessible to instructors only",
            });
        }
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Could not verify user role",
        });
    }
};

// ============================================================
// isApprovedInstructor — guards routes that only APPROVED instructors
// can access. Always fetches authoritative role & approval status
// from MongoDB so a pending/rejected instructor cannot bypass checks
// via stale JWTs, Redux state, or modified request payloads.
// ============================================================
exports.isApprovedInstructor = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        if (req.user.accountType !== "Instructor") {
            return res.status(403).json({
                success: false,
                message: "This route is accessible to instructors only",
            });
        }

        const userId = req.user.id || req.user._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token payload",
            });
        }

        // Always fetch authoritative approval status from the database
        const query = User.findById(userId);
        const dbUser =
            query && typeof query.select === "function"
                ? await query.select("accountType approvalStatus approved")
                : await query;

        if (!dbUser) {
            return res.status(401).json({
                success: false,
                message: "User account not found",
            });
        }

        if (dbUser.accountType !== "Instructor") {
            return res.status(403).json({
                success: false,
                message: "This route is accessible to instructors only",
            });
        }

        const status = resolveInstructorApprovalStatus(dbUser);

        if (status === APPROVAL_STATUS.PENDING) {
            return res.status(403).json({
                success: false,
                code: "INSTRUCTOR_PENDING_APPROVAL",
                approvalStatus: APPROVAL_STATUS.PENDING,
                message:
                    "Your instructor account is pending administrator approval. Please wait until an administrator approves your application.",
            });
        }

        if (status === APPROVAL_STATUS.REJECTED) {
            return res.status(403).json({
                success: false,
                code: "INSTRUCTOR_REJECTED",
                approvalStatus: APPROVAL_STATUS.REJECTED,
                message:
                    "Your instructor application was not approved. Please contact support for assistance.",
            });
        }

        if (status !== APPROVAL_STATUS.APPROVED) {
            return res.status(403).json({
                success: false,
                code: "INSTRUCTOR_NOT_APPROVED",
                message: "Your instructor account is not approved for this operation",
            });
        }

        req.instructorApprovalStatus = APPROVAL_STATUS.APPROVED;
        next();
    } catch (error) {
        console.error("isApprovedInstructor middleware error:", error);
        return res.status(500).json({
            success: false,
            message: "Could not verify instructor approval status",
        });
    }
};

// ============================================================
// isAdmin — guards routes that only admins can access
// ============================================================
exports.isAdmin = async (req, res, next) => {
    try {
        if (!req.user || req.user.accountType !== "Admin") {
            return res.status(403).json({
                success: false,
                message: "This route is accessible to admins only",
            });
        }
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Could not verify user role",
        });
    }
};
