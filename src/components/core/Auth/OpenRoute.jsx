import React from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { ACCOUNT_TYPE } from "../../../utils/constants";

const OpenRoute = ({ children }) => {
    const { token } = useSelector((state) => state.auth);
    const user = useSelector((state) => state.profile?.user);

    if (token === null) {
        // No active session — render the public page (login, signup, etc.)
        return children;
    }

    const destination =
        user?.accountType === ACCOUNT_TYPE.ADMIN
            ? "/dashboard/admin"
            : "/dashboard/my-profile";

    return <Navigate to={destination} />;
};

export default OpenRoute;
