import { flattenCourseLectures, getLectureNavigation } from "../videoNavigation";

describe("videoNavigation (Regression BUG-024)", () => {
  it("should flatten lectures while skipping empty leading, middle, and trailing sections", () => {
    const sections = [
      { _id: "sec0", subSection: [] },
      { _id: "sec1", subSection: [{ _id: "sub1" }, { _id: "sub2" }] },
      { _id: "sec2", subSection: [] },
      { _id: "sec3", subSection: [{ _id: "sub3" }] },
      { _id: "sec4", subSection: [] },
    ];

    const flat = flattenCourseLectures(sections);
    expect(flat.map((l) => `${l.sectionId}/${l.subSectionId}`)).toEqual([
      "sec1/sub1",
      "sec1/sub2",
      "sec3/sub3",
    ]);
  });

  it("should treat first playable lecture after empty leading section as first (no Prev crash)", () => {
    const sections = [
      { _id: "sec0", subSection: [] },
      { _id: "sec1", subSection: [{ _id: "sub1" }] },
    ];

    const nav = getLectureNavigation(sections, "sec1", "sub1");
    expect(nav.isFirst).toBe(true);
    expect(nav.isLast).toBe(true);
    expect(nav.prev).toBeNull();
    expect(nav.next).toBeNull();
  });

  it("should skip empty middle sections cleanly when navigating Next and Prev", () => {
    const sections = [
      { _id: "sec1", subSection: [{ _id: "sub1" }] },
      { _id: "sec2", subSection: [] },
      { _id: "sec3", subSection: [] },
      { _id: "sec4", subSection: [{ _id: "sub4" }] },
    ];

    const fromFirst = getLectureNavigation(sections, "sec1", "sub1");
    expect(fromFirst.isFirst).toBe(true);
    expect(fromFirst.isLast).toBe(false);
    expect(fromFirst.next).toEqual(
      expect.objectContaining({ sectionId: "sec4", subSectionId: "sub4" })
    );

    const fromLast = getLectureNavigation(sections, "sec4", "sub4");
    expect(fromLast.isFirst).toBe(false);
    expect(fromLast.isLast).toBe(true);
    expect(fromLast.prev).toEqual(
      expect.objectContaining({ sectionId: "sec1", subSectionId: "sub1" })
    );
  });

  it("should treat last playable lecture before empty trailing section as last (no Next crash)", () => {
    const sections = [
      { _id: "sec1", subSection: [{ _id: "sub1" }] },
      { _id: "sec2", subSection: [] },
    ];

    const nav = getLectureNavigation(sections, "sec1", "sub1");
    expect(nav.isLast).toBe(true);
    expect(nav.next).toBeNull();
  });

  it("should gracefully handle invalid or missing section/subSection IDs", () => {
    const sections = [{ _id: "sec1", subSection: [{ _id: "sub1" }] }];
    const nav = getLectureNavigation(sections, "bad-sec", "bad-sub");
    expect(nav.isFirst).toBe(true);
    expect(nav.isLast).toBe(true);
    expect(nav.prev).toBeNull();
    expect(nav.next).toBeNull();
  });
});
