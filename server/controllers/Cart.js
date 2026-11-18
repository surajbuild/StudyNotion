const mongoose = require("mongoose");
const User = require("../models/User");
const Course = require("../models/Course");

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

const isValidObjectId = (id) =>
    typeof id === "string" && OBJECT_ID_REGEX.test(id) && mongoose.Types.ObjectId.isValid(id);

/**
 * Loads the authenticated student's persistent MongoDB cart, prunes any
 * deleted/unpublished/already-enrolled/duplicate entries, persists the cleaned
 * cart back if pruned, and computes authoritative totals from database prices.
 */
const buildAuthoritativeCart = async (userId) => {
    const userDoc = await User.findById(userId)
        .select("cart courses")
        .populate({
            path: "cart",
            select: "courseName courseDescription price thumbnail category instructor ratingAndReviews studentEnrolled status",
            populate: [
                { path: "category", select: "name" },
                { path: "instructor", select: "firstName lastName image" },
                { path: "ratingAndReviews", select: "rating" },
            ],
        })
        .exec();

    if (!userDoc) {
        return null;
    }

    const enrolledSet = new Set(
        (Array.isArray(userDoc.courses) ? userDoc.courses : []).map((id) => id.toString())
    );

    const rawCart = Array.isArray(userDoc.cart) ? userDoc.cart : [];
    const seen = new Set();
    const validCourses = [];

    for (const course of rawCart) {
        if (!course || !course._id) continue;
        const idStr = course._id.toString();
        if (seen.has(idStr)) continue;

        const isPublished = !course.status || course.status === "Published";
        const hasValidPrice =
            typeof course.price === "number" && Number.isFinite(course.price) && course.price >= 0;
        const isAlreadyEnrolled =
            enrolledSet.has(idStr) ||
            (Array.isArray(course.studentEnrolled) &&
                course.studentEnrolled.some((sid) => sid.toString() === userId.toString()));

        if (!isPublished || !hasValidPrice || isAlreadyEnrolled) {
            continue;
        }

        seen.add(idStr);
        validCourses.push(course);
    }

    const removedUnavailableCount = Math.max(0, rawCart.length - validCourses.length);
    if (removedUnavailableCount > 0) {
        await User.findByIdAndUpdate(userId, {
            $set: { cart: validCourses.map((c) => c._id) },
        });
    }

    const total = validCourses.reduce((sum, c) => sum + Number(c.price || 0), 0);

    return {
        cart: validCourses,
        total,
        totalItems: validCourses.length,
        removedUnavailableCount,
    };
};

// ============================================================
// GET /api/v1/cart — Fetch student's authoritative DB cart
// ============================================================
exports.getCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const cartPayload = await buildAuthoritativeCart(userId);
        if (!cartPayload) {
            return res.status(404).json({
                success: false,
                message: "Student account not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cart fetched successfully",
            data: cartPayload,
        });
    } catch (error) {
        console.error("getCart error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch cart",
        });
    }
};

// ============================================================
// POST /api/v1/cart/add — Add a published, unenrolled course to DB cart
// ============================================================
exports.addToCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { courseId } = req.body || {};

        if (!isValidObjectId(courseId)) {
            return res.status(400).json({
                success: false,
                message: "Valid courseId is required",
            });
        }

        const [user, course] = await Promise.all([
            User.findById(userId).select("cart courses"),
            Course.findById(courseId).select("courseName price status studentEnrolled"),
        ]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Student account not found",
            });
        }

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            });
        }

        if (course.status && course.status !== "Published") {
            return res.status(400).json({
                success: false,
                message: "This course is not currently available for purchase",
            });
        }

        if (
            typeof course.price !== "number" ||
            !Number.isFinite(course.price) ||
            course.price < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Course has invalid pricing",
            });
        }

        const alreadyEnrolled =
            user.courses?.some((id) => id.toString() === courseId) ||
            course.studentEnrolled?.some((id) => id.toString() === userId);
        if (alreadyEnrolled) {
            return res.status(409).json({
                success: false,
                message: "You are already enrolled in this course",
            });
        }

        const alreadyInCart = user.cart?.some((id) => id.toString() === courseId);
        if (alreadyInCart) {
            return res.status(409).json({
                success: false,
                message: "Course is already in the cart",
            });
        }

        await User.findByIdAndUpdate(userId, {
            $addToSet: { cart: course._id },
        });

        const cartPayload = await buildAuthoritativeCart(userId);
        return res.status(200).json({
            success: true,
            message: "Course added to cart",
            data: cartPayload,
        });
    } catch (error) {
        console.error("addToCart error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to add course to cart",
        });
    }
};

// ============================================================
// DELETE /api/v1/cart/remove/:courseId (or body.courseId)
// ============================================================
exports.removeFromCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = req.params?.courseId || req.body?.courseId;

        if (!isValidObjectId(courseId)) {
            return res.status(400).json({
                success: false,
                message: "Valid courseId is required",
            });
        }

        await User.findByIdAndUpdate(userId, {
            $pull: { cart: courseId },
        });

        const cartPayload = await buildAuthoritativeCart(userId);
        if (!cartPayload) {
            return res.status(404).json({
                success: false,
                message: "Student account not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Course removed from cart",
            data: cartPayload,
        });
    } catch (error) {
        console.error("removeFromCart error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to remove course from cart",
        });
    }
};

// ============================================================
// POST /api/v1/cart/sync — Merge anonymous/local cart items into DB cart on login
// ============================================================
exports.syncCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const rawCourseIds = Array.isArray(req.body?.courseIds) ? req.body.courseIds : [];

        const candidateIds = [
            ...new Set(
                rawCourseIds
                    .filter((id) => typeof id === "string" && isValidObjectId(id.trim()))
                    .map((id) => id.trim())
            ),
        ].slice(0, 50);

        const user = await User.findById(userId).select("cart courses");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Student account not found",
            });
        }

        let mergedCount = 0;
        let skippedCount = rawCourseIds.length - candidateIds.length;

        if (candidateIds.length > 0) {
            const existingCartSet = new Set((user.cart || []).map((id) => id.toString()));
            const enrolledSet = new Set((user.courses || []).map((id) => id.toString()));

            const validCourses = await Course.find({
                _id: { $in: candidateIds },
                status: "Published",
                price: { $gte: 0 },
            }).select("_id studentEnrolled");

            const toAdd = [];
            for (const course of validCourses) {
                const idStr = course._id.toString();
                const isEnrolled =
                    enrolledSet.has(idStr) ||
                    course.studentEnrolled?.some((sid) => sid.toString() === userId);
                if (!isEnrolled && !existingCartSet.has(idStr)) {
                    toAdd.push(course._id);
                }
            }

            mergedCount = toAdd.length;
            skippedCount += candidateIds.length - toAdd.length;

            if (toAdd.length > 0) {
                await User.findByIdAndUpdate(userId, {
                    $addToSet: { cart: { $each: toAdd } },
                });
            }
        }

        const cartPayload = await buildAuthoritativeCart(userId);
        return res.status(200).json({
            success: true,
            message: "Cart synchronized successfully",
            data: {
                ...cartPayload,
                mergedCount,
                skippedCount,
            },
        });
    } catch (error) {
        console.error("syncCart error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to synchronize cart",
        });
    }
};
