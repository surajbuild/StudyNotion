import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  APPROVAL_STATUS,
  getInstructorApprovalStatus,
} from "../../../../utils/constants";
import { refreshCurrentUser } from "../../../../services/operations/profileAPI";

const InstructorApprovalNotice = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.profile);
  const { token } = useSelector((state) => state.auth);
  const [refreshing, setRefreshing] = useState(false);

  const status = getInstructorApprovalStatus(user);
  const isRejected = status === APPROVAL_STATUS.REJECTED;

  const handleRefreshStatus = async () => {
    if (!token || refreshing) return;
    setRefreshing(true);
    try {
      const updated = await refreshCurrentUser(token, dispatch);
      const updatedStatus = getInstructorApprovalStatus(updated);
      if (updatedStatus === APPROVAL_STATUS.APPROVED) {
        toast.success("Your instructor account has been approved!");
      } else if (updatedStatus === APPROVAL_STATUS.REJECTED) {
        toast.error("Your instructor application status is Rejected.");
      } else {
        toast("Your application is still pending administrator review.");
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 text-richblack-5 sm:px-6"
      data-testid="instructor-approval-notice"
    >
      <div
        role="status"
        className={`rounded-xl border p-6 sm:p-8 ${
          isRejected
            ? "border-pink-700/50 bg-richblack-800"
            : "border-yellow-50/40 bg-richblack-800"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-richblack-5 sm:text-3xl">
            {isRejected
              ? "Instructor Application Not Approved"
              : "Instructor Account Pending Approval"}
          </h1>
          <span
            data-testid="instructor-approval-badge"
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              isRejected
                ? "border border-pink-400/40 bg-pink-900/40 text-pink-200"
                : "border border-yellow-50/40 bg-yellow-900/40 text-yellow-50"
            }`}
          >
            {isRejected ? "Rejected" : "Pending Approval"}
          </span>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-richblack-200 sm:text-base">
          {isRejected ? (
            <>
              Hi <span className="font-semibold text-richblack-5">{user?.firstName}</span>,
              after reviewing your instructor application, our administration team was unable
              to approve your account at this time. Course creation, publishing, and instructor
              analytics remain restricted.
            </>
          ) : (
            <>
              Hi <span className="font-semibold text-richblack-5">{user?.firstName}</span>,
              thank you for applying to teach on StudyNotion. Your instructor account is
              currently <strong className="text-yellow-50">awaiting administrator approval</strong>.
              Course creation, publishing, and instructor analytics will unlock automatically
              once an administrator approves your application.
            </>
          )}
        </p>

        {isRejected && user?.rejectionReason && (
          <div className="mt-4 rounded-lg border border-pink-700/40 bg-richblack-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-pink-200">
              Administrator Note
            </p>
            <p className="mt-1 text-sm text-richblack-100">{user.rejectionReason}</p>
          </div>
        )}

        <div className="mt-6 rounded-lg border border-richblack-700 bg-richblack-900/80 p-4 text-xs text-richblack-300 sm:text-sm">
          <p className="font-medium text-richblack-100">What you can do right now:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Update your personal details and profile avatar in Account Settings.</li>
            <li>Browse the public course catalog while your account status is under review.</li>
            {isRejected ? (
              <li>
                Contact our support team if you believe this decision was made in error or
                would like your application reconsidered.
              </li>
            ) : (
              <li>
                Click <span className="font-medium text-richblack-100">Refresh Status</span>{" "}
                below or reload the page once you receive your approval email.
              </li>
            )}
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRefreshStatus}
            disabled={refreshing}
            className="rounded-lg bg-yellow-50 px-5 py-2.5 text-sm font-semibold text-richblack-900 transition-colors hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Checking Status..." : "Refresh Status"}
          </button>

          <Link
            to="/dashboard/my-profile"
            className="rounded-lg border border-richblack-600 bg-richblack-900 px-4 py-2.5 text-sm font-medium text-richblack-100 transition-colors hover:bg-richblack-700"
          >
            View My Profile
          </Link>

          <Link
            to="/dashboard/settings"
            className="rounded-lg border border-richblack-600 bg-richblack-900 px-4 py-2.5 text-sm font-medium text-richblack-100 transition-colors hover:bg-richblack-700"
          >
            Account Settings
          </Link>

          {isRejected && (
            <Link
              to="/contact"
              className="rounded-lg border border-pink-600/50 bg-pink-900/30 px-4 py-2.5 text-sm font-medium text-pink-100 transition-colors hover:bg-pink-900/50"
            >
              Contact Support
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstructorApprovalNotice;
