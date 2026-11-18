import profileReducer, { setUser, setLoading } from "../profileSlice";

describe("profileSlice Redux Reducer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should handle initial state without crashing if localStorage is empty or corrupted", () => {
    localStorage.setItem("user", "corrupted-json-not-valid");
    const state = profileReducer(undefined, { type: "INIT" });
    expect(state.loading).toBe(false);
  });

  it("should handle setUser", () => {
    const user = {
      _id: "user1",
      firstName: "Jane",
      lastName: "Doe",
      accountType: "Student",
    };
    const state = profileReducer(undefined, setUser(user));
    expect(state.user).toEqual(user);
  });

  it("should handle setLoading", () => {
    const state = profileReducer(undefined, setLoading(true));
    expect(state.loading).toBe(true);
  });
});
