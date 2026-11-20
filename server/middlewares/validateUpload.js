const {
    validateUploadedFile,
    SIZE_LIMITS,
} = require("../utils/fileSignatureValidator");

exports.validateAvatar = (req, res, next) => {
    const file = req.files?.displayPicture;
    if (!file) {
        return res.status(400).json({
            success: false,
            message: "Profile image is required",
        });
    }

    const result = validateUploadedFile(file, {
        expectedCategory: "image",
        maxSizeBytes: SIZE_LIMITS.AVATAR,
    });

    if (!result.valid) {
        return res.status(400).json({
            success: false,
            message: result.message,
        });
    }

    next();
};

exports.validateThumbnail = (req, res, next) => {
    // If thumbnail is provided in req.files, validate it
    const file = req.files?.thumbnailImage;
    if (file) {
        const result = validateUploadedFile(file, {
            expectedCategory: "image",
            maxSizeBytes: SIZE_LIMITS.THUMBNAIL,
        });

        if (!result.valid) {
            return res.status(400).json({
                success: false,
                message: result.message,
            });
        }
    }
    next();
};

exports.validateVideo = (req, res, next) => {
    const file = req.files?.videoFile || req.files?.video;
    if (file) {
        const result = validateUploadedFile(file, {
            expectedCategory: "video",
            maxSizeBytes: SIZE_LIMITS.VIDEO,
        });

        if (!result.valid) {
            return res.status(400).json({
                success: false,
                message: result.message,
            });
        }
    }
    next();
};
