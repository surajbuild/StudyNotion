const mongoose = require('mongoose');
const Category = require('../models/Category');
const Course = require('../models/Course');
const cache = require('../utils/cache');

const CATEGORIES_CACHE_KEY = "showAllCategories";

function getRandomInt(max) {
    return Math.floor(Math.random() * max)
}

exports.createCategory = async (req, res) => {
    try{
        const {name, description} = req.body;
        if(!name){
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const category = await Category.create({
            name: name,
            description: description,
        });

        // Invalidate the categories cache — a new category just appeared
        cache.del(CATEGORIES_CACHE_KEY);

        return res.status(200).json({
            success: true,
            message: "Category Created Successfully",
            data: category,
        });
    }
    catch(error){
        return res.status(500).json({
            success: false,
            message: error.message,
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

      if (selectedCategory.courses.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No courses found for the selected category.",
        })
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