import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import OTPInput from "react-otp-input";
import { Link, useNavigate } from "react-router-dom";
import { sendOtp, signUp } from "../services/operations/authAPI";
import { BiArrowBack } from "react-icons/bi";
import { RxCountdownTimer } from "react-icons/rx";

const VerifyEmail = () => {
  const [otp, setOtp] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { signupData, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    // If the user lands on this page without valid signup data
    // (e.g. by typing the URL directly), redirect them back to signup.
    if (!signupData) {
      navigate("/signup");
    }
  }, [signupData, navigate]);

  const handleOnSubmit = (e) => {
    e.preventDefault();
    const {
      accountType,
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    } = signupData;

    dispatch(
      signUp(
        accountType,
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        otp,       // ← from local state, typed by the user
        navigate   // ← from useNavigate hook
      )
    );
  };

  return (
    <div className="min-h-screen bg-richblack-900 flex items-center justify-center px-4">
      {loading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="spinner"></div>
          <p className="text-richblack-100">Creating your account...</p>
        </div>
      ) : (
        <div className="w-full max-w-[508px] mx-auto flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col gap-3">
            <h1 className="text-richblack-5 text-3xl font-semibold leading-[2.375rem]">
              Verify Email
            </h1>
            <p className="text-richblack-100 text-lg leading-[1.625rem]">
              A verification code has been sent to you. Enter the code below
            </p>
          </div>

          {/* OTP Form */}
          <form onSubmit={handleOnSubmit} className="flex flex-col gap-6">
            <OTPInput
              value={otp}
              onChange={setOtp}
              numInputs={6}
              renderInput={(props) => (
                <input
                  {...props}
                  placeholder="-"
                  style={{
                    boxShadow: "inset 0px -1px 0px rgba(255, 255, 255, 0.18)",
                  }}
                  className="w-[48px] lg:w-[60px] border-0 bg-richblack-800 rounded-[0.5rem] text-richblack-5 aspect-square text-center focus:border-0 focus:outline-2 focus:outline-yellow-50"
                />
              )}
              containerStyle={{
                justifyContent: "space-between",
                gap: "0 6px",
              }}
            />

            <button
              type="submit"
              className="w-full bg-yellow-50 py-[12px] px-[24px] rounded-[8px] font-medium text-richblack-900 hover:bg-yellow-100 hover:scale-95 transition-all duration-200"
            >
              Verify Email
            </button>
          </form>

          {/* Back to login + Resend OTP */}
          <div className="flex items-center justify-between">
            <Link to="/login">
              <div className="flex items-center gap-2 text-richblack-5 hover:text-richblue-100 transition-colors duration-200">
                <BiArrowBack className="text-lg" />
                <p className="text-base font-medium">Back to login</p>
              </div>
            </Link>
            <button
              className="flex items-center gap-2 text-blue-100 hover:text-blue-200 transition-colors duration-200"
              onClick={() => dispatch(sendOtp(signupData.email, navigate))}
            >
              <RxCountdownTimer className="text-lg" />
              Resend it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerifyEmail;
