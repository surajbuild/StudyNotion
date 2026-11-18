const crypto = require("crypto");

/**
 * Generates a cryptographically secure random reset token.
 * Provides 256 bits of entropy formatted as a 64-character hexadecimal string.
 *
 * @returns {string} Raw cryptographic reset token
 */
function generateSecureResetToken() {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * Computes the SHA-256 hash of a raw reset token for safe database persistence.
 * Prevents reset token disclosure if the database is accessed or dumped.
 *
 * @param {string} rawToken
 * @returns {string|null} SHA-256 hex digest or null if input is invalid
 */
function hashToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string") {
        return null;
    }
    const trimmed = rawToken.trim();
    if (!trimmed) {
        return null;
    }
    return crypto.createHash("sha256").update(trimmed).digest("hex");
}

module.exports = {
    generateSecureResetToken,
    hashToken,
};
