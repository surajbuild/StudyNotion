const Course = require("../models/Course");
const Category = require("../models/Category");
const User = require("../models/User");
const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const CourseProgress = require("../models/CourseProgress");
const { imageUploadToCloudinary } = require("../utils/imageUploader");
const cache = require("../utils/cache");

const ALL_COURSES_CACHE_KEY = "getAllCourses";
const COURSE_DETAILS_PREFIX = "getCourseDetails:";

// Helper: convert total seconds → human-readable string (e.g. "2h 30m")
const convertSecondsToDuration = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

// ============================================================
// CREATE COURSE
// ============================================================
exports.createCourse = async (req, res) => {
  try {
    const userId = req.user.id;

    let {
      courseName,
      courseDescription,
      whatYouWillLearn,
      price,
      tag,
      category,
      status,
      instructions,
    } = req.body;

    const thumbnail = req.files?.thumbnailImage;

    if (!courseName || !courseDescription || !whatYouWillLearn || !price) {
      return res.status(400).json({
        success: false,
        message: "Course name, description, benefits, and price are mandatory",
      });
    }

    // Default to Draft when status is not explicitly provided
    if (!status) status = "Draft";

    // Verify the requesting user is an instructor
    const instructorDetails = await User.findById(userId);
    if (!instructorDetails || instructorDetails.accountType !== "Instructor") {
      return res.status(404).json({
        success: false,
        message: "Instructor details not found",
      });
    }

    // Validate category if one was provided
    let categoryId = null;
    if (category) {
      const categoryDetails = await Category.findById(category);
      if (!categoryDetails) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
      categoryId = categoryDetails._id;
    }

    // Upload thumbnail to Cloudinary if provided
    let thumbnailUrl = null;
    if (thumbnail) {
      const uploaded = await imageUploadToCloudinary(
        thumbnail,
        process.env.FOLDER_NAME,
      );
      thumbnailUrl = uploaded.secure_url;
    }

    const newCourse = await Course.create({
      courseName,
      courseDescription,
      instructor: instructorDetails._id,
      whatYouWillLearn,
      price,
      tag: tag || "general",
      category: categoryId,
      thumbnail: thumbnailUrl || null,
      status,
      instructions,
    });

    // Add the new course to the instructor's course list
    await User.findByIdAndUpdate(
      instructorDetails._id,
      { $push: { courses: newCourse._id } },
      { new: true },
    );

    // ✅ FIX: Changed `course` → `courses` in the $push operator.
    // The Category model defines the field as `courses` (plural).  Using `course`
    // (singular) silently created a new, unrelated field on the Category document
    // instead of adding to the correct array — so catalog pages never showed
    // newly created courses.
    if (categoryId) {
      await Category.findByIdAndUpdate(
        categoryId,
        { $push: { courses: newCourse._id } },
        { new: true },
      );
    }

    // Invalidate caches so the new course shows up immediately
    cache.del(ALL_COURSES_CACHE_KEY);
    cache.del(COURSE_DETAILS_PREFIX + newCourse._id);

    return res.status(200).json({
      success: true,
      data: newCourse,
      message: "Course created successfully",
    });
  } catch (error) {
    console.error("createCourse error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create course",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL COURSES
// ============================================================
exports.getAllCourses = async (req, res) => {
  try {
    const cached = cache.get(ALL_COURSES_CACHE_KEY);
    if (cached) {
      return res.status(200).json({
        success: true,
        message: "All courses fetched successfully",
        data: cached,
      });
    }

    const allCourses = await Course.find(
      {status: "Published"},
      {
        courseName: true,
        price: true,
        thumbnail: true,
        instructor: true,
        ratingAndReviews: true,
        studentEnrolled: true,
      },
    )
      .populate({
        path: "instructor",
        select: "firstName lastName email image",
      })
      .exec();

    cache.set(ALL_COURSES_CACHE_KEY, allCourses, 5 * 60 * 1000);

    return res.status(200).json({
      success: true,
      message: "All courses fetched successfully",
      data: allCourses,
    });
  } catch (error) {
    console.error("getAllCourses error:", error);
    return res.status(500).json({
      success: false,
      message: "Cannot fetch course data",
      error: error.message,
    });
  }
};

// ============================================================
// GET COURSE DETAILS (public — used on course listing pages)
// ============================================================
exports.getCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    const cacheKey = COURSE_DETAILS_PREFIX + courseId;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        message: "Course details fetched successfully",
        data: cached,
      });
    }

    const courseDetails = await Course.findById(courseId)
      .populate({
        path: "instructor",
        populate: { path: "additionalDetails" },
      })
      .populate("category")
      .populate("ratingAndReviews")
      .populate({
        path: "courseContent",
        populate: { path: "subSection" },
      })
      .exec();

    if (!courseDetails) {
      return res.status(400).json({
        success: false,
        message: `Could not find course with id: ${courseId}`,
      });
    }

    // Calculate total duration so the frontend gets the same shape
    // as getFullCourseDetails ({ courseDetails, totalDuration })
    let totalDurationInSeconds = 0;
    if (Array.isArray(courseDetails.courseContent)) {
      courseDetails.courseContent.forEach((section) => {
        if (Array.isArray(section.subSection)) {
          section.subSection.forEach((sub) => {
            const d = parseInt(sub.timeDuration);
            if (!isNaN(d)) totalDurationInSeconds += d;
          });
        }
      });
    }

    const responseData = {
      courseDetails,
      totalDuration: convertSecondsToDuration(totalDurationInSeconds),
    };
    cache.set(cacheKey, responseData, 2 * 60 * 1000);

    return res.status(200).json({
      success: true,
      message: "Course details fetched successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("getCourseDetails error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET INSTRUCTOR'S OWN COURSES
// ============================================================
exports.getInstructorCourses = async (req, res) => {
  try {
    const instructorId = req.user.id;

    const instructorCourses = await Course.find({ instructor: instructorId })
      .populate({
        path: "courseContent",
        populate: { path: "subSection" },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: instructorCourses,
    });
  } catch (error) {
    console.error("getInstructorCourses error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve instructor courses",
      error: error.message,
    });
  }
};

// ============================================================
// EDIT COURSE
// ============================================================
exports.editCourse = async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId || courseId === "undefined") {
      return res.status(400).json({
        success: false,
        message: "courseId is required",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Upload a new thumbnail if one was attached
    if (req.files?.thumbnailImage) {
      const uploaded = await imageUploadToCloudinary(
        req.files.thumbnailImage,
        process.env.FOLDER_NAME,
      );
      course.thumbnail = uploaded.secure_url;
    }

    const allowedFields = [
      "courseName",
      "courseDescription",
      "whatYouWillLearn",
      "price",
      "tag",
      "category",
      "instructions",
      "status",
    ];

    for (const key of allowedFields) {
      if (key in req.body && req.body[key] !== undefined) {
        // Arrays may arrive as JSON strings from multipart/form-data
        if (key === "tag" || key === "instructions") {
          if (typeof req.body[key] === "string") {
            try {
              course[key] = JSON.parse(req.body[key]);
            } catch {
              course[key] = [req.body[key]];
            }
          } else {
            course[key] = req.body[key];
          }
        } else {
          course[key] = req.body[key];
        }
      }
    }

    await course.save();

    const updatedCourse = await Course.findById(courseId)
      .populate({
        path: "instructor",
        populate: { path: "additionalDetails" },
      })
      .populate("category")
      .populate({
        path: "courseContent",
        populate: { path: "subSection" },
      })
      .exec();

    cache.del(ALL_COURSES_CACHE_KEY);
    cache.del(COURSE_DETAILS_PREFIX + courseId);

    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: updatedCourse,
    });
  } catch (error) {
    console.error("editCourse error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE COURSE
// ============================================================
exports.deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Only the instructor who owns the course can delete it
    if (course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this course",
      });
    }

    // Cascade-delete all sections and their subsections in two queries
    const sections = await Section.find({ _id: { $in: course.courseContent } });
    const allSubSectionIds = sections.flatMap((section) => section.subSection);

    if (allSubSectionIds.length > 0) {
        await SubSection.deleteMany({ _id: { $in: allSubSectionIds } });
    }
    await Section.deleteMany({ _id: { $in: course.courseContent } });

    await Course.findByIdAndDelete(courseId);

    cache.del(ALL_COURSES_CACHE_KEY);
    cache.del(COURSE_DETAILS_PREFIX + courseId);

    return res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("deleteCourse error:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting course",
      error: error.message,
    });
  }
};

// ============================================================
// GET FULL COURSE DETAILS (authenticated — for the edit page)
// ============================================================
exports.getFullCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    const courseDetails = await Course.findById(courseId)
      .populate({
        path: "instructor",
        populate: { path: "additionalDetails" },
      })
      .populate("category")
      .populate({
        path: "courseContent",
        populate: { path: "subSection" },
      })
      .exec();


    if (!courseDetails) {
      return res.status(404).json({
        success: false,
        message: `Course not found: ${courseId}`,
      });
    }

    // Access control:
    // - Instructors: only the course owner can access (prevents instructors
    //   from seeing other instructors' unpublished content/pricing)
    // - Students: only enrolled students can access full details
    //   (prevents non-enrolled users from getting all video URLs for free)
    const accountType = req.user.accountType;

    if (accountType === "Instructor") {
        if (courseDetails.instructor?._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view this course",
            });
        }
    } else if (accountType === "Student") {
        const isEnrolled = courseDetails.studentEnrolled
            ?.some((id) => id.toString() === userId);
        if (!isEnrolled) {
            return res.status(403).json({
                success: false,
                message: "You are not enrolled in this course",
            });
        }
    }

    // Try to load course-progress data (optional — not all students have entries)
    let courseProgressCount = null;
    try {
      courseProgressCount = await CourseProgress.findOne({
        courseID: courseId,
        userId,
      });
    } catch (progressError) {
      console.warn(
        "CourseProgress lookup failed (non-critical):",
        progressError.message,
      );
    }

    let totalDurationInSeconds = 0;
    courseDetails.courseContent.forEach((content) => {
      content.subSection.forEach((subSection) => {
        const parsed = parseInt(subSection.timeDuration);
        if (!isNaN(parsed)) totalDurationInSeconds += parsed;
      });
    });

    return res.status(200).json({
      success: true,
      data: {
        courseDetails,
        totalDuration: convertSecondsToDuration(totalDurationInSeconds),
        completedVideos: courseProgressCount?.completedVideos ?? [],
      },
    });
  } catch (error) {
    console.error("getFullCourseDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch course details",
      error: error.message,
    });
  }
};
