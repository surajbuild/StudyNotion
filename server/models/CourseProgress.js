const mongoose = require("mongoose");

const courseProgress = new mongoose.Schema(
    {
        courseID: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        completedVideos: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "SubSection",
            },
        ],
        // Authoritative enrollment timestamp recorded on new enrollments (null for legacy rows)
        enrolledAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

courseProgress.index({ courseID: 1, userId: 1 });

module.exports = mongoose.model("CourseProgress", courseProgress);
