import { formattedDate } from "../dateFormatter";

describe("formattedDate Utility", () => {
  it("should return empty string for falsy input", () => {
    expect(formattedDate(null)).toBe("");
    expect(formattedDate(undefined)).toBe("");
    expect(formattedDate("")).toBe("");
  });

  it("should format valid ISO date string correctly", () => {
    const formatted = formattedDate("2026-05-15T00:00:00.000Z");
    expect(formatted).toMatch(/May 15, 2026/);
  });
});
