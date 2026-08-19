import { toast } from "react-hot-toast";
import { setLoading, setToken } from "../../slices/authSlice";
import { resetCart } from "../../slices/cartSlice";
import { setUser } from "../../slices/profileSlice";
import { apiConnector } from "../apiconnector";
import { endpoints } from "../apis";

// Destructure once at module level — avoids repeating `endpoints.XXX` everywhere.
const {
  SENDOTP_API,
  SIGNUP_API,
  LOGIN_API,
  RESETPASSTOKEN_API,
  RESETPASSWORD_API,
} = endpoints;

// ============================================================
// SEND OTP  —  called during signup to email a verification code
// ============================================================
export const sendOtp = (email, navigate) => async (dispatch) => {
  const toastId = toast.loading("Loading...");
  dispatch(setLoading(true));

  try {
    const response = await apiConnector("POST", SENDOTP_API, {
      email,
      checkUserPresent: true, // tells the backend to verify email isn't already registered
    });

    if (!response.data.success) {
      throw new Error(
        response.data.message || "Could not send OTP. Please try again later."
      );
    }

    toast.success("OTP sent successfully", { id: toastId });
    navigate("/verify-email");
  } catch (error) {
    // ✅ Graceful error extraction: checks Axios response body first,
    // then the native Error message, then a hard-coded fallback.
    const errorMessage =
      error?.response?.data?.message ||
      error.message ||
      "Could not send OTP";
    toast.error(errorMessage, { id: toastId });
  } finally {
    dispatch(setLoading(false));
  }
};

// ============================================================
// SIGN UP  —  creates a new account after OTP verification
// ============================================================
export const signUp =
  (
    accountType,
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
    otp,
    navigate
  ) =>
  async (dispatch) => {
    const toastId = toast.loading("Loading...");
    dispatch(setLoading(true));

    try {
      const response = await apiConnector("POST", SIGNUP_API, {
        accountType,
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        otp,
      });

      if (!response.data.success) {
        throw new Error(
          response.data.message ||
            "Could not sign up. Please try again later."
        );
      }

      const successMessage =
        response?.data?.message || "Signup Successful";
      toast.success(successMessage, { id: toastId });
      navigate("/login"); // after successful signup, go to login
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || "Signup Failed";
      toast.error(errorMessage, { id: toastId });
      // ✅ FIX: Don't navigate on error - let user stay on VerifyEmail page
      // to retry with the correct OTP instead of redirecting back to signup
    } finally {
      dispatch(setLoading(false));
    }
  };

// ============================================================
// LOGIN  —  authenticates and stores user session
// ============================================================
export const login = (email, password, navigate) => async (dispatch) => {
  const toastId = toast.loading("Loading...");
  dispatch(setLoading(true));

  try {
    const response = await apiConnector("POST", LOGIN_API, {
      email,
      password,
    });

    if (!response.data.success) {
      throw new Error(response.data.message);
    }

    toast.success("Login Successful", { id: toastId });

    // Store the JWT in Redux
    dispatch(setToken(response.data.token));

    const userImage = response.data.user.image
      ? response.data.user.image
      : `https://api.dicebear.com/6.x/initials/svg?seed=${response.data.user.firstName}+${response.data.user.lastName}`;

    dispatch(setUser({ ...response.data.user, image: userImage }));

    // Authorization header later.
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("user", JSON.stringify(response.data.user));

    navigate("/dashboard/my-profile");
  } catch (error) {
    const errorMessage =
      error?.response?.data?.message ||
      error.message ||
      "Login Failed";
    toast.error(errorMessage, { id: toastId });
  } finally {
    dispatch(setLoading(false));
  }
};

// ============================================================
// LOGOUT  —  clears all client-side session data
// ============================================================
export const logout = (navigate) => async (dispatch) => {
  // Wipe Redux state
  dispatch(setToken(null));
  dispatch(setUser(null));
  dispatch(resetCart());

  // Wipe persisted session
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  toast.success("Logged Out");
  navigate("/");
};

// ============================================================
// FORGOT PASSWORD  —  requests a reset-token email from the backend
// ============================================================
export const getPasswordResettoken =
  (email, setEmailSent) => async (dispatch) => {
    const toastId = toast.loading("Sending reset email...");
    dispatch(setLoading(true));

    try {
      const response = await apiConnector("POST", RESETPASSTOKEN_API, {
        email,
      });

      if (!response.data.success) {
        throw new Error(
          response.data.message ||
            "Could not send password reset email. Please try again later."
        );
      }

      toast.success("Reset Email Sent", { id: toastId });
      setEmailSent(true); // switches the UI to the "check your inbox" state
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error.message ||
        "Failed to send reset email";
      toast.error(errorMessage, { id: toastId });
    } finally {
      dispatch(setLoading(false));
    }
  };

// ============================================================
// RESET PASSWORD  —  submits the new password with the email token
// ============================================================
export const resetPassword =
  (password, confirmPassword, token) => async (dispatch) => {
    const toastId = toast.loading("Resetting password...");
    dispatch(setLoading(true));

    try {
      const response = await apiConnector("POST", RESETPASSWORD_API, {
        password,
        confirmPassword,
        token, // the JWT extracted from the URL by UpdatePassword.jsx
      });

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      toast.success("Password Reset Successfully.", { id: toastId });

    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error.message ||
        "Failed to reset password. Please try again.";
      toast.error(errorMessage, { id: toastId });
    } finally {
      dispatch(setLoading(false));
    }
  };
