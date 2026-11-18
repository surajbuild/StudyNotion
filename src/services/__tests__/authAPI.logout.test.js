import { logout } from "../operations/authAPI";
import { apiConnector } from "../apiconnector";
import { setToken } from "../../slices/authSlice";
import { setUser } from "../../slices/profileSlice";
import { resetCart } from "../../slices/cartSlice";

jest.mock("../apiconnector", () => ({
  apiConnector: jest.fn(),
}));

jest.mock("react-hot-toast", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
  },
}));

describe("authAPI.logout (Regression GAP-006 / BUG-025)", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("should call POST /auth/logout, wipe Redux and localStorage, and navigate home", async () => {
    apiConnector.mockResolvedValue({ data: { success: true } });
    localStorage.setItem("token", "active-token");
    localStorage.setItem("user", JSON.stringify({ accountType: "Student" }));

    const dispatch = jest.fn();
    const navigate = jest.fn();

    await logout(navigate)(dispatch);

    expect(apiConnector).toHaveBeenCalledWith("POST", expect.stringContaining("/auth/logout"));
    expect(dispatch).toHaveBeenCalledWith(setToken(null));
    expect(dispatch).toHaveBeenCalledWith(setUser(null));
    expect(dispatch).toHaveBeenCalledWith(resetCart());
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("should still clear local session state even if server logout call fails", async () => {
    apiConnector.mockRejectedValue(new Error("Network Error"));
    localStorage.setItem("token", "instructor-token");
    localStorage.setItem("user", JSON.stringify({ accountType: "Instructor" }));

    const dispatch = jest.fn();
    const navigate = jest.fn();

    await logout(navigate)(dispatch);

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(dispatch).toHaveBeenCalledWith(setToken(null));
    expect(navigate).toHaveBeenCalledWith("/");
  });
});
