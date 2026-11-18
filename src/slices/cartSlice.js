import { createSlice } from "@reduxjs/toolkit";
import { toast } from "react-hot-toast";

const safeParseJSON = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

const persistLocalCart = (cart, total, totalItems) => {
  try {
    localStorage.setItem("cart", JSON.stringify(cart));
    localStorage.setItem("total", JSON.stringify(total));
    localStorage.setItem("totalItems", JSON.stringify(totalItems));
  } catch {
    // Ignore storage quota errors
  }
};

const initialState = {
  cart: safeParseJSON("cart", []),
  total: safeParseJSON("total", 0),
  totalItems: safeParseJSON("totalItems", 0),
  loading: false,
  error: null,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    setCartLoading: (state, action) => {
      state.loading = Boolean(action.payload);
    },

    setCartError: (state, action) => {
      state.error = action.payload || null;
    },

    // Hydrates Redux + localStorage from authoritative MongoDB cart response
    setCartState: (state, action) => {
      const nextCart = Array.isArray(action.payload?.cart) ? action.payload.cart : [];
      const nextTotal =
        typeof action.payload?.total === "number"
          ? action.payload.total
          : nextCart.reduce((sum, item) => sum + Number(item?.price || 0), 0);
      const nextTotalItems =
        typeof action.payload?.totalItems === "number"
          ? action.payload.totalItems
          : nextCart.length;

      state.cart = nextCart;
      state.total = nextTotal;
      state.totalItems = nextTotalItems;
      state.error = null;

      persistLocalCart(nextCart, nextTotal, nextTotalItems);
    },

    addToCart: (state, action) => {
      const course = action.payload;
      const index = state.cart.findIndex((item) => item._id === course._id);

      if (index >= 0) {
        toast.error("Course is already in the cart");
        return;
      }

      state.cart.push(course);
      state.totalItems++;
      state.total += Number(course.price || 0);

      persistLocalCart(state.cart, state.total, state.totalItems);
      toast.success("Course added to cart");
    },

    removeFromCart: (state, action) => {
      const courseId = action.payload;
      const index = state.cart.findIndex((item) => item._id === courseId);

      if (index >= 0) {
        state.totalItems--;
        state.total -= Number(state.cart[index].price || 0);
        state.cart.splice(index, 1);

        persistLocalCart(state.cart, state.total, state.totalItems);
        toast.success("Course removed from cart");
      }
    },

    // Clears ONLY client-side session cart (never deletes the user's persistent MongoDB cart)
    resetCart: (state) => {
      state.cart = [];
      state.total = 0;
      state.totalItems = 0;
      state.error = null;

      try {
        localStorage.removeItem("cart");
        localStorage.removeItem("total");
        localStorage.removeItem("totalItems");
      } catch {
        // Ignore storage errors
      }
    },
  },
});

export const {
  setCartLoading,
  setCartError,
  setCartState,
  addToCart,
  removeFromCart,
  resetCart,
} = cartSlice.actions;
export default cartSlice.reducer;
