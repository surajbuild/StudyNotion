const cloudinary = require("cloudinary").v2;
const path = require("path");
const { isExternalMockMode } = require("../config/testSafety");

exports.imageUploadToCloudinary = async (file, folder, height, quality) => {
    if (isExternalMockMode()) {
        const port = process.env.PORT || 4001;
        const mimetype = (file?.mimetype || "").toLowerCase();
        const ext = path.extname(file?.name || "").toLowerCase();
        const isVideo = mimetype.startsWith("video/") || [".mp4", ".webm", ".mov"].includes(ext);
        const assetPath = isVideo ? "/api/v1/__test__/assets/sample-video.mp4" : "/api/v1/__test__/assets/sample-thumb.svg";
        const uniqueId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        return {
            secure_url: `http://localhost:${port}${assetPath}?id=${uniqueId}`,
            public_id: `${folder || "studynotion_test"}/${uniqueId}`,
            resource_type: isVideo ? "video" : "image",
            duration: isVideo ? 120 : undefined,
            mocked: true,
        };
    }

    const options = { folder };
    if (height) {
        options.height = height;
    }
    if (quality) {
        options.quality = quality;
    }
    options.resource_type = "auto";

    return await cloudinary.uploader.upload(file.tempFilePath, options);
};
