const Section = require('../models/Section');
const SubSection = require('../models/SubSection');
const Course = require('../models/Course');

// Helper: returns a fully-populated course document for a given courseId.
// Used after every mutation so the frontend always gets up-to-date course state.
const getPopulatedCourse = (courseId) =>
    Course.findById(courseId)
        .populate({
            path: "courseContent",
            populate: { path: "subSection" },
        })
        .exec();

// ============================================================
// CREATE SECTION
// ============================================================
exports.createSection = async (req, res) => {
    try {
        const { sectionName, courseId } = req.body;

        if (!sectionName || !courseId) {
            return res.status(400).json({
                success: false,
                message: "sectionName and courseId are required",
            });
        }

        const newSection = await Section.create({ sectionName });

        // Push the new section's ID into the course's courseContent array
        await Course.findByIdAndUpdate(
            courseId,
            { $push: { courseContent: newSection._id } },
            { new: true }
        );

        // Return the fully-populated course so the frontend Redux state is complete
        const updatedCourseDetails = await getPopulatedCourse(courseId);

        return res.status(200).json({
            success: true,
            message: "Section created successfully",
            updatedCourseDetails,
            data: updatedCourseDetails,
        });
    } catch (error) {
        console.error("createSection error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to create section. Please try again.",
            error: error.message,
        });
    }
};

// ============================================================
// UPDATE SECTION
// ============================================================
exports.updateSection = async (req, res) => {
    try {
        const { sectionName, sectionId, courseId } = req.body;

        if (!sectionName || !sectionId) {
            return res.status(400).json({
                success: false,
                message: "sectionName and sectionId are required",
            });
        }

        // Update the section's name
        await Section.findByIdAndUpdate(sectionId, { sectionName }, { new: true });

        // ✅ FIX: Was fetching the course TWICE — once to a `course` variable,
        // then again to an `updatedCourse` variable — but returning `course`
        // (the first/stale fetch).  This meant the response always contained
        // pre-update data.  Now we do a single fetch after the update and
        // return that.
        const updatedCourse = await getPopulatedCourse(courseId);

        return res.status(200).json({
            success: true,
            message: "Section updated successfully",
            // ✅ Return as `data` to match what the frontend (courseDetailsAPI.js)
            // reads from `response?.data?.data` in updateSection.
            data: updatedCourse,
        });
    } catch (error) {
        console.error("updateSection error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update section. Please try again.",
            error: error.message,
        });
    }
};

// ============================================================
// DELETE SECTION
// ============================================================
exports.deleteSection = async (req, res) => {
    try {
        // ✅ REMOVED: All debug console.log statements that printed request body,
        // auth header, section details, and deletion results on every call.
        const { sectionId, courseId } = req.body;

        if (!sectionId) {
            return res.status(400).json({
                success: false,
                message: "sectionId is required",
            });
        }

        // Fetch the section with its subsections so we can cascade-delete
        const section = await Section.findById(sectionId).populate("subSection");

        if (!section) {
            return res.status(404).json({
                success: false,
                message: "Section not found",
            });
        }

        // Cascade-delete all subsections belonging to this section
        const subSectionIds = section.subSection?.map((s) => s._id) || [];
        if (subSectionIds.length) {
            await SubSection.deleteMany({ _id: { $in: subSectionIds } });
        }

        await Section.findByIdAndDelete(sectionId);

        // Determine which course to update (explicit courseId preferred)
        const parentCourseId = courseId || section.course;

        let updatedCourseDetails = null;
        if (parentCourseId) {
            // Pull the deleted section's ID out of the course's courseContent array
            await Course.findByIdAndUpdate(
                parentCourseId,
                { $pull: { courseContent: sectionId } },
                { new: true }
            );
            updatedCourseDetails = await getPopulatedCourse(parentCourseId);
        }

        return res.status(200).json({
            success: true,
            message: "Section deleted successfully",
            data: updatedCourseDetails,
        });
    } catch (error) {
        console.error("deleteSection error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to delete section. Please try again.",
            error: error.message,
        });
    }
};
