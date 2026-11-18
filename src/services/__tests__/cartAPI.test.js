import {
  fetchUserCart,
  syncCartOnLogin,
  addCourseToCart,
  removeCourseFromCart,
} from "../operations/cartAPI";
import { apiConnector } from "../apiconnector";
import { cartEndpoints } from "../apis";
import { setCartState } from "../../slices/cartSlice";

jest.mock("../apiconnector", () => ({
  apiConnector: jest.fn(),
}));

jest.mock("react-hot-toast", () => ({
  toast: {
    loading: jest.fn(() => "t1"),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("cartAPI Service Operations (GAP-008)", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("fetchUserCart hydrates Redux from authoritative MongoDB cart", async () => {
    const serverCart = {
      cart: [{ _id: "c1", courseName: "MERN", price: 999 }],
      total: 999,
      totalItems: 1,
      removedUnavailableCount: 0,
    };
    apiConnector.mockResolvedValueOnce({ data: { success: true, data: serverCart } });
    const dispatch = jest.fn();

    const data = await fetchUserCart("stu-jwt", dispatch);

    expect(apiConnector).toHaveBeenCalledWith("GET", cartEndpoints.GET_CART_API, null, {
      Authorization: "Bearer stu-jwt",
    });
    expect(dispatch).toHaveBeenCalledWith(setCartState(serverCart));
    expect(data).toEqual(serverCart);
  });

  test("syncCartOnLogin sends localStorage courseIds to /cart/sync and updates Redux", async () => {
    localStorage.setItem(
      "cart",
      JSON.stringify([{ _id: "local_1", price: 500 }, { _id: "local_2", price: 700 }])
    );
    const merged = {
      cart: [
        { _id: "local_1", price: 500 },
        { _id: "local_2", price: 700 },
      ],
      total: 1200,
      totalItems: 2,
      mergedCount: 2,
    };
    apiConnector.mockResolvedValueOnce({ data: { success: true, data: merged } });
    const dispatch = jest.fn();

    await syncCartOnLogin("stu-jwt", dispatch);

    expect(apiConnector).toHaveBeenCalledWith(
      "POST",
      cartEndpoints.SYNC_CART_API,
      { courseIds: ["local_1", "local_2"] },
      { Authorization: "Bearer stu-jwt" }
    );
    expect(dispatch).toHaveBeenCalledWith(setCartState(merged));
  });

  test("addCourseToCart and removeCourseFromCart sync with backend and handle errors", async () => {
    const dispatch = jest.fn();
    apiConnector.mockResolvedValueOnce({
      data: {
        success: true,
        data: { cart: [{ _id: "c1", price: 999 }], total: 999, totalItems: 1 },
      },
    });
    const added = await addCourseToCart({ _id: "c1", price: 999 }, "stu-jwt", dispatch);
    expect(added.success).toBe(true);

    apiConnector.mockResolvedValueOnce({
      data: {
        success: true,
        data: { cart: [], total: 0, totalItems: 0 },
      },
    });
    const removed = await removeCourseFromCart("c1", "stu-jwt", dispatch);
    expect(removed.success).toBe(true);

    apiConnector.mockRejectedValueOnce({
      response: { data: { message: "Course is already in the cart" } },
    });
    const dup = await addCourseToCart("c1", "stu-jwt", dispatch);
    expect(dup.success).toBe(false);
    expect(dup.message).toBe("Course is already in the cart");
  });
});
