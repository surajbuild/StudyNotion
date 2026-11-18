import GetAvgRating from "../avgRating";

describe("GetAvgRating Utility", () => {
  it("should return 0 for empty array or non-array input", () => {
    expect(GetAvgRating([])).toBe(0);
    expect(GetAvgRating(null)).toBe(0);
    expect(GetAvgRating(undefined)).toBe(0);
    expect(GetAvgRating("not an array")).toBe(0);
  });

  it("should calculate average rating with one decimal point", () => {
    const ratings = [
      { rating: 4 },
      { rating: 5 },
      { rating: 3 },
    ];
    expect(GetAvgRating(ratings)).toBe(4);
  });

  it("should handle decimal averages correctly rounded to 1 decimal", () => {
    const ratings = [
      { rating: 4 },
      { rating: 5 },
    ];
    expect(GetAvgRating(ratings)).toBe(4.5);
  });

  it("should ignore invalid or non-positive ratings", () => {
    const ratings = [
      { rating: 5 },
      { rating: 0 },
      { rating: -1 },
      { rating: "invalid" },
      { rating: null },
    ];
    expect(GetAvgRating(ratings)).toBe(5);
  });

  it("should return 0 when all ratings are invalid or zero", () => {
    const ratings = [
      { rating: 0 },
      { rating: "abc" },
    ];
    expect(GetAvgRating(ratings)).toBe(0);
  });
});
