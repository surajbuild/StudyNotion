const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
    courseName: {
        type: String,
    },
    courseDescription: {
        type: String,
    },
    instructor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    whatYouWillLearn: {
        type: String,
    },
    courseContent: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Section",
        },
    ],

    ratingAndReviews: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RatingAndReview",
        },
    ],
    price: {
        type: Number,
        min: [0, "Course price cannot be negative"],
    },
    thumbnail: {
        type: String,
    },
    tag: {
        type: [String],
        required: true,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        // required: true,
        ref: "Category",
    },
    studentEnrolled: [
        {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "User",
        },
    ],
    instructions: {
        type: [String],
    },
    status: {
        type: String,
        enum: ["Draft", "Published"],
        index: true,
    },
    createdAt: {
        type:Date,
        default:Date.now
    },
});

courseSchema.index({ instructor: 1, status: 1 });
courseSchema.index({ status: 1, createdAt: -1 });
courseSchema.index({ status: 1, category: 1, price: 1 });
courseSchema.index({ status: 1, price: 1 });
courseSchema.index(
    { courseName: "text", courseDescription: "text", tag: "text" },
    {
        name: "course_search_text_idx",
        weights: { courseName: 10, tag: 5, courseDescription: 2 },
    }
);

module.exports = mongoose.model("Course", courseSchema);