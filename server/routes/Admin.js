const express = require("express");
const router = express.Router();

const { auth, isAdmin } = require("../middlewares/auth");
const {
    getUserStats,
    getUsers,
    getInstructors,
    getUserById,
    approveInstructor,
    rejectInstructor,
} = require("../controllers/AdminUsers");

// ============================================================
// Admin User Management & Instructor Approval Routes
// Strictly protected by authentication + isAdmin authorization
// ============================================================
router.get("/users/stats", auth, isAdmin, getUserStats);
router.get("/users", auth, isAdmin, getUsers);
router.get("/users/:userId", auth, isAdmin, getUserById);
router.get("/instructors", auth, isAdmin, getInstructors);
router.put("/instructors/:userId/approve", auth, isAdmin, approveInstructor);
router.put("/instructors/:userId/reject", auth, isAdmin, rejectInstructor);

module.exports = router;
