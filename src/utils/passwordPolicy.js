export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_MIN_LENGTH_MESSAGE = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;

/**
 * Validates a newly created or updated password against StudyNotion's
 * consistent minimum password policy.
 *
 * NOTE: Must ONLY be used for password creation / update forms
 * (signup, reset password, change password) — never for login.
 *
 * @param {string} password
 * @returns {{ valid: boolean, message: string | null }}
 */
export const validateNewPassword = (password) => {
  if (typeof password !== "string" || password.trim().length === 0) {
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
