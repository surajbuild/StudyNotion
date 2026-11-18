import { toast } from "react-hot-toast";
import { setUser } from "../../slices/profileSlice";
import { apiConnector } from "../apiconnector";
import { settingsEndpoints } from "../apis";
import { logout } from "./authAPI";

const {
    UPDATE_DISPLAY_PICTURE_API,
    UPDATE_PROFILE_API,
    CHANGE_PASSWORD_API,
    DELETE_PROFILE_API,
} = settingsEndpoints;

// ============================================================
// UPDATE DISPLAY PICTURE — uploads a new avatar to the backend
// ============================================================
export function updateDisplayPicture(token, formData) {
    return async (dispatch) => {
        const toastId = toast.loading("Uploading picture...");
        try {
            const response = await apiConnector(
                "PUT",
                UPDATE_DISPLAY_PICTURE_API,
                formData,
                {
                    // multipart/form-data is required for file uploads
                    "Content-Type": "multipart/form-data",
                    Authorization: `Bearer ${token}`,
                }
            );

            // ✅ REMOVED: multiple debug console.log statements that printed
            // the full response, success flag, user object, and image URL.
            // These are unnecessary noise in a production build.

            if (!response.data.success) {
                throw new Error(response.data.message);
            }

            // Merge the new image URL into the existing user object
            const updatedUserData = {
                ...response.data.user,
                image: response.data.image,
            };

            dispatch(setUser(updatedUserData));
            localStorage.setItem("user", JSON.stringify(updatedUserData));
            toast.success("Profile picture updated successfully", { id: toastId });
        } catch (error) {
            console.error("updateDisplayPicture error:", error);
            toast.error("Could not update profile picture", { id: toastId });
        }
    };
}

// ============================================================
// UPDATE PROFILE — saves name and additional-details changes
// ============================================================
export function updateProfile(token, formData) {
    return async (dispatch) => {
        const toastId = toast.loading("Saving changes...");
        try {
            const response = await apiConnector("PUT", UPDATE_PROFILE_API, formData, {
                Authorization: `Bearer ${token}`,
            });


            if (!response.data.success) {
                throw new Error(response.data.message);
            }

            // The backend returns the fully-populated user in `updatedUserDetails`
            const updatedUser = response.data.updatedUserDetails;

            // Generate a DiceBear avatar as fallback if the user has no image set
            const userImage = updatedUser?.image
                ? updatedUser.image
                : `https://api.dicebear.com/6.x/initials/svg?seed=${updatedUser?.firstName || "User"} ${updatedUser?.lastName || ""}`;

            const hydratedUser = { ...updatedUser, image: userImage };
            dispatch(setUser(hydratedUser));
            localStorage.setItem("user", JSON.stringify(hydratedUser));
            toast.success("Profile updated successfully", { id: toastId });
        } catch (error) {
            console.error("updateProfile error:", error);
            toast.error("Could not update profile", { id: toastId });
        }
    };
}

// ============================================================
// CHANGE PASSWORD — sends old + new passwords to the backend
// ============================================================
export async function changePassword(token, formData) {
    const toastId = toast.loading("Updating password...");
    try {
        const response = await apiConnector("POST", CHANGE_PASSWORD_API, formData, {
            Authorization: `Bearer ${token}`,
        });

        if (!response.data.success) {
            throw new Error(response.data.message);
        }

        toast.success("Password changed successfully", { id: toastId });
        return true;
    } catch (error) {
        console.error("changePassword error:", error);

        const message =
            error?.response?.data?.message ||
            error?.message ||
            "Could not change password";

        toast.error(message, { id: toastId });
        return false;
    }
}

// ============================================================
// DELETE PROFILE — permanently deletes the user's account
// ============================================================
export function deleteProfile(token, navigate) {
    return async (dispatch) => {
        const toastId = toast.loading("Deleting account...");
        try {
            const response = await apiConnector("DELETE", DELETE_PROFILE_API, null, {
                Authorization: `Bearer ${token}`,
            });

            if (!response.data.success) {
                throw new Error(response.data.message);
            }

            toast.success("Account deleted successfully", { id: toastId });
            // Log the user out and clear all local state after deletion
            dispatch(logout(navigate));
        } catch (error) {
            console.error("deleteProfile error:", error);
            toast.error("Could not delete account", { id: toastId });
        }
    };
}
