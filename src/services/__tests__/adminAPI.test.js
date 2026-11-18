import {
  fetchAdminDashboard,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../operations/adminAPI";
import { apiConnector } from "../apiconnector";
import { adminEndpoints } from "../apis";

jest.mock("../apiconnector", () => ({
  apiConnector: jest.fn(),
}));

jest.mock("react-hot-toast", () => ({
  toast: {
    loading: jest.fn(() => "toast-id"),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("adminAPI Service Operations (GAP-001)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("fetchAdminDashboard calls protected endpoint with Bearer token and throws on failure", async () => {
    const payload = { stats: { totalCategories: 3 }, categories: [] };
    apiConnector.mockResolvedValueOnce({ data: { success: true, data: payload } });

    const data = await fetchAdminDashboard("admin-token");
    expect(apiConnector).toHaveBeenCalledWith(
      "GET",
      adminEndpoints.ADMIN_DASHBOARD_API,
      null,
      { Authorization: "Bearer admin-token" }
    );
    expect(data).toEqual(payload);

    apiConnector.mockRejectedValueOnce({
      response: { data: { message: "This route is accessible to admins only" } },
    });
    await expect(fetchAdminDashboard("student-token")).rejects.toThrow(
      "This route is accessible to admins only"
    );
  });

  test("createCategory and updateCategory notify live category listeners on success", async () => {
    const listener = jest.fn();
    window.addEventListener("categories-updated", listener);

    apiConnector.mockResolvedValueOnce({
      data: { success: true, data: { _id: "c1", name: "Cloud" } },
    });
    const created = await createCategory({ name: "Cloud", description: "Cloud desc" }, "tok");
    expect(created.success).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    apiConnector.mockResolvedValueOnce({
      data: { success: true, data: { _id: "c1", name: "Cloud Pro" } },
    });
    const updated = await updateCategory(
      { categoryId: "c1", name: "Cloud Pro", description: "Updated" },
      "tok"
    );
    expect(updated.success).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);

    window.removeEventListener("categories-updated", listener);
  });

  test("deleteCategory returns associatedCourseCount when backend blocks unsafe deletion", async () => {
    apiConnector.mockRejectedValueOnce({
      response: {
        data: {
          message: "Cannot delete category because 2 course(s) are associated with it.",
          associatedCourseCount: 2,
        },
      },
    });

    const res = await deleteCategory("cat-in-use", "admin-tok");
    expect(res.success).toBe(false);
    expect(res.associatedCourseCount).toBe(2);
    expect(res.message).toMatch(/2 course/i);
  });
});
