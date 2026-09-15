const RatingAndReview = require("../models/RatingAndReview");
const Course = require('../models/Course');
const { default: mongoose } = require("mongoose");
const cache = require('../utils/cache');

//create rating
exports.createRating = async (req, res) => {
    try{
        //get user id
        const userId = req.user.id;
        //fetch data from req.body
        const { rating, review, courseId } = req.body;
        //check if user is enrolled or not
        const courseDetails = await Course.findOne(
                              {_id: courseId,
                                studentEnrolled: {$elemMatch: {$eq: userId}}
                              }                 
        );

        if(!courseDetails) {
            return res.status(404).json({
                success: false,
                message: 'Students is not enrolled in the course',
            });
        }
        //check if user already reviewed the course
        const alreadyReviewed = await RatingAndReview.findOne({
                                user:userId,
                                course:courseId,
                                });
                                if(alreadyReviewed) {
                                    return res.status(403).json({
                                        success: false,
                                        message: 'Course is already reviewed by the user'
                                    });
                                }
        //create rating and review
        const ratingReview = await RatingAndReview.create({
                                rating, review,
                                course: courseId,
                                user: userId,
                                });
        //update course with this rating and review
        const updatedCourseDetails = await Course.findByIdAndUpdate({_id:courseId},
                                      {
                                        $push:{
                                            ratingAndReviews: ratingReview._id,
                                        }
                                    },
                                    {new: true},
                                )

        // Ratings affect the course-details and course-list pages
        cache.del("getAllCourses");
        cache.del("getCourseDetails:" + courseId);

        //return respponse
        return res.status(200).json({
            success: true,
            message: 'Rating and Review created successfully',
            ratingReview,
        })
    }
    catch(error){
        console.error('createRating error:', error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

//get average rating
exports.getAverageRating = async  (req, res) =>  {
    try{
        //get course Id
        const courseId = req.body.courseId;
        //calculation avg rating
        const result = await RatingAndReview.aggregate([
            {
                $match: {
                    course: new mongoose.Types.ObjectId(courseId),
                }
            },
            {
                $group:{
                    _id: null,
                    averageRating: {$avg: "$rating"},
                    totalRatings: { $sum: 1 },
                }
            }
        ]);


        //return rating  
        if(result.length > 0) {
            return res.status(200).json({
                success: true,
                averageRating: result[0].averageRating,
            });
        }
        //if no rating review exsits
        return res.status(200).json({
            success: true,
            message: "Average Rating is 0, no ratings given till now",
            averageRating: 0,
        })
    }
    catch(error){
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

//get all rating and reviews
exports.getAllRating = async (req, res) => {
    try{
        const allReviews = await RatingAndReview.find({})
                           .sort({rating: "desc"})
                           .limit(20)
                           .populate({
                            path: "user",
                            select: "firstName lastName email image",
                           })
                           .populate({
                            path: "course",
                            select: "courseName"
                           })
                           .exec();
        return res.status(200).json({
            success: true,
            message: "All reviews fetched successfully",
            data: allReviews,
        });
    }
    catch(error){
        return res.status(500).json({
            success: false,
            error: error.message,
        })
    }
}
