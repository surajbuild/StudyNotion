import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai"
import { useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import { changePassword } from "../../../../services/operations/SettingsAPI"
import IconBtn from "../../../common/IconBtn"

export default function UpdatePassword() {
    const { token } = useSelector((state) => state.auth)
    const navigate = useNavigate()

    const [showOldPassword, setShowOldPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)

    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm()

    // Watch newPassword so we can compare it to confirmNewPassword
    const newPasswordValue = watch("newPassword", "")

    const submitPasswordForm = async (data) => {
        try {
            await changePassword(token, data)
            // ✅ FIX: After a successful password change the form just sat there
            // with no feedback beyond the toast inside `changePassword`.
            // Now we reset the form fields and navigate back to the profile page
            // so the user knows the action is complete.
            reset()
            navigate("/dashboard/my-profile")
        } catch (error) {
            // changePassword already shows a toast — just log for debugging
            console.error("UpdatePassword error:", error.message)
        }
    }

    return (
        <form onSubmit={handleSubmit(submitPasswordForm)}>
            <div className="my-10 flex flex-col gap-y-6 rounded-md border border-richblack-700 bg-richblack-800 p-5 sm:p-8 px-5 sm:px-12">
                <h2 className="text-lg font-semibold text-richblack-5">Password</h2>

                {/* Current + New passwords */}
                <div className="flex flex-col gap-5 lg:flex-row">
                    {/* Current Password */}
                    <div className="relative flex flex-col gap-2 lg:w-[48%]">
                        <label htmlFor="oldPassword" className="text-sm text-richblack-50">
                            Current Password
                        </label>
                        <input
                            type={showOldPassword ? "text" : "password"}
                            id="oldPassword"
                            placeholder="Enter Current Password"
                            className="form-style rounded-md border border-richblack-600 bg-richblack-700 px-5 py-2 pr-10 font-medium text-richblack-50 transition-all hover:bg-richblack-600"
                            {...register("oldPassword", { required: "Current password is required" })}
                        />
                        <span
                            onClick={() => setShowOldPassword((prev) => !prev)}
                            className="absolute right-3 top-[38px] z-10 cursor-pointer"
                        >
                            {showOldPassword ? <AiOutlineEyeInvisible fontSize={24} fill="#AFB2BF" /> : <AiOutlineEye fontSize={24} fill="#AFB2BF" />}
                        </span>
                        {errors.oldPassword && (
                            <span className="-mt-1 text-xs text-yellow-100">
                                {errors.oldPassword.message}
                            </span>
                        )}
                    </div>

                    {/* New Password */}
                    <div className="relative flex flex-col gap-2 lg:w-[48%]">
                        <label htmlFor="newPassword" className="text-sm text-richblack-50">
                            New Password
                        </label>
                        <input
                            type={showNewPassword ? "text" : "password"}
                            id="newPassword"
                            placeholder="Enter New Password"
                            className="form-style rounded-md border border-richblack-600 bg-richblack-700 px-5 py-2 pr-10 font-medium text-richblack-50 transition-all hover:bg-richblack-600"
                            {...register("newPassword", {
                                required: "New password is required",
                                minLength: {
                                    value: 8,
                                    message: "Password must be at least 8 characters",
                                },
                            })}
                        />
                        <span
                            onClick={() => setShowNewPassword((prev) => !prev)}
                            className="absolute right-3 top-[38px] z-10 cursor-pointer"
                        >
                            {showNewPassword ? <AiOutlineEyeInvisible fontSize={24} fill="#AFB2BF" /> : <AiOutlineEye fontSize={24} fill="#AFB2BF" />}
                        </span>
                        {errors.newPassword && (
                            <span className="-mt-1 text-xs text-yellow-100">
                                {errors.newPassword.message}
                            </span>
                        )}
                    </div>
                </div>

                {/* Confirm New Password */}
                <div className="flex flex-col gap-5 lg:flex-row">
                    <div className="relative flex flex-col gap-2 lg:w-[48%]">
                        <label htmlFor="confirmNewPassword" className="text-sm text-richblack-50">
                            Confirm New Password
                        </label>
                        <input
                            type={showConfirmNewPassword ? "text" : "password"}
                            id="confirmNewPassword"
                            placeholder="Confirm New Password"
                            className="form-style rounded-md border border-richblack-600 bg-richblack-700 px-5 py-2 pr-10 font-medium text-richblack-50 transition-all hover:bg-richblack-600"
                            {...register("confirmNewPassword", {
                                required: "Please confirm your new password",
                                // ✅ FIX: Added client-side password-match validation.
                                // Previously both fields were registered but never compared.
                                // The server would catch the mismatch, but the user got no
                                // immediate feedback — the error only appeared after a full
                                // network round-trip (and a less friendly error message).
                                // `watch("newPassword")` returns the live value of the new
                                // password field so we can compare before submission.
                                validate: (value) =>
                                    value === newPasswordValue || "Passwords do not match",
                            })}
                        />
                        <span
                            onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                            className="absolute right-3 top-[38px] z-10 cursor-pointer"
                        >
                            {showConfirmNewPassword ? <AiOutlineEyeInvisible fontSize={24} fill="#AFB2BF" /> : <AiOutlineEye fontSize={24} fill="#AFB2BF" />}
                        </span>
                        {errors.confirmNewPassword && (
                            <span className="-mt-1 text-xs text-yellow-100">
                                {errors.confirmNewPassword.message}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={() => navigate("/dashboard/my-profile")}
                    className="cursor-pointer rounded-md bg-richblack-700 px-5 py-2 font-semibold text-richblack-50 hover:bg-richblack-600 transition-all"
                >
                    Cancel
                </button>
                <IconBtn type="submit" text="Update" />
            </div>
        </form>
    )
}
