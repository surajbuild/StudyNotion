const SubSection = require("../models/SubSection");
const CourseProgress = require("../models/CourseProgress");

exports.updateCourseProgress = async (req, res) => {
    const { courseId, subsectionId } = req.body;
    const userId = req.user.id;

    if (!courseId || !subsectionId) {
        return res.status(400).json({
            success: false,
            message: "courseId and subsectionId are required",
        });
    }

    try {
        // Check if the subsection is valid
        const subSection = await SubSection.findById(subsectionId);
        if (!subSection) {
            return res.status(404).json({
                success: false,
                error: "Invalid SubSection",
            });
        }

        // Find existing course progress for this user + course
        let courseProgress = await CourseProgress.findOne({
            courseID: courseId,
            userId: userId,
        });

        if (!courseProgress) {
            // BUG FIX: First video ever watched — create a new progress document
            // instead of returning a 404 error.
            courseProgress = await CourseProgress.create({
                courseID: courseId,
                userId: userId,
                completedVideos: [subsectionId],
            });
            return res.status(200).json({
                success: true,
                message: "Course Progress Created Successfully",
            });
        }

        // BUG FIX: "Already completed" is not an error — return 200 so the
        // frontend doesn't show a failure toast for a harmless re-watch.
        if (courseProgress.completedVideos.includes(subsectionId)) {
            return res.status(200).json({
                success: true,
                message: "Subsection already completed",
            });
        }

        // Mark subsection as complete
        courseProgress.completedVideos.push(subsectionId);
        await courseProgress.save();

        return res.status(200).json({
            success: true,
            message: "Course Progress Updated Successfully",
        });

    } catch (error) {
        console.error("updateCourseProgress error:", error);
        return res.status(500).json({
            success: false,
            error: "Internal Server Error",
        });
    }
};
