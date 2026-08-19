import { toast } from "react-hot-toast";
import { setLoading, setUser } from "../../slices/profileSlice";
import { apiConnector } from "../apiconnector";
import { profileEndpoints } from "../apis";
import { logout } from "./authAPI";

const {
    GET_USER_DETAILS_API,
    GET_USER_ENROLLED_COURSES_API,
    GET_INSTRUCTOR_DATA_API,
} = profileEndpoints;

// ============================================================
// GET USER DETAILS — fetches the authenticated user's profile
// ============================================================
export function getUserDetails(token, navigate) {
    return async (dispatch) => {
        const toastId = toast.loading("Loading...");
        dispatch(setLoading(true));
        try {
            const response = await apiConnector("GET", GET_USER_DETAILS_API, null, {
                Authorization: `Bearer ${token}`,
            });

            if (!response.data.success) {
                throw new Error(response.data.message);
            }

            // Generate a DiceBear avatar if the user has no profile picture
            const userData = response.data.data;
            const userImage = userData.image
                ? userData.image
                : `https://api.dicebear.com/6.x/initials/svg?seed=${userData.firstName} ${userData.lastName}`;

            dispatch(setUser({ ...userData, image: userImage }));
        } catch (error) {
            // If fetching user details fails (e.g. expired token), log the user out
            dispatch(logout(navigate));
            console.error("getUserDetails error:", error);
            toast.error("Could not get user details");
        } finally {
            toast.dismiss(toastId);
            dispatch(setLoading(false));
        }
    };
}

// ============================================================
// GET USER ENROLLED COURSES — returns all courses a student is in
// ============================================================
export async function getUserEnrolledCourses(token) {
    let result = [];
    try {
        const response = await apiConnector(
            "GET",
            GET_USER_ENROLLED_COURSES_API,
            null,
            { Authorization: `Bearer ${token}` }
        );

        if (!response.data.success) {
            throw new Error(response.data.message);
        }

        result = response.data.data;
    } catch (error) {
        console.error("getUserEnrolledCourses error:", error);
        toast.error("Could not get enrolled courses");
    }
    return result;
}

// ============================================================
// GET INSTRUCTOR DATA — fetches stats for the instructor dashboard
// ============================================================


export async function getInstructorData(token) {
    let result = [];
    try{
        const response = await apiConnector("GET", GET_INSTRUCTOR_DATA_API, null, {
            Authorization: `Bearer ${token}`
        })
        console.log("GET_INSTRUCTOR_API_RESPONSE", response);
        result = response?.data?.courses;
    }
    catch(error){
        console.log("GET_INSTRUCTOR_API ERROR", error);
    }
    return result;
}