import { calculateCourseDuration, getTotalLectures } from "../courseDuration";

describe("courseDuration Utility", () => {
  describe("calculateCourseDuration", () => {
    it("should return 0min for null, empty or missing courseContent", () => {
      expect(calculateCourseDuration(null)).toBe("0min");
      expect(calculateCourseDuration({})).toBe("0min");
      expect(calculateCourseDuration({ courseContent: [] })).toBe("0min");
    });

    it("should calculate duration correctly for seconds under an hour", () => {
      const course = {
        courseContent: [
          {
            subSection: [
              { timeDuration: "120" }, // 2 minutes
              { timeDuration: "180" }, // 3 minutes
            ],
          },
        ],
      };
      expect(calculateCourseDuration(course)).toBe("5min");
    });

    it("should calculate duration correctly for hours and minutes", () => {
      const course = {
        courseContent: [
          {
            subSection: [
              { timeDuration: 3600 }, // 1 hour
              { timeDuration: "1800" }, // 30 minutes
            ],
          },
        ],
      };
      expect(calculateCourseDuration(course)).toBe("1hr 30min");
    });

    it("should calculate exact hours with 0 minutes", () => {
      const course = {
        courseContent: [
          {
            subSection: [{ timeDuration: 7200 }], // 2 hours
          },
        ],
      };
      expect(calculateCourseDuration(course)).toBe("2hr");
    });

    it("should ignore invalid timeDurations", () => {
      const course = {
        courseContent: [
          {
            subSection: [
              { timeDuration: "invalid" },
              { timeDuration: null },
              { timeDuration: 60 },
            ],
          },
        ],
      };
      expect(calculateCourseDuration(course)).toBe("1min");
    });
  });

  describe("getTotalLectures", () => {
    it("should return 0 for empty or invalid course", () => {
      expect(getTotalLectures(null)).toBe(0);
      expect(getTotalLectures({})).toBe(0);
      expect(getTotalLectures({ courseContent: [] })).toBe(0);
    });

    it("should sum total lectures across all sections", () => {
      const course = {
        courseContent: [
          { subSection: [{ id: 1 }, { id: 2 }] },
          { subSection: [{ id: 3 }] },
          { subSection: [] },
        ],
      };
      expect(getTotalLectures(course)).toBe(3);
    });
  });
});
