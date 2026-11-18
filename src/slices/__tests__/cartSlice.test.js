import cartReducer, { addToCart, removeFromCart, resetCart } from "../cartSlice";

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("cartSlice Redux Reducer", () => {
  const baseState = {
    cart: [],
    total: 0,
    totalItems: 0,
  };

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("should add a course to empty cart and update total/totalItems", () => {
    const course = { _id: "course1", courseName: "React Mastery", price: 1000 };
    const nextState = cartReducer(baseState, addToCart(course));

    expect(nextState.cart).toHaveLength(1);
    expect(nextState.cart[0]).toEqual(course);
    expect(nextState.total).toBe(1000);
    expect(nextState.totalItems).toBe(1);
  });

  it("should prevent duplicate courses from being added to cart", () => {
    const course = { _id: "course1", courseName: "React Mastery", price: 1000 };
    const stateWithItem = {
      cart: [course],
      total: 1000,
      totalItems: 1,
    };

    const nextState = cartReducer(stateWithItem, addToCart(course));
    expect(nextState.cart).toHaveLength(1);
    expect(nextState.total).toBe(1000);
    expect(nextState.totalItems).toBe(1);
  });

  it("should remove course by id and update total/totalItems", () => {
    const course1 = { _id: "c1", price: 500 };
    const course2 = { _id: "c2", price: 800 };
    const stateWithTwo = {
      cart: [course1, course2],
      total: 1300,
      totalItems: 2,
    };

    const nextState = cartReducer(stateWithTwo, removeFromCart("c1"));
    expect(nextState.cart).toHaveLength(1);
    expect(nextState.cart[0]._id).toBe("c2");
    expect(nextState.total).toBe(800);
    expect(nextState.totalItems).toBe(1);
  });

  it("should do nothing if removing a non-existent course id", () => {
    const course1 = { _id: "c1", price: 500 };
    const stateWithOne = {
      cart: [course1],
      total: 500,
      totalItems: 1,
    };

    const nextState = cartReducer(stateWithOne, removeFromCart("c999"));
    expect(nextState.cart).toHaveLength(1);
    expect(nextState.total).toBe(500);
  });

  it("should reset cart to empty state", () => {
    const populatedState = {
      cart: [{ _id: "c1", price: 500 }],
      total: 500,
      totalItems: 1,
    };

    const nextState = cartReducer(populatedState, resetCart());
    expect(nextState.cart).toEqual([]);
    expect(nextState.total).toBe(0);
    expect(nextState.totalItems).toBe(0);
  });
});
