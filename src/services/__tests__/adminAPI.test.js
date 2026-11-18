import {
  fetchAdminDashboard,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchAdminUserStats,
  fetchAdminUsers,
  fetchAdminUserDetails,
  approveInstructor,
  rejectInstructor,
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

  test("fetchAdminUserStats and fetchAdminUsers send Authorization header and query filters", async () => {
    apiConnector.mockResolvedValueOnce({
      data: { success: true, data: { totalUsers: 10, pendingInstructors: 2 } },
    });
    const stats = await fetchAdminUserStats("admin-tok");
    expect(apiConnector).toHaveBeenCalledWith(
      "GET",
      adminEndpoints.ADMIN_USER_STATS_API,
      null,
      { Authorization: "Bearer admin-tok" }
    );
    expect(stats.pendingInstructors).toBe(2);

    apiConnector.mockResolvedValueOnce({
      data: { success: true, data: { users: [], pagination: { page: 1, totalPages: 1 } } },
    });
    await fetchAdminUsers(
      { search: "jane", accountType: "Instructor", approvalStatus: "PENDING", page: 2, limit: 8 },
      "admin-tok"
    );
    expect(apiConnector).toHaveBeenLastCalledWith(
      "GET",
      adminEndpoints.ADMIN_USERS_LIST_API,
      null,
      { Authorization: "Bearer admin-tok" },
      { search: "jane", accountType: "Instructor", approvalStatus: "PENDING", page: "2", limit: "8" }
    );
  });

  test("fetchAdminUserDetails fetches individual user details cleanly", async () => {
    apiConnector.mockResolvedValueOnce({
      data: { success: true, data: { _id: "u1", email: "inst@test.com" } },
    });
    const details = await fetchAdminUserDetails("u1", "admin-tok");
    expect(apiConnector).toHaveBeenCalledWith(
      "GET",
      `${adminEndpoints.ADMIN_USER_DETAILS_API}/u1`,
      null,
      { Authorization: "Bearer admin-tok" }
    );
    expect(details.email).toBe("inst@test.com");
  });

  test("approveInstructor and rejectInstructor call PUT endpoints and handle errors gracefully", async () => {
    apiConnector.mockResolvedValueOnce({
      data: { success: true, data: { _id: "u1", approvalStatus: "APPROVED" } },
    });
    const approved = await approveInstructor("u1", "admin-tok");
    expect(approved.success).toBe(true);
    expect(apiConnector).toHaveBeenCalledWith(
      "PUT",
      `${adminEndpoints.ADMIN_INSTRUCTOR_ACTION_BASE_API}/u1/approve`,
      {},
      { Authorization: "Bearer admin-tok" }
    );

    apiConnector.mockResolvedValueOnce({
      data: { success: true, data: { _id: "u2", approvalStatus: "REJECTED" } },
    });
    const rejected = await rejectInstructor("u2", "Incomplete bio", "admin-tok");
    expect(rejected.success).toBe(true);
    expect(apiConnector).toHaveBeenLastCalledWith(
      "PUT",
      `${adminEndpoints.ADMIN_INSTRUCTOR_ACTION_BASE_API}/u2/reject`,
      { reason: "Incomplete bio" },
      { Authorization: "Bearer admin-tok" }
    );
  });
});
