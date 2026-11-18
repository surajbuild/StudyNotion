import { toast } from "react-hot-toast";
import { apiConnector } from "../apiconnector";
import { cartEndpoints } from "../apis";
import {
  setCartState,
  setCartLoading,
  setCartError,
} from "../../slices/cartSlice";

const {
  GET_CART_API,
  ADD_TO_CART_API,
  REMOVE_FROM_CART_API,
  SYNC_CART_API,
} = cartEndpoints;

const readLocalCartCourseIds = () => {
  try {
    const raw = localStorage.getItem("cart");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === "string" ? item : item?._id))
      .filter((id) => typeof id === "string" && id.trim().length > 0);
  } catch {
    return [];
  }
};

export const fetchUserCart = async (token, dispatch) => {
  if (!token) return null;
  dispatch(setCartLoading(true));
  dispatch(setCartError(null));
  try {
    const response = await apiConnector("GET", GET_CART_API, null, {
      Authorization: `Bearer ${token}`,
    });
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Failed to load cart");
    }
    const data = response.data.data;
    dispatch(setCartState(data));
    return data;
  } catch (error) {
    const message =
      error?.response?.data?.message || error?.message || "Could not load your cart";
    dispatch(setCartError(message));
    return null;
  } finally {
    dispatch(setCartLoading(false));
  }
};

export const syncCartOnLogin = async (token, dispatch) => {
  if (!token) return null;
  const localCourseIds = readLocalCartCourseIds();
  dispatch(setCartLoading(true));
  dispatch(setCartError(null));
  try {
    const response = await apiConnector(
      "POST",
      SYNC_CART_API,
      { courseIds: localCourseIds },
      { Authorization: `Bearer ${token}` }
    );
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Failed to synchronize cart");
    }
    const data = response.data.data;
    dispatch(setCartState(data));
    return data;
  } catch (error) {
    // Non-blocking on login: fall back to direct fetch if sync fails
    return fetchUserCart(token, dispatch);
  } finally {
    dispatch(setCartLoading(false));
  }
};

export const addCourseToCart = async (course, token, dispatch) => {
  const courseId = typeof course === "string" ? course : course?._id;
  if (!courseId || !token) return { success: false };

  const toastId = toast.loading("Adding to cart...");
  try {
    const response = await apiConnector(
      "POST",
      ADD_TO_CART_API,
      { courseId },
      { Authorization: `Bearer ${token}` }
    );
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Could not add course to cart");
    }
    dispatch(setCartState(response.data.data));
    toast.success("Course added to cart", { id: toastId });
    return { success: true, data: response.data.data };
  } catch (error) {
    const message =
      error?.response?.data?.message || error?.message || "Could not add course to cart";
    toast.error(message, { id: toastId });
    return { success: false, message };
  }
};

export const removeCourseFromCart = async (courseId, token, dispatch) => {
  if (!courseId || !token) return { success: false };

  const toastId = toast.loading("Removing from cart...");
  try {
    const response = await apiConnector(
      "DELETE",
      `${REMOVE_FROM_CART_API}/${encodeURIComponent(courseId)}`,
      null,
      { Authorization: `Bearer ${token}` }
    );
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Could not remove course from cart");
    }
    dispatch(setCartState(response.data.data));
    toast.success("Course removed from cart", { id: toastId });
    return { success: true, data: response.data.data };
  } catch (error) {
    const message =
      error?.response?.data?.message || error?.message || "Could not remove course from cart";
    toast.error(message, { id: toastId });
    return { success: false, message };
  }
};
