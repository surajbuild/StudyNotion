import { toast } from "react-hot-toast";
import { apiConnector } from "../apiconnector";
import { adminEndpoints } from "../apis";

const {
  ADMIN_DASHBOARD_API,
  CREATE_CATEGORY_API,
  UPDATE_CATEGORY_API,
  DELETE_CATEGORY_API,
  ADMIN_USER_STATS_API,
  ADMIN_USERS_LIST_API,
  ADMIN_USER_DETAILS_API,
  ADMIN_INSTRUCTORS_LIST_API,
  ADMIN_INSTRUCTOR_ACTION_BASE_API,
} = adminEndpoints;

export const notifyCategoriesUpdated = () => {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent("categories-updated"));
  }
};

export const fetchAdminDashboard = async (token) => {
  try {
    const response = await apiConnector("GET", ADMIN_DASHBOARD_API, null, {
      Authorization: `Bearer ${token}`,
    });
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Failed to load admin dashboard");
    }
    return response.data.data;
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Unable to load admin dashboard data.";
    throw new Error(message);
  }
};

export const createCategory = async ({ name, description }, token) => {
  const toastId = toast.loading("Creating category...");
  try {
    const response = await apiConnector(
      "POST",
      CREATE_CATEGORY_API,
      { name, description },
      { Authorization: `Bearer ${token}` }
    );
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Could not create category");
    }
    toast.success("Category created successfully", { id: toastId });
    notifyCategoriesUpdated();
    return { success: true, data: response.data.data };
  } catch (error) {
    const message =
      error?.response?.data?.message || error?.message || "Could not create category";
    toast.error(message, { id: toastId });
    return { success: false, message };
  }
};

export const updateCategory = async ({ categoryId, name, description }, token) => {
  const toastId = toast.loading("Updating category...");
  try {
    const response = await apiConnector(
      "PUT",
      UPDATE_CATEGORY_API,
      { categoryId, name, description },
      { Authorization: `Bearer ${token}` }
    );
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Could not update category");
    }
    toast.success("Category updated successfully", { id: toastId });
    notifyCategoriesUpdated();
    return { success: true, data: response.data.data };
  } catch (error) {
    const message =
      error?.response?.data?.message || error?.message || "Could not update category";
    toast.error(message, { id: toastId });
    return { success: false, message };
  }
};

export const deleteCategory = async (categoryId, token) => {
  const toastId = toast.loading("Deleting category...");
  try {
    const response = await apiConnector(
      "DELETE",
      DELETE_CATEGORY_API,
      { categoryId },
      { Authorization: `Bearer ${token}` }
    );
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Could not delete category");
    }
    toast.success("Category deleted successfully", { id: toastId });
    notifyCategoriesUpdated();
    return { success: true, data: response.data.data };
  } catch (error) {
    const message =
      error?.response?.data?.message || error?.message || "Could not delete category";
    toast.error(message, { id: toastId });
    return {
      success: false,
      message,
      associatedCourseCount: error?.response?.data?.associatedCourseCount,
    };
  }
};

// ============================================================
// ADMIN USER MANAGEMENT & INSTRUCTOR APPROVAL APIs (GAP-002)
// ============================================================

export const fetchAdminUserStats = async (token) => {
  try {
    const response = await apiConnector("GET", ADMIN_USER_STATS_API, null, {
      Authorization: `Bearer ${token}`,
    });
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Failed to load user statistics");
    }
    return response.data.data;
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Unable to load user management statistics.";
    throw new Error(message);
  }
};

export const fetchAdminUsers = async (params = {}, token) => {
  try {
    const queryParams = {};
    if (params.search && params.search.trim()) queryParams.search = params.search.trim();
    if (params.accountType && params.accountType !== "ALL") {
      queryParams.accountType = params.accountType;
    }
    if (params.approvalStatus && params.approvalStatus !== "ALL") {
      queryParams.approvalStatus = params.approvalStatus;
    }
    if (params.page) queryParams.page = String(params.page);
    if (params.limit) queryParams.limit = String(params.limit);

    const endpoint = params.instructorsOnly
      ? ADMIN_INSTRUCTORS_LIST_API
      : ADMIN_USERS_LIST_API;

    const response = await apiConnector(
      "GET",
      endpoint,
      null,
      { Authorization: `Bearer ${token}` },
      queryParams
    );
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Failed to load users");
    }
    return response.data.data;
  } catch (error) {
    const message =
      error?.response?.data?.message || error?.message || "Unable to load users.";
    throw new Error(message);
  }
};

export const fetchAdminUserDetails = async (userId, token) => {
  try {
    const response = await apiConnector(
      "GET",
      `${ADMIN_USER_DETAILS_API}/${userId}`,
      null,
      { Authorization: `Bearer ${token}` }
    );
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Failed to load user details");
    }
    return response.data.data;
  } catch (error) {
    const message =
      error?.response?.data?.message || error?.message || "Unable to load user details.";
    throw new Error(message);
  }
};

export const approveInstructor = async (userId, token) => {
  const toastId = toast.loading("Approving instructor...");
  try {
    const response = await apiConnector(
      "PUT",
      `${ADMIN_INSTRUCTOR_ACTION_BASE_API}/${userId}/approve`,
      {},
      { Authorization: `Bearer ${token}` }
    );
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Could not approve instructor");
    }
    toast.success("Instructor approved successfully", { id: toastId });
    return { success: true, data: response.data.data };
  } catch (error) {
    const message =
      error?.response?.data?.message || error?.message || "Could not approve instructor";
    toast.error(message, { id: toastId });
    return { success: false, message };
  }
};

export const rejectInstructor = async (userId, reason, token) => {
  const toastId = toast.loading("Rejecting instructor application...");
  try {
    const payload = reason && reason.trim() ? { reason: reason.trim() } : {};
    const response = await apiConnector(
      "PUT",
      `${ADMIN_INSTRUCTOR_ACTION_BASE_API}/${userId}/reject`,
      payload,
      { Authorization: `Bearer ${token}` }
    );
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Could not reject instructor");
    }
    toast.success("Instructor application rejected", { id: toastId });
    return { success: true, data: response.data.data };
  } catch (error) {
    const message =
      error?.response?.data?.message || error?.message || "Could not reject instructor";
    toast.error(message, { id: toastId });
    return { success: false, message };
  }
};
