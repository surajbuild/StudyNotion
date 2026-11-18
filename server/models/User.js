const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true,
    },
    lastName:{
        type: String,
        required: true,
        trim: true,
    },
    email:{
        type: String,
        required: true,
        trim: true,
        unique: true,
        index: true,
    },
    password: {
        type: String,
        required: true,
    },
    accountType: {
        type: String,
        enum: ["Admin", "Student", "Instructor"],
        required: true,
    },
    additionalDetails: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Profile",
    },
    contactNumber: {
        type: String,
        trim: true,
    },
    courses: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
        }
    ],
    cart: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
        }
    ],
    image: {
        type: String,
        required: true,
    },
    token: {
        type: String,
    },
    resetPasswordExpires: {
        type: Date,
    },
    courseProgress: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CourseProgress",
        }
    ],
    coursesProgress: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CourseProgress",
        }
    ],
    // Authoritative instructor approval workflow state (GAP-002)
    // Students & Admins remain approved=true with approvalStatus omitted (undefined).
    // New Instructors start with approvalStatus="PENDING" & approved=false.
    approved: {
        type: Boolean,
        default: true,
    },
    approvalStatus: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED"],
        default: undefined,
    },
    approvalReviewedAt: {
        type: Date,
        default: null,
    },
    approvalReviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    rejectionReason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
    },
    //Add timestamps for when the documnet is created and last modified
},
    {timestamps: true}
);

// Supports fast admin user filtering & instructor approval queues
userSchema.index({ accountType: 1, approvalStatus: 1, createdAt: -1 });

module.exports = mongoose.model("User", userSchema);