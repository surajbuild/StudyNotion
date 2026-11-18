import toast from "react-hot-toast";
import { apiConnector } from "../apiconnector";
import { studentEndpoints } from "../apis";
import { enrollFreeCourse } from "../operations/studentFeatureAPI";

jest.mock("../apiconnector", () => ({
  apiConnector: jest.fn(),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    loading: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    dismiss: jest.fn(),
  },
}));

describe("studentFeatureAPI.enrollFreeCourse (GAP-005)", () => {
  beforeEach(() => {
    localStorage.clear();
    toast.loading.mockReturnValue("toast_1");
  });

  test("posts to ENROLL_FREE_COURSE_API without client price, updates Redux/localStorage, and navigates", async () => {
    apiConnector.mockResolvedValue({
      data: { success: true, message: "Successfully enrolled in free course" },
    });

    const dispatch = jest.fn();
    const navigate = jest.fn();
    const user = { _id: "stu_1", firstName: "QA", courses: ["existing_c"] };

    const ok = await enrollFreeCourse("jwt_token", ["free_c1"], user, navigate, dispatch);

    expect(ok).toBe(true);
    expect(apiConnector).toHaveBeenCalledWith(
      "POST",
      studentEndpoints.ENROLL_FREE_COURSE_API,
      { courses: ["free_c1"] },
      { Authorization: "Bearer jwt_token" }
    );
    expect(navigate).toHaveBeenCalledWith("/dashboard/enrolled-courses");
    expect(toast.success).toHaveBeenCalled();
    expect(toast.dismiss).toHaveBeenCalledWith("toast_1");

    const storedUser = JSON.parse(localStorage.getItem("user"));
    expect(storedUser.courses).toEqual(["existing_c", "free_c1"]);
  });

  test("surfaces server error toast and does not navigate on rejection (e.g. paid bypass or duplicate)", async () => {
    apiConnector.mockRejectedValue({
      response: {
        status: 400,
        data: { message: "This course is not free. Please complete payment to enroll." },
      },
    });

    const dispatch = jest.fn();
    const navigate = jest.fn();

    const ok = await enrollFreeCourse("jwt_token", ["paid_c1"], null, navigate, dispatch);

    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "This course is not free. Please complete payment to enroll."
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(toast.dismiss).toHaveBeenCalledWith("toast_1");
  });
});
