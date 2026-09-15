const mongoose = require("mongoose");
const Profile = require("../models/Profile");
const User = require("../models/User");
const CourseProgress = require("../models/CourseProgress");
const Course = require("../models/Course");
const { imageUploadToCloudinary } = require("../utils/imageUploader");

// Helper: convert total seconds 
const convertSecondsToDuration = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
};

// ============================================================
// UPDATE PROFILE — updates name and additional details
// ============================================================
exports.updateProfile = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            dateOfBirth = "",
            about = "",
            contactNumber,
            gender,
        } = req.body;

        const id = req.user.id;

        if (!contactNumber || !gender || !id) {
            return res.status(400).json({
                success: false,
                message: "Contact number and gender are required",
            });
        }

        const userDetails = await User.findById(id);
        if (!userDetails) {
            return res.status(404).json({
                success: false,
                message: "User does not exist",
            });
        }

        const profileDetails = await Profile.findById(userDetails.additionalDetails);
        if (!profileDetails) {
            return res.status(404).json({
                success: false,
                message: "Profile not found",
            });
        }

        // Only update name fields if new values were provided
        if (firstName) userDetails.firstName = firstName;
        if (lastName) userDetails.lastName = lastName;
        await userDetails.save();

        // Update the embedded profile document
        profileDetails.dateOfBirth = dateOfBirth;
        profileDetails.gender = gender;
        profileDetails.about = about;
        profileDetails.contactNumber = contactNumber;
        await profileDetails.save();

        // Re-fetch the complete user with populated additionalDetails for the response
        const updatedUserDetails = await User.findById(id)
            .populate("additionalDetails")
            .exec();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            profileDetails,
            updatedUserDetails,
        });
    } catch (error) {
        console.error("updateProfile error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update profile",
            error: error.message,
        });
    }
};

// ============================================================
// UPDATE DISPLAY PICTURE — uploads a new avatar to Cloudinary
// ============================================================
exports.updateDisplayPicture = async (req, res) => {
    try {
        const userId = req.user.id;
        const displayPicture = req.files?.displayPicture;

        if (!displayPicture) {
            return res.status(400).json({
                success: false,
                message: "Display picture file is required",
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const uploadResult = await imageUploadToCloudinary(
            displayPicture,
            process.env.FOLDER_NAME
        );

        user.image = uploadResult.secure_url;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Display picture updated successfully",
            image: user.image,
            user,
        });
    } catch (error) {
        console.error("updateDisplayPicture error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update display picture",
            error: error.message,
        });
    }
};

// ============================================================
// DELETE ACCOUNT — removes user and their profile from the DB
// ============================================================
exports.deleteAccount = async (req, res) => {
    try {
        const id = req.user.id;

        const userDetails = await User.findById({_id: id});
        if (!userDetails) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Delete the embedded Profile document (Mongoose handles ObjectId casting)
        if (userDetails.additionalDetails) {
            await Profile.findByIdAndDelete(userDetails.additionalDetails);
        }

        // Remove this user from every course they were enrolled in — one query instead of N
        if (userDetails.courses.length > 0) {
            await Course.updateMany(
                { _id: { $in: userDetails.courses } },
                { $pull: { studentEnrolled: id } },
            );
        }

        // Delete all course progress records for this user
        // ✅ FIX: this was placed AFTER the return statement — it never executed,
        // leaving orphan CourseProgress documents in the DB.
        await CourseProgress.deleteMany({ userId: id });

        await User.findByIdAndDelete({ _id: id });

        return res.status(200).json({
            success: true,
            message: "Account deleted successfully",
        });
    } catch (error) {
        console.error("deleteAccount error:", error);
        return res.status(500).json({
            success: false,
            message: "Could not delete account",
            error: error.message,
        });
    }
};

// ============================================================
// GET ALL USER DETAILS — returns the authenticated user's data
// ============================================================
exports.getAllUserDetails = async (req, res) => {
    try {
        const id = req.user.id;

        const userDetails = await User.findById(id)
            .populate("additionalDetails")
            .exec();

        if (!userDetails) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "User data fetched successfully",
            userDetails,
        });
    } catch (error) {
        console.error("getAllUserDetails error:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ============================================================
// GET ENROLLED COURSES — returns all courses a student is enrolled in
// ============================================================
exports.getEnrolledCourses = async (req, res) => {
    try {
        const userId = req.user.id;

        
        let userDetails = await User.findOne({ _id: userId })
            .populate({
                path: "courses",
                populate: {
                    path: "courseContent",
                    populate: { path: "subSection" },
                },
            })
            .exec();

        if (!userDetails) {
            return res.status(400).json({
                success: false,
                message: `Could not find user with id: ${userId}`,
            });
        }
        
        userDetails = userDetails.toObject();

        // Batch-fetch ALL progress docs for this user in ONE query (was N+1)
        const allProgressDocs = await CourseProgress.find({ userId: userId });
        const progressMap = new Map(allProgressDocs.map((doc) => [doc.courseID.toString(), doc]));

        for (let i = 0; i < userDetails.courses.length; i++) {
            let totalDurationInSeconds = 0;
            let totalSubSections = 0;

            for (let j = 0; j < userDetails.courses[i].courseContent.length; j++) {
                // Sum up all subsection durations
                totalDurationInSeconds += userDetails.courses[i].courseContent[j].subSection.reduce(
                    (acc, curr) => acc + parseInt(curr.timeDuration || 0),
                    0
                );
                totalSubSections += userDetails.courses[i].courseContent[j].subSection.length;
            }

            // Attach human-readable total duration to each course
            userDetails.courses[i].totalDuration = convertSecondsToDuration(totalDurationInSeconds);

            // Look up how many videos this user has completed in this course
            const courseProgressDoc = progressMap.get(userDetails.courses[i]._id.toString());

            const completedCount = courseProgressDoc?.completedVideos?.length || 0;

            // Avoid division by zero; treat courses with no content as 100% complete
            if (totalSubSections === 0) {
                userDetails.courses[i].progressPercentage = 100;
            } else {
                // Round to 2 decimal places
                const multiplier = Math.pow(10, 2);
                userDetails.courses[i].progressPercentage =
                    Math.round((completedCount / totalSubSections) * 100 * multiplier) / multiplier;
            }
        }

        return res.status(200).json({
            success: true,
            data: userDetails.courses,
        });
    } catch (error) {
        console.error("getEnrolledCourses error:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ============================================================
// INSTRUCTOR DASHBOARD — returns stats for the instructor's courses
// ============================================================

exports.instructorDashboard = async(req, res) => {
    try{
        const courseDetails = await Course.find({instructor: req.user.id});
        const courseData = courseDetails.map((course) => {
            const totalStudentsEnrolled = course.studentEnrolled.length
            const totalAmountGenerated = totalStudentsEnrolled * course.price

            //create a new object with the additional fields
            const courseDataWithStats = {
                _id: course._id,
                courseName: course.courseName,
                courseDescription: course.courseDescription,
                totalStudentsEnrolled,
                totalAmountGenerated,
            }
            return courseDataWithStats
        })
        res.status(200).json({courses: courseData});
    }
    catch(error) {
        console.error(error)
        res.status(500).json({message: "Internal Server Error"});
    }
}