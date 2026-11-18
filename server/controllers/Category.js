const mongoose = require('mongoose');
const Category = require('../models/Category');
const Course = require('../models/Course');
const User = require('../models/User');
const cache = require('../utils/cache');

const CATEGORIES_CACHE_KEY = "showAllCategories";
const ALL_COURSES_CACHE_KEY = "getAllCourses";
const COURSE_DETAILS_PREFIX = "getCourseDetails:";
const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
const MAX_CATEGORY_NAME_LENGTH = 100;
const MIN_CATEGORY_NAME_LENGTH = 2;
const MAX_CATEGORY_DESCRIPTION_LENGTH = 500;

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

const slugifyCategory = (name) =>
    name
        ?.toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") || "";

const isValidObjectId = (id) =>
    typeof id === "string" && OBJECT_ID_REGEX.test(id) && mongoose.Types.ObjectId.isValid(id);

const validateCategoryPayload = ({ name, description }) => {
    if (name === undefined || name === null || typeof name !== "string" || !name.trim()) {
        return { error: "All fields are required" };
    }

    const trimmedName = name.trim();
    if (trimmedName.length < MIN_CATEGORY_NAME_LENGTH) {
        return {
            error: `Category name must be at least ${MIN_CATEGORY_NAME_LENGTH} characters long`,
        };
    }
    if (trimmedName.length > MAX_CATEGORY_NAME_LENGTH) {
        return {
            error: `Category name must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer`,
        };
    }
    if (!slugifyCategory(trimmedName)) {
        return {
            error: "Category name must contain at least one letter or number",
        };
    }

    let trimmedDescription = "";
    if (description !== undefined && description !== null) {
        if (typeof description !== "string") {
            return { error: "Category description must be a string" };
        }
        trimmedDescription = description.trim();
        if (trimmedDescription.length > MAX_CATEGORY_DESCRIPTION_LENGTH) {
            return {
                error: `Category description must be ${MAX_CATEGORY_DESCRIPTION_LENGTH} characters or fewer`,
            };
        }
    }

    return {
        name: trimmedName,
        description: trimmedDescription,
        slug: slugifyCategory(trimmedName),
    };
};

const findDuplicateCategory = async (name, slug, excludeCategoryId = null) => {
    const query = excludeCategoryId ? { _id: { $ne: excludeCategoryId } } : {};
    const existingCategories = await Category.find(query);
    if (!Array.isArray(existingCategories)) return null;

    const normalizedName = name.toLowerCase();
    return (
        existingCategories.find((cat) => {
            const catName = (cat?.name || "").trim().toLowerCase();
            return catName === normalizedName || slugifyCategory(catName) === slug;
        }) || null
    );
};

const invalidateCategoryCaches = (courseIds = []) => {
    cache.del(CATEGORIES_CACHE_KEY);
    cache.del(ALL_COURSES_CACHE_KEY);
    if (Array.isArray(courseIds)) {
        courseIds.forEach((courseId) => {
            if (courseId) {
                cache.del(COURSE_DETAILS_PREFIX + courseId.toString());
            }
        });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const validated = validateCategoryPayload(req.body || {});
        if (validated.error) {
            return res.status(400).json({
                success: false,
                message: validated.error,
            });
        }

        const duplicate = await findDuplicateCategory(validated.name, validated.slug);
        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: `Category "${duplicate.name}" already exists`,
            });
        }

        const category = await Category.create({
            name: validated.name,
            description: validated.description,
        });

        // Invalidate caches so the new category appears immediately across Navbar, Catalog, and Search
        invalidateCategoryCaches();

        return res.status(200).json({
            success: true,
            message: "Category Created Successfully",
            data: category,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { categoryId, name, description } = req.body || {};

        if (!isValidObjectId(categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Valid categoryId is required",
            });
        }

        const validated = validateCategoryPayload({ name, description });
        if (validated.error) {
            return res.status(400).json({
                success: false,
                message: validated.error,
            });
        }

        const existingCategory = await Category.findById(categoryId);
        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }

        const duplicate = await findDuplicateCategory(
            validated.name,
            validated.slug,
            categoryId
        );
        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: `Category "${duplicate.name}" already exists`,
            });
        }

        // Preserve existing `courses` array — only update name & description
        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            {
                $set: {
                    name: validated.name,
                    description: validated.description,
                },
            },
            { new: true, runValidators: true }
        );

        // Invalidate category, course list, and affected course-details caches
        const linkedCourseIds = Array.isArray(existingCategory.courses)
            ? existingCategory.courses
            : [];
        invalidateCategoryCaches(linkedCourseIds);

        return res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: updatedCategory,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to update category",
        });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { categoryId } = req.body || {};

        if (!isValidObjectId(categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Valid categoryId is required",
            });
        }

        const existingCategory = await Category.findById(categoryId);
        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }

        // Authoritative safety check: block deletion if any Course documents reference this category
        const courseCountResult = await Course.countDocuments({ category: categoryId });
        const associatedCourseCount =
            typeof courseCountResult === "number"
                ? courseCountResult
                : Array.isArray(existingCategory.courses)
                ? existingCategory.courses.length
                : 0;

        if (associatedCourseCount > 0) {
            return res.status(409).json({
                success: false,
                message: `Cannot delete category "${existingCategory.name}" because ${associatedCourseCount} course(s) are associated with it. Remove or reassign those courses first.`,
                associatedCourseCount,
            });
        }

        await Category.findByIdAndDelete(categoryId);
        invalidateCategoryCaches();

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully",
            data: { _id: categoryId },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to delete category",
        });
    }
};

exports.getAdminDashboard = async (req, res) => {
    try {
        const [
            allCategories,
            courseStatsByCategory,
            totalCourses,
            publishedCourses,
            draftCourses,
            totalStudents,
            totalInstructors,
            totalAdmins,
        ] = await Promise.all([
            Category.find({}).sort({ createdAt: -1, name: 1 }).lean(),
            Course.aggregate([
                { $match: { category: { $ne: null } } },
                {
                    $group: {
                        _id: "$category",
                        totalCourseCount: { $sum: 1 },
                        publishedCourseCount: {
                            $sum: { $cond: [{ $eq: ["$status", "Published"] }, 1, 0] },
                        },
                    },
                },
            ]),
            Course.countDocuments({}),
            Course.countDocuments({ status: "Published" }),
            Course.countDocuments({ status: "Draft" }),
            User.countDocuments({ accountType: "Student" }),
            User.countDocuments({ accountType: "Instructor" }),
            User.countDocuments({ accountType: "Admin" }),
        ]);

        const countMap = new Map();
        if (Array.isArray(courseStatsByCategory)) {
            courseStatsByCategory.forEach((row) => {
                if (row?._id) {
                    countMap.set(row._id.toString(), {
                        totalCourseCount: row.totalCourseCount || 0,
                        publishedCourseCount: row.publishedCourseCount || 0,
                    });
                }
            });
        }

        const enrichedCategories = (Array.isArray(allCategories) ? allCategories : []).map(
            (cat) => {
                const counts = countMap.get(cat._id.toString()) || {
                    totalCourseCount: 0,
                    publishedCourseCount: 0,
                };
                return {
                    ...cat,
                    slug: slugifyCategory(cat.name),
                    totalCourseCount: counts.totalCourseCount,
                    publishedCourseCount: counts.publishedCourseCount,
                };
            }
        );

        const emptyCategories = enrichedCategories.filter(
            (cat) => cat.totalCourseCount === 0
        ).length;

        return res.status(200).json({
            success: true,
            message: "Admin dashboard data fetched successfully",
            data: {
                stats: {
                    totalCategories: enrichedCategories.length,
                    emptyCategories,
                    totalCourses: totalCourses || 0,
                    publishedCourses: publishedCourses || 0,
                    draftCourses: draftCourses || 0,
                    totalUsers: (totalStudents || 0) + (totalInstructors || 0) + (totalAdmins || 0),
                    totalStudents: totalStudents || 0,
                    totalInstructors: totalInstructors || 0,
                    totalAdmins: totalAdmins || 0,
                },
                categories: enrichedCategories,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to load admin dashboard",
        });
    }
};

exports.showAllCategories = async (req, res) => {
    try{
        // Serve from cache when fresh — this endpoint is hit on essentially
        // every page load (navbar + catalog + course creation form).
        const cached = cache.get(CATEGORIES_CACHE_KEY);
        if (cached) {
            return res.status(200).json({ success: true, data: cached });
        }

        const allCategories = await Category.find({});
        cache.set(CATEGORIES_CACHE_KEY, allCategories, 5 * 60 * 1000);

        res.status(200).json({
            success: true,
            data: allCategories,
        });
    }
    catch(error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.categoryPageDetails = async (req, res) => {
    try {
      const { categoryId } = req.body

      // Get courses for the specified category
      const selectedCategory = await Category.findById(categoryId)
        .populate({
          path: "courses",
          match: { status: "Published" },
          populate: [
            {
              path: "instructor",
              select: "firstName lastName image",
            },
            {
              path: "ratingAndReviews",
            },
          ],
        })
        .exec()

      if (!selectedCategory) {
        return res
          .status(404)
          .json({ success: false, message: "Category not found" })
      }

      // Get courses for a random other category
      const categoriesExceptSelected = await Category.find({
        _id: { $ne: categoryId },
      })
      let differentCategory = categoriesExceptSelected.length > 0
        ? await Category.findById(
            categoriesExceptSelected[getRandomInt(categoriesExceptSelected.length)]._id
          )
          .populate({
            path: "courses",
            match: { status: "Published" },
            populate: [
              {
                path: "instructor",
                select: "firstName lastName image",
              },
              {
                path: "ratingAndReviews",
              },
            ],
          })
          .exec()
        : null

      // Top-selling courses via a single aggregation
      const mostSellingCourses = await Course.aggregate([
        { $match: { status: "Published" } },
        {
          $addFields: {
            studentEnrolledCount: { $size: { $ifNull: ["$studentEnrolled", []] } },
          },
        },
        { $sort: { studentEnrolledCount: -1 } },
        { $limit: 10 },
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
            from: "ratingandreviews",
            localField: "ratingAndReviews",
            foreignField: "_id",
            as: "ratingAndReviews",
          },
        },
      ])

      res.status(200).json({
        success: true,
        data: {
          selectedCategory,
          differentCategory,
          mostSellingCourses,
        },
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      })
    }
  }