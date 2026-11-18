import {
  axiosInstance,
  registerUnauthorizedHandler,
  shouldTriggerSessionExpiry,
} from "../apiconnector";

describe("apiconnector 401 Session Expiry Handling (Regression BUG-025)", () => {
  beforeEach(() => {
    localStorage.clear();
    registerUnauthorizedHandler(null);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("shouldTriggerSessionExpiry", () => {
    it("should return true for 401 on a protected endpoint when user has an active token", () => {
      localStorage.setItem("token", "expired-jwt-token");
      const error = {
        response: { status: 401, data: { message: "Token is invalid or has expired" } },
        config: { url: "http://localhost:4000/api/v1/profile/getEnrolledCourses" },
      };

      expect(shouldTriggerSessionExpiry(error)).toBe(true);
    });

    it("should return true for 401 on instructor protected endpoints when token exists", () => {
      localStorage.setItem("token", "expired-instructor-jwt");
      const error = {
        response: { status: 401 },
        config: { url: "http://localhost:4000/api/v1/profile/instructorDashboard" },
      };

      expect(shouldTriggerSessionExpiry(error)).toBe(true);
    });

    it("should NOT trigger on 401 from login, changepassword, sendotp, or reset-password", () => {
      localStorage.setItem("token", "active-jwt");
      const excludedUrls = [
        "http://localhost:4000/api/v1/auth/login",
        "http://localhost:4000/api/v1/auth/changepassword",
        "http://localhost:4000/api/v1/auth/sendotp",
        "http://localhost:4000/api/v1/auth/reset-password-token",
        "http://localhost:4000/api/v1/auth/reset-password",
        "http://localhost:4000/api/v1/auth/logout",
      ];

      for (const url of excludedUrls) {
        expect(
          shouldTriggerSessionExpiry({ response: { status: 401 }, config: { url } })
        ).toBe(false);
      }
    });

    it("should NOT trigger if user is already logged out (no token in localStorage)", () => {
      const error = {
        response: { status: 401 },
        config: { url: "http://localhost:4000/api/v1/profile/getUserDetails" },
      };

      expect(shouldTriggerSessionExpiry(error)).toBe(false);
    });

    it("should NOT trigger on 403 Forbidden (role restriction) or 500 errors", () => {
      localStorage.setItem("token", "valid-student-token");
      expect(
        shouldTriggerSessionExpiry({
          response: { status: 403 },
          config: { url: "http://localhost:4000/api/v1/profile/instructorDashboard" },
        })
      ).toBe(false);

      expect(
        shouldTriggerSessionExpiry({
          response: { status: 500 },
          config: { url: "http://localhost:4000/api/v1/course/getAllCourses" },
        })
      ).toBe(false);
    });
  });

  describe("Axios response interceptor execution", () => {
    it("should clear localStorage and invoke unauthorizedHandler once on concurrent 401s", async () => {
      localStorage.setItem("token", "stale-jwt");
      localStorage.setItem("user", JSON.stringify({ firstName: "Test" }));

      const handler = jest.fn();
      registerUnauthorizedHandler(handler);

      // Extract the registered response error interceptor
      const rejectedHandler = axiosInstance.interceptors.response.handlers[0].rejected;

      const err1 = {
        response: { status: 401 },
        config: { url: "http://localhost:4000/api/v1/profile/getEnrolledCourses" },
      };
      const err2 = {
        response: { status: 401 },
        config: { url: "http://localhost:4000/api/v1/profile/getUserDetails" },
      };

      await expect(rejectedHandler(err1)).rejects.toEqual(err1);
      await expect(rejectedHandler(err2)).rejects.toEqual(err2);

      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
