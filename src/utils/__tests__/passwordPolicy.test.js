import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
  validateNewPassword,
} from "../passwordPolicy";

describe("passwordPolicy utility (GAP-007)", () => {
  test("defines minimum length of 8 characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(PASSWORD_MIN_LENGTH_MESSAGE).toBe(
      "Password must be at least 8 characters long"
    );
  });

  test("rejects empty, whitespace-only, non-string, and <8-character passwords", () => {
    expect(validateNewPassword("")).toEqual({
      valid: false,
      message: "Password cannot be empty",
    });
    expect(validateNewPassword("        ")).toEqual({
      valid: false,
      message: "Password cannot be empty",
    });
    expect(validateNewPassword(null)).toEqual({
      valid: false,
      message: "Password cannot be empty",
    });
    expect(validateNewPassword("1234567")).toEqual({
      valid: false,
      message: PASSWORD_MIN_LENGTH_MESSAGE,
    });
  });

  test("accepts exact 8-character and >8-character passwords", () => {
    expect(validateNewPassword("12345678")).toEqual({
      valid: true,
      message: null,
    });
    expect(validateNewPassword("StrongPass@2026")).toEqual({
      valid: true,
      message: null,
    });
  });
});
