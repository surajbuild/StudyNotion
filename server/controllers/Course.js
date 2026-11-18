const mongoose = require("mongoose");
const Course = require("../models/Course");
const Category = require("../models/Category");
const User = require("../models/User");
const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const CourseProgress = require("../models/CourseProgress");
const { imageUploadToCloudinary } = require("../utils/imageUploader");
const cache = require("../utils/cache");
const {
  APPROVAL_STATUS,
  resolveInstructorApprovalStatus,
} = require("../utils/instructorApproval");

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

    const isPriceMissing = price === undefined || price === null || price === "";
    if (!courseName || !courseDescription || !whatYouWillLearn || isPriceMissing) {
      return res.status(400).json({
        success: false,
        message: "Course name, description, benefits, and price are mandatory",
      });
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Course price must be a non-negative number",
      });
    }
    price = numericPrice;

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

    // Parse tag and instructions arrays when sent as JSON strings via multipart/form-data
    let parsedTag = ["general"];
    if (tag !== undefined && tag !== null && tag !== "") {
      if (typeof tag === "string") {
        try {
          const parsed = JSON.parse(tag);
          parsedTag = Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
          parsedTag = [tag];
        }
      } else if (Array.isArray(tag)) {
        parsedTag = tag;
      }
    }

    let parsedInstructions = [];
    if (instructions !== undefined && instructions !== null && instructions !== "") {
      if (typeof instructions === "string") {
        try {
          const parsed = JSON.parse(instructions);
          parsedInstructions = Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
          parsedInstructions = [instructions];
        }
      } else if (Array.isArray(instructions)) {
        parsedInstructions = instructions;
      }
    }

    const newCourse = await Course.create({
      courseName,
      courseDescription,
      instructor: instructorDetails._id,
      whatYouWillLearn,
      price,
      tag: parsedTag,
      category: categoryId,
      thumbnail: thumbnailUrl || null,
      status,
      instructions: parsedInstructions,
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

    // Only the instructor who owns the course can edit it
    if (course.instructor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this course",
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
        } else if (key === "price") {
          const rawPrice = req.body[key];
          const numericPrice = Number(rawPrice);
          if (rawPrice === "" || rawPrice === null || !Number.isFinite(numericPrice) || numericPrice < 0) {
            return res.status(400).json({
              success: false,
              message: "Course price must be a non-negative number",
            });
          }
          course.price = numericPrice;
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

    // Only the instructor who owns the course can edit it
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

    // Remove course from instructor's courses list
    await User.findByIdAndUpdate(course.instructor, { $pull: { courses: courseId } });

    // Remove course from category
    if (course.category) {
      await Category.findByIdAndUpdate(course.category, { $pull: { courses: courseId } });
    }

    // Remove course from enrolled students and any persistent student carts
    await User.updateMany(
      { $or: [{ courses: courseId }, { cart: courseId }] },
      { $pull: { courses: courseId, cart: courseId } }
    );

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
        // Verify authoritative instructor approval status from DB (never trust JWT/client)
        const instructorQuery = User.findById(userId);
        const dbInstructor =
            instructorQuery && typeof instructorQuery.select === "function"
                ? await instructorQuery.select("accountType approvalStatus approved")
                : await instructorQuery;
        if (!dbInstructor || dbInstructor.accountType !== "Instructor") {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view this course",
            });
        }
        const approvalStatus = resolveInstructorApprovalStatus(dbInstructor);
        if (approvalStatus !== APPROVAL_STATUS.APPROVED) {
            return res.status(403).json({
                success: false,
                code:
                    approvalStatus === APPROVAL_STATUS.REJECTED
                        ? "INSTRUCTOR_REJECTED"
                        : "INSTRUCTOR_PENDING_APPROVAL",
                approvalStatus,
                message:
                    approvalStatus === APPROVAL_STATUS.REJECTED
                        ? "Your instructor application was not approved. Please contact support for assistance."
                        : "Your instructor account is pending administrator approval.",
            });
        }

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

// ============================================================
// GLOBAL COURSE SEARCH, FILTERING, SORTING & PAGINATION (GAP-004)
// ============================================================
const MAX_SEARCH_QUERY_LENGTH = 100;
const MAX_SEARCH_TOKENS = 8;
const MAX_TAG_LENGTH = 50;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 9;
const MAX_LIMIT = 50;
const MAX_PAGE = 100000;
const ALLOWED_PRICE_TYPES = new Set(["all", "free", "paid"]);
const ALLOWED_SORTS = new Set(["newest", "popular", "price_asc", "price_desc", "rating"]);
const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getScalarStringParam = (query, name) => {
  if (!(name in query) || query[name] === undefined || query[name] === null) {
    return { present: false, value: "" };
  }
  const raw = query[name];
  if (typeof raw !== "string") {
    return { present: true, error: `Invalid query parameter: ${name}` };
  }
  return { present: true, value: raw.trim() };
};

const parseSearchParams = (query = {}) => {
  // Reject operator/bracket injection keys (covers both Express 5 simple parser and qs extended parser)
  for (const [key, val] of Object.entries(query)) {
    if (/[$[\]]/.test(key)) {
      return { error: `Invalid query parameter: ${key}` };
    }
    if (val !== undefined && val !== null && typeof val !== "string") {
      return { error: `Invalid query parameter: ${key}` };
    }
  }

  // 1. Search query `q`
  const qParam = getScalarStringParam(query, "q");
  if (qParam.error) return { error: qParam.error };
  if (qParam.value.length > MAX_SEARCH_QUERY_LENGTH) {
    return { error: `Search query must be ${MAX_SEARCH_QUERY_LENGTH} characters or fewer` };
  }

  // 2. Category ObjectId
  const catParam = getScalarStringParam(query, "category");
  if (catParam.error) return { error: catParam.error };
  let categoryId = null;
  if (catParam.value !== "") {
    if (!OBJECT_ID_REGEX.test(catParam.value) || !mongoose.Types.ObjectId.isValid(catParam.value)) {
      return { error: "Invalid category ID" };
    }
    categoryId = new mongoose.Types.ObjectId(catParam.value);
  }

  // 3. Price type (all | free | paid)
  const priceTypeParam = getScalarStringParam(query, "priceType");
  if (priceTypeParam.error) return { error: priceTypeParam.error };
  const priceType = priceTypeParam.value === "" ? "all" : priceTypeParam.value.toLowerCase();
  if (!ALLOWED_PRICE_TYPES.has(priceType)) {
    return { error: "Invalid priceType. Allowed values: all, free, paid" };
  }

  // 4. Min / Max price
  const minPriceParam = getScalarStringParam(query, "minPrice");
  if (minPriceParam.error) return { error: minPriceParam.error };
  let minPrice = null;
  if (minPriceParam.value !== "") {
    const parsed = Number(minPriceParam.value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: "minPrice must be a non-negative number" };
    }
    minPrice = parsed;
  }

  const maxPriceParam = getScalarStringParam(query, "maxPrice");
  if (maxPriceParam.error) return { error: maxPriceParam.error };
  let maxPrice = null;
  if (maxPriceParam.value !== "") {
    const parsed = Number(maxPriceParam.value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: "maxPrice must be a non-negative number" };
    }
    maxPrice = parsed;
  }

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return { error: "minPrice cannot be greater than maxPrice" };
  }

  // 5. Minimum rating (0..5)
  const minRatingParam = getScalarStringParam(query, "minRating");
  if (minRatingParam.error) return { error: minRatingParam.error };
  let minRating = null;
  if (minRatingParam.value !== "") {
    const parsed = Number(minRatingParam.value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) {
      return { error: "minRating must be a number between 0 and 5" };
    }
    minRating = parsed;
  }

  // 6. Optional tag filter
  const tagParam = getScalarStringParam(query, "tag");
  if (tagParam.error) return { error: tagParam.error };
  if (tagParam.value.length > MAX_TAG_LENGTH) {
    return { error: `Tag filter must be ${MAX_TAG_LENGTH} characters or fewer` };
  }
  const tag = tagParam.value || null;

  // 7. Sort option
  const sortParam = getScalarStringParam(query, "sort");
  if (sortParam.error) return { error: sortParam.error };
  const sort = sortParam.value === "" ? "newest" : sortParam.value.toLowerCase();
  if (!ALLOWED_SORTS.has(sort)) {
    return { error: "Invalid sort option. Allowed values: newest, popular, price_asc, price_desc, rating" };
  }

  // 8. Pagination: page & limit
  const pageParam = getScalarStringParam(query, "page");
  if (pageParam.error) return { error: pageParam.error };
  let page = DEFAULT_PAGE;
  if (pageParam.value !== "") {
    if (!/^\d+$/.test(pageParam.value)) {
      return { error: "page must be a positive integer" };
    }
    const parsedPage = Number(pageParam.value);
    if (!Number.isSafeInteger(parsedPage) || parsedPage < 1 || parsedPage > MAX_PAGE) {
      return { error: `page must be an integer between 1 and ${MAX_PAGE}` };
    }
    page = parsedPage;
  }

  const limitParam = getScalarStringParam(query, "limit");
  if (limitParam.error) return { error: limitParam.error };
  let limit = DEFAULT_LIMIT;
  if (limitParam.value !== "") {
    if (!/^\d+$/.test(limitParam.value)) {
      return { error: "limit must be a positive integer" };
    }
    const parsedLimit = Number(limitParam.value);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1) {
      return { error: "limit must be a positive integer" };
    }
    limit = Math.min(parsedLimit, MAX_LIMIT);
  }

  return {
    q: qParam.value,
    categoryId,
    categoryRaw: categoryId ? catParam.value : null,
    priceType,
    minPrice,
    maxPrice,
    minRating,
    tag,
    sort,
    page,
    limit,
  };
};

exports.searchCourses = async (req, res) => {
  try {
    const parsed = parseSearchParams(req.query || {});
    if (parsed.error) {
      return res.status(400).json({
        success: false,
        message: parsed.error,
      });
    }

    const {
      q,
      categoryId,
      categoryRaw,
      priceType,
      minPrice,
      maxPrice,
      minRating,
      tag,
      sort,
      page,
      limit,
    } = parsed;

    // Always restrict public search strictly to Published courses (never expose Drafts)
    const andConditions = [{ status: "Published" }];

    if (categoryId) {
      andConditions.push({ category: categoryId });
    }

    if (priceType === "free") {
      andConditions.push({ price: 0 });
    } else if (priceType === "paid") {
      andConditions.push({ price: { $gt: 0 } });
    }

    if (minPrice !== null) {
      andConditions.push({ price: { $gte: minPrice } });
    }

    if (maxPrice !== null) {
      andConditions.push({ price: { $lte: maxPrice } });
    }

    if (tag) {
      const tagRegex = new RegExp(escapeRegex(tag), "i");
      andConditions.push({ tag: tagRegex });
    }

    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TOKENS);
      for (const token of tokens) {
        const tokenRegex = new RegExp(escapeRegex(token), "i");
        andConditions.push({
          $or: [
            { courseName: tokenRegex },
            { courseDescription: tokenRegex },
            { whatYouWillLearn: tokenRegex },
            { tag: tokenRegex },
          ],
        });
      }
    }

    const matchStage = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };
    const needsRatingBeforePagination = (minRating !== null && minRating > 0) || sort === "rating";

    const pipeline = [{ $match: matchStage }];

    // Compute studentEnrolledCount before sort when sorting by popularity
    if (sort === "popular") {
      pipeline.push({
        $addFields: {
          studentEnrolledCount: { $size: { $ifNull: ["$studentEnrolled", []] } },
        },
      });
    }

    if (needsRatingBeforePagination) {
      pipeline.push(
        {
          $lookup: {
            from: "ratingandreviews",
            localField: "_id",
            foreignField: "course",
            as: "_ratingDocs",
            pipeline: [{ $project: { rating: 1 } }],
          },
        },
        {
          $addFields: {
            reviewCount: { $size: "$_ratingDocs" },
            averageRating: {
              $cond: [
                { $gt: [{ $size: "$_ratingDocs" }, 0] },
                { $round: [{ $avg: "$_ratingDocs.rating" }, 1] },
                0,
              ],
            },
          },
        }
      );

      if (minRating !== null && minRating > 0) {
        pipeline.push({
          $match: {
            averageRating: { $gte: minRating },
          },
        });
      }
    }

    let sortStage;
    switch (sort) {
      case "popular":
        sortStage = { studentEnrolledCount: -1, createdAt: -1, _id: -1 };
        break;
      case "price_asc":
        sortStage = { price: 1, createdAt: -1, _id: -1 };
        break;
      case "price_desc":
        sortStage = { price: -1, createdAt: -1, _id: -1 };
        break;
      case "rating":
        sortStage = { averageRating: -1, reviewCount: -1, createdAt: -1, _id: -1 };
        break;
      case "newest":
      default:
        sortStage = { createdAt: -1, _id: -1 };
        break;
    }

    const coursesBranch = [
      { $sort: sortStage },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "instructor",
          foreignField: "_id",
          as: "instructor",
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                image: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: "$instructor", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
          pipeline: [
            {
              $project: {
                name: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    ];

    if (needsRatingBeforePagination) {
      coursesBranch.push({
        $addFields: {
          ratingAndReviews: "$_ratingDocs",
          studentEnrolledCount: { $size: { $ifNull: ["$studentEnrolled", []] } },
        },
      });
    } else {
      coursesBranch.push(
        {
          $lookup: {
            from: "ratingandreviews",
            localField: "_id",
            foreignField: "course",
            as: "ratingAndReviews",
            pipeline: [{ $project: { rating: 1 } }],
          },
        },
        {
          $addFields: {
            studentEnrolledCount: { $size: { $ifNull: ["$studentEnrolled", []] } },
            reviewCount: { $size: "$ratingAndReviews" },
            averageRating: {
              $cond: [
                { $gt: [{ $size: "$ratingAndReviews" }, 0] },
                { $round: [{ $avg: "$ratingAndReviews.rating" }, 1] },
                0,
              ],
            },
          },
        }
      );
    }

    coursesBranch.push({
      $project: {
        courseName: 1,
        courseDescription: 1,
        whatYouWillLearn: 1,
        price: 1,
        thumbnail: 1,
        tag: 1,
        status: 1,
        createdAt: 1,
        instructor: 1,
        category: 1,
        ratingAndReviews: 1,
        studentEnrolled: 1,
        studentEnrolledCount: 1,
        averageRating: 1,
        reviewCount: 1,
      },
    });

    pipeline.push({
      $facet: {
        metadata: [{ $count: "totalCourses" }],
        courses: coursesBranch,
      },
    });

    const aggregateResult = await Course.aggregate(pipeline);
    const facet = Array.isArray(aggregateResult) && aggregateResult[0] ? aggregateResult[0] : {};
    const courses = Array.isArray(facet.courses) ? facet.courses : [];
    const totalCourses = facet.metadata?.[0]?.totalCourses || 0;
    const totalPages = totalCourses > 0 ? Math.ceil(totalCourses / limit) : 0;

    return res.status(200).json({
      success: true,
      message: "Courses fetched successfully",
      data: {
        courses,
        pagination: {
          page,
          limit,
          totalCourses,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: totalCourses > 0 && page > 1,
        },
        filters: {
          q,
          category: categoryRaw,
          priceType,
          minPrice,
          maxPrice,
          minRating,
          tag,
          sort,
        },
      },
    });
  } catch (error) {
    console.error("searchCourses error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search courses",
      error: error.message,
    });
  }
};
