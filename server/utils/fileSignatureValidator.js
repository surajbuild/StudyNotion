const fs = require("fs");
const path = require("path");

// File size limits in bytes
const SIZE_LIMITS = {
    AVATAR: 5 * 1024 * 1024,      // 5 MB
    THUMBNAIL: 10 * 1024 * 1024,  // 10 MB
    VIDEO: 500 * 1024 * 1024,     // 500 MB
};

const ALLOWED_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const ALLOWED_VIDEO_EXTS = new Set([".mp4", ".m4v", ".webm", ".mov", ".mkv"]);

/**
 * Reads the first chunk (up to 256 bytes) of a file from its tempFilePath or buffer.
 */
function readHeaderBytes(file) {
    if (file.data && Buffer.isBuffer(file.data) && file.data.length > 0) {
        return file.data.subarray(0, Math.min(file.data.length, 256));
    }
    if (file.tempFilePath && fs.existsSync(file.tempFilePath)) {
        const fd = fs.openSync(file.tempFilePath, "r");
        try {
            const buf = Buffer.alloc(256);
            const bytesRead = fs.readSync(fd, buf, 0, 256, 0);
            return buf.subarray(0, bytesRead);
        } finally {
            fs.closeSync(fd);
        }
    }
    return null;
}

/**
 * Detects binary file signature (magic bytes).
 */
function detectBinaryFormat(buffer) {
    if (!buffer || buffer.length < 4) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { mime: "image/jpeg", ext: ".jpg", type: "image" };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
    ) {
        return { mime: "image/png", ext: ".png", type: "image" };
    }

    // GIF: "GIF87a" or "GIF89a"
    if (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38
    ) {
        return { mime: "image/gif", ext: ".gif", type: "image" };
    }

    // WebP: RIFF....WEBP (first 4 bytes RIFF, bytes 8-11 WEBP)
    if (
        buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
        return { mime: "image/webp", ext: ".webp", type: "image" };
    }

    // WebM / Matroska: EBML header 1A 45 DF A3
    if (
        buffer[0] === 0x1a &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xdf &&
        buffer[3] === 0xa3
    ) {
        return { mime: "video/webm", ext: ".webm", type: "video" };
    }

    // MP4 / MOV: bytes 4-7 are "ftyp", "moov", "mdat", or "wide"
    if (buffer.length >= 8) {
        const boxType = buffer.toString("latin1", 4, 8);
        if (boxType === "ftyp" || boxType === "moov" || boxType === "mdat" || boxType === "wide") {
            const brand = buffer.length >= 12 ? buffer.toString("latin1", 8, 12).trim().toLowerCase() : "";
            const isQuickTime = brand === "qt" || brand.startsWith("qt");
            return {
                mime: isQuickTime ? "video/quicktime" : "video/mp4",
                ext: isQuickTime ? ".mov" : ".mp4",
                type: "video",
            };
        }
    }

    // SVG: Check first 256 bytes for text '<svg' or '<?xml'
    const headerStr = buffer.toString("utf8", 0, Math.min(buffer.length, 256)).trim().toLowerCase();
    if (headerStr.includes("<svg") || (headerStr.includes("<?xml") && headerStr.includes("<svg"))) {
        return { mime: "image/svg+xml", ext: ".svg", type: "disallowed_svg" };
    }

    return null;
}

/**
 * Safely unlinks a temporary file.
 */
function cleanupTempFile(file) {
    if (file?.tempFilePath && fs.existsSync(file.tempFilePath)) {
        try {
            fs.unlinkSync(file.tempFilePath);
        } catch {
            // Ignore unlinking errors
        }
    }
}

/**
 * Validates an uploaded file for expected category (image/video), magic bytes, size, and extension.
 */
function validateUploadedFile(file, { expectedCategory = "image", maxSizeBytes = SIZE_LIMITS.THUMBNAIL } = {}) {
    if (!file) {
        return { valid: false, message: "No file provided" };
    }

    // Check size limit and 0-byte files
    const fileSize = file.size ?? (file.tempFilePath && fs.existsSync(file.tempFilePath) ? fs.statSync(file.tempFilePath).size : 0);
    if (fileSize <= 0) {
        cleanupTempFile(file);
        return { valid: false, message: "File is empty (0 bytes) or corrupted" };
    }
    if (fileSize > maxSizeBytes) {
        cleanupTempFile(file);
        const limitMB = Math.round(maxSizeBytes / (1024 * 1024));
        return { valid: false, message: `File size exceeds maximum allowed limit of ${limitMB} MB` };
    }

    const declaredExt = path.extname(file.name || "").toLowerCase();
    const declaredMime = (file.mimetype || "").toLowerCase();

    // Check declared extension against allowed sets
    if (expectedCategory === "image") {
        if (declaredExt === ".svg") {
            cleanupTempFile(file);
            return {
                valid: false,
                message: "SVG image uploads are not permitted due to script execution (XSS) risks; please upload JPEG, PNG, GIF, or WebP.",
            };
        }
        if (!ALLOWED_IMAGE_EXTS.has(declaredExt)) {
            cleanupTempFile(file);
            return { valid: false, message: `Invalid image file extension: ${declaredExt}. Allowed: .jpg, .jpeg, .png, .gif, .webp` };
        }
    }
    if (expectedCategory === "video" && !ALLOWED_VIDEO_EXTS.has(declaredExt)) {
        cleanupTempFile(file);
        return { valid: false, message: `Invalid video file extension: ${declaredExt}. Allowed: .mp4, .webm, .mov, .m4v, .mkv` };
    }

    // Read header bytes
    const header = readHeaderBytes(file);
    if (!header || header.length === 0) {
        cleanupTempFile(file);
        return { valid: false, message: "Unable to read file content header" };
    }

    const detected = detectBinaryFormat(header);
    if (!detected) {
        cleanupTempFile(file);
        return { valid: false, message: "File header does not match any allowed binary format (corrupted or unrecognized signature)" };
    }

    // Explicitly reject SVG even if renamed to another extension (e.g. evil.png with SVG XML payload)
    if (detected.type === "disallowed_svg" || detected.mime === "image/svg+xml") {
        cleanupTempFile(file);
        return {
            valid: false,
            message: "SVG image uploads are not permitted due to script execution (XSS) risks; please upload JPEG, PNG, GIF, or WebP.",
        };
    }

    // Verify binary format matches expected category
    if (detected.type !== expectedCategory) {
        cleanupTempFile(file);
        return {
            valid: false,
            message: `Mismatched file category: detected ${detected.type} binary signature, expected ${expectedCategory}`,
        };
    }

    // Verify binary signature matches declared extension (anti-spoofing)
    if (expectedCategory === "image") {
        const isJpgMatch = (declaredExt === ".jpg" || declaredExt === ".jpeg") && detected.ext === ".jpg";
        const isExactMatch = declaredExt === detected.ext;
        if (!isJpgMatch && !isExactMatch) {
            cleanupTempFile(file);
            return {
                valid: false,
                message: `Spoofed file detected: file extension ${declaredExt} does not match detected binary signature ${detected.ext}`,
            };
        }
    } else if (expectedCategory === "video") {
        const isMp4Family = (declaredExt === ".mp4" || declaredExt === ".m4v" || declaredExt === ".mov") && (detected.ext === ".mp4" || detected.ext === ".mov");
        const isWebmFamily = (declaredExt === ".webm" || declaredExt === ".mkv") && detected.ext === ".webm";
        if (!isMp4Family && !isWebmFamily) {
            cleanupTempFile(file);
            return {
                valid: false,
                message: `Spoofed video detected: file extension ${declaredExt} does not match detected binary signature ${detected.ext}`,
            };
        }
    }

    return { valid: true, detected, size: fileSize };
}

module.exports = {
    SIZE_LIMITS,
    ALLOWED_IMAGE_EXTS,
    ALLOWED_VIDEO_EXTS,
    detectBinaryFormat,
    cleanupTempFile,
    validateUploadedFile,
};
