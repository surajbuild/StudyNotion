import React from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { ACCOUNT_TYPE } from "../../../utils/constants";

const AdminRoute = ({ children }) => {
  const { token } = useSelector((state) => state.auth);
  const { user } = useSelector((state) => state.profile);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.accountType !== ACCOUNT_TYPE.ADMIN) {
    return <Navigate to="/dashboard/my-profile" replace />;
  }

  return children;
};

export default AdminRoute;
