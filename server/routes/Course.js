const express = require("express");
const router = express.Router();

//course controller
const {
  createCourse,
  getAllCourses,
  searchCourses,
  getCourseDetails,
  getInstructorCourses,
  editCourse,
  deleteCourse,
  getFullCourseDetails,
} = require("../controllers/Course");

//category controllers
const {
  showAllCategories,
  categoryPageDetails,
  createCategory,
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
  isAdmin,
} = require("../middlewares/auth");


// *******************************************************************************
//                                  Course routes
// *******************************************************************************

//Ciurse can only be created by instructors
router.post("/createCourse", auth, isInstructor, createCourse);

//Add a Section to a course
router.post("/addSection", auth, isInstructor, createSection);

//Update a section
router.post("/updateSection", auth, isInstructor, updateSection);

//Delete a subsection
router.post("/deleteSection", auth, isInstructor, deleteSection);

//Add a subsection to a section
router.post("/addSubSection", auth, isInstructor, createSubSection);

//Update a subsection
router.post("/updateSubSection", auth, isInstructor, updateSubSection);

//Delete a subsection
router.post("/deleteSubSection", auth, isInstructor, deleteSubSection);

//Get all Registered Courses
router.get("/getAllCourses", getAllCourses);

//Global Course Search, Filtering, Sorting & Pagination
router.get("/search", searchCourses);

//Get Details for a specific courses
router.post("/getCourseDetails", getCourseDetails);

//Get full details of a course (for editing)
router.post("/getFullCourseDetails", auth, getFullCourseDetails);

//Edit Course routes
router.post("/editCourse", auth, isInstructor, editCourse);

//Get all courses under a specific instructor
router.get("/getInstructorCourses", auth, isInstructor, getInstructorCourses);

//Delete a course
router.delete("/deleteCourse", auth, isInstructor, deleteCourse);

router.post("/updateCourseProgress", auth, isStudent, updateCourseProgress)

// *******************************************************************************
//                                  Category routes(Only by Admin)
// *******************************************************************************
router.post("/createCategory", auth, isAdmin, createCategory);
router.get("/showAllCategories", showAllCategories);
router.post("/getCategoryPageDetails", categoryPageDetails);

// *******************************************************************************
//                                  Rating and Review
// *******************************************************************************

router.post("/createRating", auth, isStudent, createRating);
router.get("/getAverageRating", getAverageRating);
router.get("/getReviews", getAllRating);

module.exports = router;
