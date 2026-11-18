import { toast } from "react-hot-toast";

import { apiConnector } from "../apiconnector";
import { courseEndpoints } from "../apis";

const {
    COURSE_DETAILS_API,
    COURSE_CATEGORIES_API,
    GET_ALL_COURSE_API,
    SEARCH_COURSES_API,
    CREATE_COURSE_API,
    EDIT_COURSE_API,
    CREATE_SECTION_API,
    CREATE_SUBSECTION_API,
    UPDATE_SECTION_API,
    UPDATE_SUBSECTION_API,
    DELETE_SECTION_API,
    DELETE_SUBSECTION_API,
    GET_ALL_INSTRUCTOR_COURSES_API,
    DELETE_COURSE_API,
    GET_FULL_COURSE_DETAILS_AUTHENTICATED,
    CREATE_RATING_API,
    LECTURE_COMPLETION_API,
} = courseEndpoints;



export const getAllCourses = async () => {
    const toastId = toast.loading("Loading...");
    let result = [];
    try {
        const response = await apiConnector("GET", GET_ALL_COURSE_API);
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not fetch courses");
        }
        result = response?.data?.data;
    } catch (error) {
        console.error("getAllCourses error:", error);
        toast.error(error?.message);
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const searchCourses = async (params = {}) => {
    const cleanParams = {};
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            cleanParams[key] = String(value).trim();
        }
    });

    try {
        const response = await apiConnector("GET", SEARCH_COURSES_API, null, null, cleanParams);
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not search courses");
        }
        return response.data.data;
    } catch (error) {
        const message =
            error?.response?.data?.message ||
            error?.message ||
            "Unable to load courses. Please try again.";
        throw new Error(message);
    }
};

export const fetchCourseDetails = async (courseId) => {
    const toastId = toast.loading("Loading...");
    let result = null;
    try {
        const response = await apiConnector("POST", COURSE_DETAILS_API, { courseId });
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not fetch course details");
        }
        result = response?.data?.data;
    } catch (error) {
        console.error("fetchCourseDetails error:", error);
        toast.error(error?.response?.data?.message || error.message);
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const fetchCourseCategories = async () => {
    let result = [];
    try {
        const response = await apiConnector("GET", COURSE_CATEGORIES_API);
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not fetch categories");
        }
        result = response?.data?.data;
    } catch (error) {
        console.error("fetchCourseCategories error:", error);
        toast.error(error?.message);
    }
    return result;
};

export const addCourseDetails = async (data, token) => {
    let result = null;
    const toastId = toast.loading("Loading...");
    try {
        const response = await apiConnector("POST", CREATE_COURSE_API, data, {
            Authorization: `Bearer ${token}`,
        });
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not add course details");
        }
        toast.success("Course details added successfully");
        result = response?.data?.data;
    } catch (error) {
        console.error("addCourseDetails error:", error);
        toast.error(error?.message);
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const editCourseDetails = async (data, token) => {
    let result = null;
    const toastId = toast.loading("Loading...");
    try {
        const response = await apiConnector("POST", EDIT_COURSE_API, data, {
            Authorization: `Bearer ${token}`,
        });
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not update course details");
        }
        toast.success("Course details updated successfully");
        result = response?.data?.data;
    } catch (error) {
        console.error("editCourseDetails error:", error);
        toast.error(error?.message);
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const createSection = async (data, token) => {
    let result = null;
    const toastId = toast.loading("Loading...");
    try {
        const response = await apiConnector("POST", CREATE_SECTION_API, data, {
            Authorization: `Bearer ${token}`,
        });
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not create section");
        }
        toast.success("Section created");
        result = response?.data?.updatedCourseDetails;
    } catch (error) {
        console.error("createSection error:", error);
        toast.error(error?.message);
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const createSubSection = async (data, token) => {
    let result = null;
    const toastId = toast.loading("Loading...");
    try {
        const response = await apiConnector("POST", CREATE_SUBSECTION_API, data, {
            Authorization: `Bearer ${token}`,
        });
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not add lecture");
        }
        toast.success("Lecture added");
        result = response?.data?.data;
    } catch (error) {
        console.error("createSubSection error:", error);
        toast.error(error?.message);
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const updateSection = async (data, token) => {
    let result = null;
    const toastId = toast.loading("Loading...");
    try {
        const response = await apiConnector("POST", UPDATE_SECTION_API, data, {
            Authorization: `Bearer ${token}`,
        });
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not update section");
        }
        toast.success("Section updated");
        result = response?.data?.data;
    } catch (error) {
        console.error("updateSection error:", error);
        toast.error(error?.message);
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const updateSubSection = async (data, token) => {
    let result = null;
    const toastId = toast.loading("Loading...");
    try {
        const response = await apiConnector("POST", UPDATE_SUBSECTION_API, data, {
            Authorization: `Bearer ${token}`,
        });
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not update lecture");
        }
        toast.success("Lecture updated");
        result = response?.data?.data;
    } catch (error) {
        console.error("updateSubSection error:", error);
        toast.error(error?.message);
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const deleteSection = async (data, token) => {
    let result = null;
    const toastId = toast.loading("Loading...");
    try {
        const response = await apiConnector("POST", DELETE_SECTION_API, data, {
            Authorization: `Bearer ${token}`,
        });
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not delete section");
        }
        toast.success("Section deleted");
        result = response?.data?.data;
    } catch (error) {
        console.error("deleteSection error:", error);
        toast.error(error?.message);
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const deleteSubSection = async (data, token) => {
    let result = null;
    const toastId = toast.loading("Loading...");
    try {
        const response = await apiConnector("POST", DELETE_SUBSECTION_API, data, {
            Authorization: `Bearer ${token}`,
        });
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not delete lecture");
        }
        toast.success("Lecture deleted");
        result = response?.data?.data;
    } catch (error) {
        console.error("deleteSubSection error:", error);
        toast.error(error?.message);
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const fetchInstructorCourses = async (token) => {
    let result = [];
    try {
        const response = await apiConnector(
            "GET",
            GET_ALL_INSTRUCTOR_COURSES_API,
            null,
            { Authorization: `Bearer ${token}` }
        );
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not fetch instructor courses");
        }
        result = response?.data?.data;
    } catch (error) {
        console.error("fetchInstructorCourses error:", error);
        // ✅ FIX: Removed toast.loading + toast.error here.
        // This is a background data-fetch; Instructor.jsx shows its own spinner.
        // Showing a toast here caused 4-6 simultaneous toasts on dashboard refresh.
    }
    return result;
};

export const deleteCourse = async (data, token) => {
    let result = false;
    const toastId = toast.loading("Loading...");
    try {
        const response = await apiConnector("DELETE", DELETE_COURSE_API, data, {
            Authorization: `Bearer ${token}`,
        });
        if (!response?.data?.success) {
            throw new Error("Could not delete course");
        }
        toast.success("Course deleted");
        result = true;
    } catch (error) {
        console.error("deleteCourse error:", error);
        toast.error(error.message);
        result = false;
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const getFullDetailsOfCourse = async (courseId, token) => {
    const toastId = toast.loading("Loading...");
    let result = null;
    try {
        const response = await apiConnector(
            "POST",
            GET_FULL_COURSE_DETAILS_AUTHENTICATED,
            { courseId },
            { Authorization: `Bearer ${token}` }
        );
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not fetch full course details");
        }
        result = response?.data?.data;
    } catch (error) {
        console.error("getFullDetailsOfCourse error:", error);
        toast.error(error?.response?.data?.message || error.message);
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const markLectureAsComplete = async (data, token) => {
    let result = null;
    // Debug: log which lecture is being marked complete (useful during development)
    console.log("[markLectureAsComplete] payload:", data);
    const toastId = toast.loading("Loading...");
    try {
        const response = await apiConnector("POST", LECTURE_COMPLETION_API, data, {
            Authorization: `Bearer ${token}`,
        });
        // Debug: confirm server acknowledged the completion
        console.log("[markLectureAsComplete] response:", response?.data);

        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not mark lecture as complete");
        }
        toast.success("Lecture completed");
        result = true;
    } catch (error) {
        console.error("MARK_LECTURE_AS_COMPLETE_API ERROR :", error);
        toast.error(error.message);
        result = false;
    } finally {
        toast.dismiss(toastId);
    }
    return result;
};

export const createRating = async (data, token) => {
    const toastId = toast.loading("Loading...");
    let success = false;
    try {
        const response = await apiConnector("POST", CREATE_RATING_API, data, {
            Authorization: `Bearer ${token}`,
        });
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Could not create rating");
        }

        toast.success("Rating submitted");
        success = true;
    } catch (error) {
        console.error("createRating error:", error);
        toast.error(error?.response?.data?.message || error.message || "Could not submit review");
        success = false;
    } finally {
        toast.dismiss(toastId);
    }
    return success;
};
