import authReducer, { setToken, setLoading, setSignupData } from "../authSlice";

describe("authSlice Redux Reducer", () => {
  const initialState = {
    signupData: null,
    loading: false,
    token: null,
  };

  it("should return the initial state when called with undefined", () => {
    const state = authReducer(undefined, { type: "UNKNOWN_ACTION" });
    expect(state.signupData).toBeNull();
    expect(state.loading).toBe(false);
  });

  it("should handle setToken", () => {
    const token = "mock-jwt-token-xyz";
    const state = authReducer(initialState, setToken(token));
    expect(state.token).toBe(token);
  });

  it("should handle setLoading", () => {
    const state = authReducer(initialState, setLoading(true));
    expect(state.loading).toBe(true);

    const stateFalse = authReducer(state, setLoading(false));
    expect(stateFalse.loading).toBe(false);
  });

  it("should handle setSignupData", () => {
    const signupData = {
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
    };
    const state = authReducer(initialState, setSignupData(signupData));
    expect(state.signupData).toEqual(signupData);
  });
});
