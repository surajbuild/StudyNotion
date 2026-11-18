import { toast } from "react-hot-toast";
import { apiConnector } from "../apiconnector";
import { adminEndpoints } from "../apis";

const {
  ADMIN_DASHBOARD_API,
  CREATE_CATEGORY_API,
  UPDATE_CATEGORY_API,
  DELETE_CATEGORY_API,
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
