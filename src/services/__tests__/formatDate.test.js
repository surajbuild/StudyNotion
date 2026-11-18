import { formatDate } from "../formatDate";

describe("formatDate Service Utility", () => {
  it("should return N/A for empty or falsy date", () => {
    expect(formatDate(null)).toBe("N/A");
    expect(formatDate("")).toBe("N/A");
    expect(formatDate(undefined)).toBe("N/A");
  });

  it("should return Invalid Date for malformed date string", () => {
    expect(formatDate("not-a-date")).toBe("Invalid Date");
  });

  it("should format valid date with date and time", () => {
    const result = formatDate("2026-11-18T10:30:00.000Z");
    expect(result).toContain("|");
    expect(result).toMatch(/2026/);
  });
});
