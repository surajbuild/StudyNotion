import viewCourseReducer, {
  setCourseSectionData,
  setEntireCourseData,
  setTotalNoOfLectures,
  setCompletedLectures,
  updateCompletedLectures,
} from "../viewCourseSlice";

describe("viewCourseSlice Redux Reducer", () => {
  const initialState = {
    courseSectionData: [],
    courseEntireData: [],
    completedLectures: [],
    totalNoOfLectures: 0,
  };

  it("should handle initial state", () => {
    expect(viewCourseReducer(undefined, { type: "INIT" })).toEqual(initialState);
  });

  it("should handle setCourseSectionData", () => {
    const sections = [{ _id: "s1", sectionName: "Intro" }];
    const state = viewCourseReducer(initialState, setCourseSectionData(sections));
    expect(state.courseSectionData).toEqual(sections);
  });

  it("should handle setEntireCourseData", () => {
    const course = { _id: "c1", courseName: "Course" };
    const state = viewCourseReducer(initialState, setEntireCourseData(course));
    expect(state.courseEntireData).toEqual(course);
  });

  it("should handle setTotalNoOfLectures", () => {
    const state = viewCourseReducer(initialState, setTotalNoOfLectures(15));
    expect(state.totalNoOfLectures).toBe(15);
  });

  it("should handle setCompletedLectures", () => {
    const lectures = ["sub1", "sub2"];
    const state = viewCourseReducer(initialState, setCompletedLectures(lectures));
    expect(state.completedLectures).toEqual(lectures);
  });

  it("should handle updateCompletedLectures by appending new completed lecture", () => {
    const startState = {
      ...initialState,
      completedLectures: ["sub1"],
    };
    const state = viewCourseReducer(startState, updateCompletedLectures("sub2"));
    expect(state.completedLectures).toEqual(["sub1", "sub2"]);
  });
});
