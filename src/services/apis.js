// ============================================================
// API endpoint definitions — all URLs are built from the single
// REACT_APP_BASE_URL env variable so they automatically change
// when you switch environments.
// ============================================================

const BASE_URL = process.env.REACT_APP_BASE_URL;

// ---------- AUTH ENDPOINTS ----------
export const endpoints = {
  SENDOTP_API: BASE_URL + "/auth/sendotp",
  SIGNUP_API: BASE_URL + "/auth/signup",
  LOGIN_API: BASE_URL + "/auth/login",
  LOGOUT_API: BASE_URL + "/auth/logout",
  RESETPASSTOKEN_API: BASE_URL + "/auth/reset-password-token",
  RESETPASSWORD_API: BASE_URL + "/auth/reset-password",
};

// ---------- PROFILE ENDPOINTS ----------
export const profileEndpoints = {
  GET_USER_DETAILS_API: BASE_URL + "/profile/getUserDetails",
  GET_USER_ENROLLED_COURSES_API: BASE_URL + "/profile/getEnrolledCourses",
  GET_INSTRUCTOR_DATA_API: BASE_URL + "/profile/instructorDashboard",
};

// ---------- STUDENT / PAYMENT ENDPOINTS ----------
export const studentEndpoints = {
  COURSE_PAYMENT_API: BASE_URL + "/payment/capturePayment",
  COURSE_VERIFY_API: BASE_URL + "/payment/verifyPayment",
  MARK_PAYMENT_FAILED_API: BASE_URL + "/payment/markPaymentFailed",
  ENROLL_FREE_COURSE_API: BASE_URL + "/payment/enrollFreeCourse",
  SEND_PAYMENT_SUCCESS_EMAIL_API:
    BASE_URL + "/payment/sendPaymentSuccessEmail",
  GET_ORDER_HISTORY_API: BASE_URL + "/payment/orders",
  GET_ORDER_DETAILS_API: BASE_URL + "/payment/orders",
};

// ---------- PERSISTENT SHOPPING CART ENDPOINTS ----------
export const cartEndpoints = {
  GET_CART_API: BASE_URL + "/cart",
  ADD_TO_CART_API: BASE_URL + "/cart/add",
  REMOVE_FROM_CART_API: BASE_URL + "/cart/remove",
  SYNC_CART_API: BASE_URL + "/cart/sync",
};

// ---------- COURSE ENDPOINTS ----------
export const courseEndpoints = {
  GET_ALL_COURSE_API: BASE_URL + "/course/getAllCourses",
  SEARCH_COURSES_API: BASE_URL + "/course/search",
  COURSE_DETAILS_API: BASE_URL + "/course/getCourseDetails",
  EDIT_COURSE_API: BASE_URL + "/course/editCourse",
  COURSE_CATEGORIES_API: BASE_URL + "/course/showAllCategories",
  CREATE_COURSE_API: BASE_URL + "/course/createCourse",
  CREATE_SECTION_API: BASE_URL + "/course/addSection",
  CREATE_SUBSECTION_API: BASE_URL + "/course/addSubSection",
  UPDATE_SECTION_API: BASE_URL + "/course/updateSection",
  UPDATE_SUBSECTION_API: BASE_URL + "/course/updateSubSection",
  GET_ALL_INSTRUCTOR_COURSES_API: BASE_URL + "/course/getInstructorCourses",
  GET_COURSE_ENROLLED_STUDENTS_API: BASE_URL + "/course",
  DELETE_SECTION_API: BASE_URL + "/course/deleteSection",
  DELETE_SUBSECTION_API: BASE_URL + "/course/deleteSubSection",
  DELETE_COURSE_API: BASE_URL + "/course/deleteCourse",
  GET_FULL_COURSE_DETAILS_AUTHENTICATED:
    BASE_URL + "/course/getFullCourseDetails",
  LECTURE_COMPLETION_API: BASE_URL + "/course/updateCourseProgress",
  CREATE_RATING_API: BASE_URL + "/course/createRating",
};

// ---------- RATINGS & REVIEWS ----------
export const ratingsEndpoints = {
  REVIEWS_DETAILS_API: BASE_URL + "/course/getReviews",
};

// ---------- CATEGORIES ----------
export const categories = {
  CATEGORIES_API: BASE_URL + "/course/showAllCategories",
};

// ---------- ADMIN DASHBOARD, CATEGORY & USER MANAGEMENT ----------
export const adminEndpoints = {
  ADMIN_DASHBOARD_API: BASE_URL + "/course/adminDashboard",
  CREATE_CATEGORY_API: BASE_URL + "/course/createCategory",
  UPDATE_CATEGORY_API: BASE_URL + "/course/updateCategory",
  DELETE_CATEGORY_API: BASE_URL + "/course/deleteCategory",
  ADMIN_USER_STATS_API: BASE_URL + "/admin/users/stats",
  ADMIN_USERS_LIST_API: BASE_URL + "/admin/users",
  ADMIN_USER_DETAILS_API: BASE_URL + "/admin/users",
  ADMIN_INSTRUCTORS_LIST_API: BASE_URL + "/admin/instructors",
  ADMIN_INSTRUCTOR_ACTION_BASE_API: BASE_URL + "/admin/instructors",
};

// ---------- CATALOG PAGE ----------
export const catalogData = {
  CATALOGPAGEDATA_API: BASE_URL + "/course/getCategoryPageDetails",
};

// ---------- CONTACT US ----------
export const contactusEndpoint = {
  CONTACT_US_API: BASE_URL + "/reach/contact",
};

// ---------- SETTINGS / PROFILE UPDATES ----------
export const settingsEndpoints = {
  UPDATE_DISPLAY_PICTURE_API: BASE_URL + "/profile/updateDisplayPicture",
  UPDATE_PROFILE_API: BASE_URL + "/profile/updateProfile",
  CHANGE_PASSWORD_API: BASE_URL + "/auth/changepassword",
  DELETE_PROFILE_API: BASE_URL + "/profile/deleteProfile",
};