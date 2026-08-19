import React from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

const OpenRoute = ({ children }) => {
    const { token } = useSelector((state) => state.auth);

    if (token === null) {
        // No active session — render the public page (login, signup, etc.)
        return children;
    }

    return <Navigate to="/dashboard/my-profile" />;
};

export default OpenRoute;
