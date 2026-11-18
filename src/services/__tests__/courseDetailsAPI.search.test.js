import { searchCourses } from "../operations/courseDetailsAPI";
import { apiConnector } from "../apiconnector";
import { courseEndpoints } from "../apis";

jest.mock("../apiconnector", () => ({
  apiConnector: jest.fn(),
}));

describe("courseDetailsAPI.searchCourses (GAP-004)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("strips empty/blank params and returns search payload on success", async () => {
    const payload = {
      courses: [{ _id: "c1", courseName: "MERN Mastery", price: 999 }],
      pagination: {
        page: 1,
        limit: 9,
        totalCourses: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };

    apiConnector.mockResolvedValue({
      data: { success: true, data: payload },
    });

    const result = await searchCourses({
      q: "  mern  ",
      category: "",
      priceType: "paid",
      minPrice: undefined,
      maxPrice: null,
      page: 1,
      limit: 9,
    });

    expect(apiConnector).toHaveBeenCalledWith(
      "GET",
      courseEndpoints.SEARCH_COURSES_API,
      null,
      null,
      {
        q: "mern",
        priceType: "paid",
        page: "1",
        limit: "9",
      }
    );
    expect(result).toEqual(payload);
  });

  test("throws server error message on failed search request", async () => {
    apiConnector.mockRejectedValue({
      response: { data: { message: "minPrice cannot be greater than maxPrice" } },
    });

    await expect(searchCourses({ minPrice: 1000, maxPrice: 100 })).rejects.toThrow(
      "minPrice cannot be greater than maxPrice"
    );
  });
});
