const express = require("express");
const router = express.Router();

//course controller
const {
  createCourse,
  getAllCourses,
  searchCourses,
  getCourseDetails,
  getInstructorCourses,
  getCourseEnrolledStudents,
  editCourse,
  deleteCourse,
  getFullCourseDetails,
} = require("../controllers/Course");

//category controllers
const {
  showAllCategories,
  categoryPageDetails,
  createCategory,
  updateCategory,
  deleteCategory,
  getAdminDashboard,
} = require("../controllers/Category");

//sub-section controllers
const {
  createSubSection,
  updateSubSection,
  deleteSubSection,
} = require("../controllers/Subsection");

//rating controllers
const {
  createRating,
  getAverageRating,
  getAllRating,
} = require("../controllers/RatingAndReview");

const {
  updateCourseProgress
} = require("../controllers/courseProgress");

//section controllers
const {
  createSection,
  updateSection,
  deleteSection,
} = require("../controllers/Section");

//middlewares
const {
  auth,
  isStudent,
  isInstructor,
  isApprovedInstructor,
  isAdmin,
} = require("../middlewares/auth");
const { validateThumbnail, validateVideo } = require("../middlewares/validateUpload");


// *******************************************************************************
//                                  Course routes
// *******************************************************************************

//Course can only be created by APPROVED instructors
router.post("/createCourse", auth, isApprovedInstructor, validateThumbnail, createCourse);

//Add a Section to a course
router.post("/addSection", auth, isApprovedInstructor, createSection);

//Update a section
router.post("/updateSection", auth, isApprovedInstructor, updateSection);

//Delete a subsection
router.post("/deleteSection", auth, isApprovedInstructor, deleteSection);

//Add a subsection to a section
router.post("/addSubSection", auth, isApprovedInstructor, validateVideo, createSubSection);

//Update a subsection
router.post("/updateSubSection", auth, isApprovedInstructor, validateVideo, updateSubSection);

//Delete a subsection
router.post("/deleteSubSection", auth, isApprovedInstructor, deleteSubSection);

//Get all Registered Courses
router.get("/getAllCourses", getAllCourses);

//Global Course Search, Filtering, Sorting & Pagination
router.get("/search", searchCourses);

//Get Details for a specific courses
router.post("/getCourseDetails", getCourseDetails);

//Get full details of a course (for editing)
router.post("/getFullCourseDetails", auth, getFullCourseDetails);

//Edit Course routes
router.post("/editCourse", auth, isApprovedInstructor, validateThumbnail, editCourse);

//Get all courses under a specific instructor
router.get("/getInstructorCourses", auth, isApprovedInstructor, getInstructorCourses);

//Get enrolled students & progress roster for an instructor's own course (F-INS-11)
router.get("/:courseId/enrolled-students", auth, isApprovedInstructor, getCourseEnrolledStudents);

//Delete a course
router.delete("/deleteCourse", auth, isApprovedInstructor, deleteCourse);

router.post("/updateCourseProgress", auth, isStudent, updateCourseProgress)

// *******************************************************************************
//                                  Category & Admin routes(Admin Only for mutations)
// *******************************************************************************
router.get("/adminDashboard", auth, isAdmin, getAdminDashboard);
router.post("/createCategory", auth, isAdmin, createCategory);
router.put("/updateCategory", auth, isAdmin, updateCategory);
router.delete("/deleteCategory", auth, isAdmin, deleteCategory);
router.get("/showAllCategories", showAllCategories);
router.post("/getCategoryPageDetails", categoryPageDetails);

// *******************************************************************************
//                                  Rating and Review
// *******************************************************************************

router.post("/createRating", auth, isStudent, createRating);
router.get("/getAverageRating", getAverageRating);
router.get("/getReviews", getAllRating);

module.exports = router;
