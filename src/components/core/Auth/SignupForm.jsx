import React, { useState } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { useDispatch } from "react-redux";
import { ACCOUNT_TYPE } from "../../../utils/constants";
import Tab from "../../common/Tab";
import { useNavigate } from "react-router-dom";
import { setSignupData } from "../../../slices/authSlice";
import { sendOtp } from "../../../services/operations/authAPI";
import { toast } from "react-hot-toast";
import { validateNewPassword } from "../../../utils/passwordPolicy";

const SignupForm = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Controls which tab (Student / Instructor) is selected
  const [accountType, setAccountType] = useState(ACCOUNT_TYPE.STUDENT);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const { firstName, lastName, email, password, confirmPassword } = formData;

  // Update the relevant field whenever any input changes
  const handleOnChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    if (name === "password" && passwordError) {
      setPasswordError("");
    }
    if ((name === "confirmPassword" || name === "password") && confirmPasswordError) {
      setConfirmPasswordError("");
    }
  };

  const handleOnSubmit = (e) => {
    e.preventDefault();
    setPasswordError("");
    setConfirmPasswordError("");

    // Client-side validation before hitting the network
    const passwordValidation = validateNewPassword(password);
    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.message);
      toast.error(passwordValidation.message);
      return;
    }

    if (!confirmPassword.trim()) {
      const msg = "Please confirm your password";
      setConfirmPasswordError(msg);
      toast.error(msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = "Passwords Do Not Match";
      setConfirmPasswordError(msg);
      toast.error(msg);
      return;
    }

    // Persist signup payload in Redux so VerifyEmail.jsx can read it after OTP
    const signupData = { ...formData, accountType };
    dispatch(setSignupData(signupData));

    // Request OTP — on success the thunk navigates to /verify-email
    // Preserve typed form inputs in case OTP request fails (e.g. email already exists)
    dispatch(sendOtp(formData.email, navigate));
  };

  // Tab configuration for the Student / Instructor switcher
  const tabData = [
    { id: 1, tabName: "Student", type: ACCOUNT_TYPE.STUDENT },
    { id: 2, tabName: "Instructor", type: ACCOUNT_TYPE.INSTRUCTOR },
  ];

  return (
    <div>
      {/* Account-type tabs */}
      <Tab tabData={tabData} field={accountType} setField={setAccountType} />

      {/* Signup form */}
      <form onSubmit={handleOnSubmit} className="flex w-full flex-col gap-y-4">
        {/* First name + Last name row */}
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="w-full">
            <p className="mb-1 text-[0.875rem] leading-[1.375rem] text-richblack-5">
              First Name <sup className="text-pink-200">*</sup>
            </p>
            <input
              required
              type="text"
              name="firstName"
              value={firstName}
              onChange={handleOnChange}
              placeholder="Enter first name"
              style={{
                boxShadow: "inset 0px -1px 0px rgba(255, 255, 255, 0.18)",
              }}
              className="w-full rounded-[0.5rem] bg-richblack-800 p-[12px] text-richblack-5"
            />
          </label>
          <label className="w-full">
            <p className="mb-1 text-[0.875rem] leading-[1.375rem] text-richblack-5">
              Last Name <sup className="text-pink-200">*</sup>
            </p>
            <input
              required
              type="text"
              name="lastName"
              value={lastName}
              onChange={handleOnChange}
              placeholder="Enter last name"
              style={{
                boxShadow: "inset 0px -1px 0px rgba(255, 255, 255, 0.18)",
              }}
              className="w-full rounded-[0.5rem] bg-richblack-800 p-[12px] text-richblack-5"
            />
          </label>
        </div>

        {/* Email */}
        <label className="w-full">
          <p className="mb-1 text-[0.875rem] leading-[1.375rem] text-richblack-5">
            Email Address <sup className="text-pink-200">*</sup>
          </p>
          <input
            required
            type="email"
            name="email"
            value={email}
            onChange={handleOnChange}
            placeholder="Enter email address"
            style={{
              boxShadow: "inset 0px -1px 0px rgba(255, 255, 255, 0.18)",
            }}
            className="w-full rounded-[0.5rem] bg-richblack-800 p-[12px] text-richblack-5"
          />
        </label>

        {/* Password + Confirm Password row */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Password */}
          <label className="relative w-full">
            <p className="mb-1 text-[0.875rem] leading-[1.375rem] text-richblack-5">
              Create Password <sup className="text-pink-200">*</sup>
            </p>
            <input
              required
              type={showPassword ? "text" : "password"}
              name="password"
              value={password}
              onChange={handleOnChange}
              placeholder="Enter Password"
              style={{
                boxShadow: "inset 0px -1px 0px rgba(255, 255, 255, 0.18)",
              }}
              className="w-full rounded-[0.5rem] bg-richblack-800 p-[12px] pr-10 text-richblack-5"
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
            {passwordError ? (
              <p role="alert" className="mt-1 text-xs text-pink-200">
                {passwordError}
              </p>
            ) : (
              <p className="mt-1 text-xs text-richblack-300">
                Must be at least 8 characters
              </p>
            )}
          </label>

          {/* Confirm Password */}
          <label className="relative w-full">
            <p className="mb-1 text-[0.875rem] leading-[1.375rem] text-richblack-5">
              Confirm Password <sup className="text-pink-200">*</sup>
            </p>
            <input
              required
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              value={confirmPassword}
              onChange={handleOnChange}
              placeholder="Confirm Password"
              style={{
                boxShadow: "inset 0px -1px 0px rgba(255, 255, 255, 0.18)",
              }}
              className="w-full rounded-[0.5rem] bg-richblack-800 p-[12px] pr-10 text-richblack-5"
            />
            <span
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-[38px] z-[10] cursor-pointer"
            >
              {/* Same icon-swap fix applied here */}
              {showConfirmPassword ? (
                <AiOutlineEye fontSize={24} fill="#AFB2BF" />
              ) : (
                <AiOutlineEyeInvisible fontSize={24} fill="#AFB2BF" />
              )}
            </span>
            {confirmPasswordError && (
              <p role="alert" className="mt-1 text-xs text-pink-200">
                {confirmPasswordError}
              </p>
            )}
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="mt-6 rounded-[8px] bg-yellow-50 py-[8px] px-[12px] font-medium text-richblack-900 hover:scale-95 transition-all duration-200"
        >
          Create Account
        </button>
      </form>
    </div>
  );
};

export default SignupForm;
