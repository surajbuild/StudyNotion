const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_MIN_LENGTH_MESSAGE = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;

/**
 * Validates a newly created or updated password against the StudyNotion
 * minimum password policy.
 *
 * NOTE: This validator must ONLY be applied when creating or changing a
 * password (signup, change password, reset password). It must NOT be applied
 * to login so existing users with legacy passwords are never locked out.
 *
 * @param {unknown} password
 * @returns {{ valid: boolean, message: string | null }}
 */
const validateNewPassword = (password) => {
    if (typeof password !== "string") {
        return {
            valid: false,
            message: "Password must be a valid string",
        };
    }

    if (password.trim().length === 0) {
        return {
            valid: false,
            message: "Password cannot be empty",
        };
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        return {
            valid: false,
            message: PASSWORD_MIN_LENGTH_MESSAGE,
        };
    }

    return { valid: true, message: null };
};

module.exports = {
    MIN_PASSWORD_LENGTH,
    PASSWORD_MIN_LENGTH_MESSAGE,
    validateNewPassword,
};
