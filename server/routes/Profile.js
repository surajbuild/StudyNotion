const express = require("express");
const router = express.Router();
const { auth, isApprovedInstructor } = require("../middlewares/auth");


const {
    deleteAccount,
    updateProfile,
    getAllUserDetails,
    updateDisplayPicture,
    getEnrolledCourses,
    instructorDashboard,
} = require("../controllers/Profile");

// ─── Profile routes ───────────────────────────────────────────────────────────

router.delete("/deleteProfile", auth, deleteAccount);
router.put("/updateProfile", auth, updateProfile);
router.get("/getUserDetails", auth, getAllUserDetails);
router.get("/getEnrolledCourses", auth, getEnrolledCourses);
router.put("/updateDisplayPicture", auth, updateDisplayPicture);
router.get("/instructorDashboard", auth, isApprovedInstructor, instructorDashboard);

module.exports = router;
