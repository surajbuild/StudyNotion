import courseReducer, {
  setStep,
  setCourse,
  setEditCourse,
  setPaymentLoading,
  resetCourseState,
} from "../courseSlice";

describe("courseSlice Redux Reducer", () => {
  const initialState = {
    step: 1,
    course: null,
    editCourse: false,
    paymentLoading: false,
  };

  it("should handle initial state", () => {
    expect(courseReducer(undefined, { type: "UNKNOWN" })).toEqual(initialState);
  });

  it("should handle setStep", () => {
    const nextState = courseReducer(initialState, setStep(2));
    expect(nextState.step).toBe(2);
  });

  it("should handle setCourse", () => {
    const courseData = { _id: "course_123", courseName: "Full Stack MERN" };
    const nextState = courseReducer(initialState, setCourse(courseData));
    expect(nextState.course).toEqual(courseData);
  });

  it("should handle setEditCourse", () => {
    const nextState = courseReducer(initialState, setEditCourse(true));
    expect(nextState.editCourse).toBe(true);
  });

  it("should handle setPaymentLoading", () => {
    const nextState = courseReducer(initialState, setPaymentLoading(true));
    expect(nextState.paymentLoading).toBe(true);
  });

  it("should reset course state", () => {
    const dirtyState = {
      step: 3,
      course: { _id: "c1" },
      editCourse: true,
      paymentLoading: true,
    };
    const nextState = courseReducer(dirtyState, resetCourseState());
    expect(nextState.step).toBe(1);
    expect(nextState.course).toBeNull();
    expect(nextState.editCourse).toBe(false);
  });
});
