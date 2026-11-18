const jwt = require("jsonwebtoken");
const { isTestMode } = require("../config/testSafety");
if (!isTestMode()) {
    require("dotenv").config();
}
const User = require("../models/User");

// ============================================================
// auth — verifies the JWT attached to every protected request
// ============================================================
exports.auth = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");
        const token =
            req.cookies?.token ||
            req.body?.token ||
            (authHeader && authHeader.replace("Bearer ", ""));

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing",
            });
        }

        // Verify the token signature and expiry against our secret
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: "Token is invalid or has expired",
            });
        }

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
