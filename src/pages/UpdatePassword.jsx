import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { BiArrowBack } from "react-icons/bi";
import { Link } from "react-router-dom";
import { resetPassword } from "../services/operations/authAPI";
import { BsCheckCircle } from "react-icons/bs";

const UpdatePassword = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const { loading } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // ✅ Enhancement: track whether the reset was successful so we can show
  // a confirmation screen instead of immediately navigating away.
  const [resetSuccess, setResetSuccess] = useState(false);

  const { password, confirmPassword } = formData;

  const handleOnChange = (e) => {
    setFormData((prevData) => ({
      ...prevData,
      [e.target.name]: e.target.value,
    }));
  };

  const handleOnSubmit = async (e) => {
    e.preventDefault();

    // ✅ FIX: Extract the reset token from the URL.
    // The route is /update-password/:id, so the token is the last segment.
    const token = location.pathname.split("/").at(-1);

    // ✅ FIX: Added client-side password-match check before hitting the network.
    // Showing an instant toast avoids an unnecessary round-trip to the backend.
    if (password !== confirmPassword) {
      const { toast } = await import("react-hot-toast");
      toast.error("Passwords do not match");
      return;
    }

    const success = await dispatch(resetPassword(password, confirmPassword, token));
    if (success) {
      setResetSuccess(true);
    }
  };

  // Simple password-strength calculator for the visual indicator
  const getPasswordStrength = (pwd) => {
    if (pwd.length === 0) return null;
    if (pwd.length < 6)
      return { text: "Weak", color: "text-red-100", width: "w-1/4" };
    if (pwd.length < 10)
      return { text: "Medium", color: "text-yellow-500", width: "w-1/2" };
    if (
      pwd.length >= 10 &&
      /[A-Z]/.test(pwd) &&
      /[0-9]/.test(pwd)
    )
      return { text: "Strong", color: "text-caribbeangreen-100", width: "w-full" };
    return { text: "Good", color: "text-blue-100", width: "w-3/4" };
  };

  const passwordStrength = getPasswordStrength(password);

  // ─── SUCCESS SCREEN ───
  // Shown after a successful password reset so the user knows it worked
  // before they navigate to login.
  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-richblack-900 flex items-center justify-center px-4">
        <div className="w-full max-w-[508px] mx-auto flex flex-col gap-6 items-center text-center">
          <div className="text-6xl">✅</div>
          <h1 className="text-richblack-5 text-3xl font-semibold">
            Password Reset Successfully
          </h1>
          <p className="text-richblack-100 text-lg">
            You can now log in with your new password.
          </p>
          <Link
            to="/login"
            className="w-full bg-yellow-50 py-[12px] px-[24px] rounded-[8px] font-medium text-richblack-900 hover:bg-yellow-100 hover:scale-95 transition-all duration-200 text-center"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-richblack-900 flex items-center justify-center px-4">
      {loading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="spinner"></div>
          <p className="text-richblack-100">Loading...</p>
        </div>
      ) : (
        <div className="w-full max-w-[508px] mx-auto flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col gap-3">
            <h1 className="text-richblack-5 text-3xl font-semibold leading-[2.375rem]">
              Choose new password
            </h1>
            <p className="text-richblack-100 text-lg leading-[1.625rem]">
              Almost done. Enter your new password and you're all set.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleOnSubmit} className="flex flex-col gap-6">
            {/* ─── New Password ─── */}
            <label className="relative">
              <p className="mb-2 text-sm leading-[1.375rem] text-richblack-5">
                New Password <sup className="text-pink-200">*</sup>
              </p>
              <input
                required
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={handleOnChange}
                placeholder="Enter new password"
                style={{
                  boxShadow: "inset 0px -1px 0px rgba(255, 255, 255, 0.18)",
                }}
                className="w-full rounded-[0.5rem] bg-richblack-800 p-[12px] pr-12 text-richblack-5 outline-none border border-richblack-700 focus:border-richblue-300 transition-colors duration-200"
              />
              <span
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-[38px] z-[10] cursor-pointer"
              >
                {showPassword ? (
                  <AiOutlineEye fontSize={24} fill="#AFB2BF" />
                ) : (
                  <AiOutlineEyeInvisible fontSize={24} fill="#AFB2BF" />
                )}
              </span>

              {/* Password Strength Indicator */}
              {passwordStrength && (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-richblack-100">
                      Password strength
                    </span>
                    <span
                      className={`text-xs font-medium ${passwordStrength.color}`}
                    >
                      {passwordStrength.text}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-richblack-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${passwordStrength.color.replace(
                        "text-",
                        "bg-"
                      )} transition-all duration-300 ${passwordStrength.width}`}
                    ></div>
                  </div>
                </div>
              )}
            </label>

            {/* ─── Confirm Password ─── */}
            <label className="relative">
              <p className="mb-2 text-sm leading-[1.375rem] text-richblack-5">
                Confirm New Password <sup className="text-pink-200">*</sup>
              </p>
              <input
                required
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={confirmPassword}
                onChange={handleOnChange}
                placeholder="Confirm new password"
                style={{
                  boxShadow: "inset 0px -1px 0px rgba(255, 255, 255, 0.18)",
                }}
                className="w-full rounded-[0.5rem] bg-richblack-800 p-[12px] pr-12 text-richblack-5 outline-none border border-richblack-700 focus:border-richblue-300 transition-colors duration-200"
              />
              <span
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-[38px] z-[10] cursor-pointer"
              >
                {/* ✅ FIX: Was using `showPassword` instead of `showConfirmPassword`.
                    The confirm-password eye icon was controlled by the wrong state,
                    so toggling it would actually toggle the NEW password visibility. */}
                {showConfirmPassword ? (
                  <AiOutlineEye fontSize={24} fill="#AFB2BF" />
                ) : (
                  <AiOutlineEyeInvisible fontSize={24} fill="#AFB2BF" />
                )}
              </span>

              {/* Real-time match indicator */}
              {confirmPassword.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  {password === confirmPassword ? (
                    <>
                      <BsCheckCircle className="text-caribbeangreen-100" />
                      <span className="text-xs text-caribbeangreen-100">
                        Passwords match
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-pink-200">
                      Passwords do not match
                    </span>
                  )}
                </div>
              )}
            </label>

            {/* Password requirements checklist */}
            {/* <div className="bg-richblack-800 border border-richblack-700 rounded-lg p-4">
              <p className="text-sm font-medium text-richblack-5 mb-3">
                Password must contain:
              </p>
              <ul className="space-y-2 text-xs text-richblack-100">
                <li className="flex items-center gap-2">
                  <span
                    className={
                      password.length >= 8
                        ? "text-caribbeangreen-100"
                        : "text-richblack-400"
                    }
                  >
                    {password.length >= 8 ? "✓" : "○"}
                  </span>
                  At least 8 characters
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className={
                      /[A-Z]/.test(password)
                        ? "text-caribbeangreen-100"
                        : "text-richblack-400"
                    }
                  >
                    {/[A-Z]/.test(password) ? "✓" : "○"}
                  </span>
                  One uppercase letter
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className={
                      /[a-z]/.test(password)
                        ? "text-caribbeangreen-100"
                        : "text-richblack-400"
                    }
                  >
                    {/[a-z]/.test(password) ? "✓" : "○"}
                  </span>
                  One lowercase letter
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className={
                      /[0-9]/.test(password)
                        ? "text-caribbeangreen-100"
                        : "text-richblack-400"
                    }
                  >
                    {/[0-9]/.test(password) ? "✓" : "○"}
                  </span>
                  One number
                </li>
              </ul>
            </div> */}

            <button
              type="submit"
              className="w-full bg-yellow-50 py-[12px] px-[24px] rounded-[8px] font-medium text-richblack-900 hover:bg-yellow-100 hover:scale-95 transition-all duration-200"
            >
              Reset Password
            </button>
          </form>

          {/* Back to login */}
          <div className="flex items-center gap-2">
            <Link to="/login">
              <div className="flex items-center gap-2 text-richblack-5 hover:text-richblue-100 transition-colors duration-200">
                <BiArrowBack className="text-lg" />
                <p className="text-base font-medium">Back to login</p>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatePassword;
