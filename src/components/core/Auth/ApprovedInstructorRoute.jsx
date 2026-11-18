import React from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { ACCOUNT_TYPE, isInstructorApproved } from "../../../utils/constants";

/**
 * Guards restricted instructor course-management routes (/dashboard/my-courses,
 * /dashboard/add-course, /dashboard/edit-course/:courseId).
 *
 * - Unauthenticated -> /login
 * - Non-instructor -> /dashboard/my-profile
 * - Pending or Rejected instructor -> /dashboard/instructor (renders approval status view)
 * - Approved instructor -> children
 *
 * Note: Backend middleware (`isApprovedInstructor`) enforces the authoritative DB check
 * on every restricted API request regardless of client state.
 */
const ApprovedInstructorRoute = ({ children }) => {
  const { token } = useSelector((state) => state.auth);
  const { user } = useSelector((state) => state.profile);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.accountType !== ACCOUNT_TYPE.INSTRUCTOR) {
    return <Navigate to="/dashboard/my-profile" replace />;
  }

  if (!isInstructorApproved(user)) {
    return <Navigate to="/dashboard/instructor" replace />;
  }

  return children;
};

export default ApprovedInstructorRoute;
