const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const Course = require("../models/Course");
const { imageUploadToCloudinary } = require("../utils/imageUploader");

// Helper: returns the parent course fully populated after a subsection mutation.
// Having this in one place avoids duplicating the populate chain in every handler.
const getPopulatedCourse = async (sectionId) => {
    const section = await Section.findById(sectionId);
    if (!section || !section.course) return null;
    return Course.findById(section.course)
        .populate({
            path: "courseContent",
            populate: { path: "subSection" },
        })
        .exec();
};

// ============================================================
// CREATE SUBSECTION
// ============================================================
exports.createSubSection = async (req, res) => {
    try {
        const { sectionId, title, timeDuration, description } = req.body;
        // ✅ REMOVED: All debug console.log statements that printed req.body,
        // req.files, validation results, Cloudinary URL, and creation results.

        const video = req.files?.videoFile;

        if (!sectionId || !title || !description || !video) {
            return res.status(400).json({
                success: false,
                message: "sectionId, title, description, and video are required",
            });
        }

        // Upload the video to Cloudinary
        const uploadDetails = await imageUploadToCloudinary(video, process.env.FOLDER_NAME);
        const videoUrl = uploadDetails.secure_url;

        const subSectionDetails = await SubSection.create({
            title,
            timeDuration,
            description,
            videoUrl,
        });

        // Add the new subsection reference to its parent section
        const updatedSection = await Section.findByIdAndUpdate(
            sectionId,
            { $push: { subSection: subSectionDetails._id } },
            { new: true }
        ).populate("subSection");

        return res.status(200).json({
            success: true,
            message: "Sub-section created successfully",
            data: updatedSection,
        });
    } catch (error) {
        console.error("createSubSection error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ============================================================
// UPDATE SUBSECTION
// ============================================================
exports.updateSubSection = async (req, res) => {
    try {
        const { title, timeDuration, description, subSectionId, sectionId } = req.body;
        const video = req.files?.videoFile;

        if (!subSectionId) {
            return res.status(400).json({
                success: false,
                message: "subSectionId is required",
            });
        }

        // Build update payload from only the fields that were provided
        const updatePayload = {};
        if (title) updatePayload.title = title;
        if (timeDuration) updatePayload.timeDuration = timeDuration;
        if (description) updatePayload.description = description;

        if (video) {
            const uploadDetails = await imageUploadToCloudinary(video, process.env.FOLDER_NAME);
            updatePayload.videoUrl = uploadDetails.secure_url;
        }

        await SubSection.findByIdAndUpdate(subSectionId, updatePayload, { new: true });

        // Return the full updated course so the frontend Redux store stays in sync
        const updatedCourse = await getPopulatedCourse(sectionId);

        if (updatedCourse) {
            return res.status(200).json({
                success: true,
                message: "Sub-section updated successfully",
                data: updatedCourse,
            });
        }

        // Fallback: if we can't find the parent course, return the updated section
        const updatedSection = await Section.findById(sectionId).populate("subSection");
        return res.status(200).json({
            success: true,
            message: "Sub-section updated successfully",
            data: updatedSection,
        });
    } catch (error) {
        console.error("updateSubSection error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update sub-section. Please try again.",
            error: error.message,
        });
    }
};

// ============================================================
// DELETE SUBSECTION
// ============================================================
exports.deleteSubSection = async (req, res) => {
    try {
        const { subSectionId, sectionId } = req.body;

        if (!subSectionId) {
            return res.status(400).json({
                success: false,
                message: "subSectionId is required",
            });
        }

        // Delete the subsection document
        await SubSection.findByIdAndDelete(subSectionId);

        // Remove the reference from the parent section's subSection array
        await Section.updateMany(
            { subSection: subSectionId },
            { $pull: { subSection: subSectionId } }
        );

        if (sectionId) {
            const updatedCourse = await getPopulatedCourse(sectionId);
            if (updatedCourse) {
                return res.status(200).json({
                    success: true,
                    message: "Sub-section deleted successfully",
                    data: updatedCourse,
                });
            }

            // Fallback: return just the updated section if course lookup fails
            const updatedSection = await Section.findById(sectionId).populate("subSection");
            return res.status(200).json({
                success: true,
                message: "Sub-section deleted successfully",
                data: updatedSection,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Sub-section deleted successfully",
        });
    } catch (error) {
        console.error("deleteSubSection error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to delete sub-section. Please try again.",
            error: error.message,
        });
    }
};
