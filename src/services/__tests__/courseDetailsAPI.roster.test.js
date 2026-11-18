import { fetchCourseEnrolledStudents } from "../operations/courseDetailsAPI";
import { apiConnector } from "../apiconnector";
import { courseEndpoints } from "../apis";

jest.mock("../apiconnector", () => ({
  apiConnector: jest.fn(),
}));

describe("courseDetailsAPI — fetchCourseEnrolledStudents (F-INS-11)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("calls instructor roster endpoint with Bearer auth and cleaned query params", async () => {
    const payload = {
      course: { _id: "c1", courseName: "MERN" },
      summary: { totalEnrolled: 1, totalLectures: 2, averageCompletionPercentage: 50, completedStudentsCount: 0 },
      students: [{ _id: "s1", firstName: "Anya", email: "anya@test.com" }],
      pagination: { page: 1, limit: 8, totalStudents: 1, totalPages: 1 },
    };
    apiConnector.mockResolvedValueOnce({ data: { success: true, data: payload } });

    const data = await fetchCourseEnrolledStudents(
      "c1",
      { search: "  Anya ", page: 1, limit: 8 },
      "inst-jwt"
    );

    expect(apiConnector).toHaveBeenCalledWith(
      "GET",
      `${courseEndpoints.GET_COURSE_ENROLLED_STUDENTS_API}/c1/enrolled-students`,
      null,
      { Authorization: "Bearer inst-jwt" },
      { search: "Anya", page: "1", limit: "8" }
    );
    expect(data).toEqual(payload);
  });

  test("propagates server error message cleanly on 403/500", async () => {
    apiConnector.mockRejectedValueOnce({
      response: {
        data: { message: "You do not have permission to view enrolled students for this course" },
      },
    });

    await expect(fetchCourseEnrolledStudents("other-course", {}, "inst-jwt")).rejects.toThrow(
      "You do not have permission to view enrolled students for this course"
    );
  });
});
