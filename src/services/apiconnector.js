import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_BASE_URL,
});

// Ensure cookies (httpOnly token cookie from server) are sent with requests.
// This is required because the backend authenticates using a cookie named `token`.
axiosInstance.defaults.withCredentials = true;

// Endpoints where HTTP 401 indicates an expected credential/validation error
// (NOT an expired active session) and must NEVER trigger a forced logout/redirect.
const AUTH_EXCLUDED_PATHS = [
  "/auth/login",
  "/auth/signup",
  "/auth/sendotp",
  "/auth/logout",
  "/auth/changepassword",
  "/auth/reset-password-token",
  "/auth/reset-password",
];

let unauthorizedHandler = null;
let isHandlingSessionExpiry = false;

export const registerUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

export const shouldTriggerSessionExpiry = (error) => {
  const status = error?.response?.status;
  if (status !== 401) return false;

  const requestUrl = (error?.config?.url || "").toLowerCase();
  if (AUTH_EXCLUDED_PATHS.some((path) => requestUrl.includes(path))) {
    return false;
  }

  // Only treat 401 as session expiry if the client actually held an active session token
  try {
    const activeToken = localStorage.getItem("token");
    if (!activeToken) return false;
  } catch {
    return false;
  }

  return true;
};

// Attach Authorization header automatically when a token exists in localStorage.
axiosInstance.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers = config.headers || {};
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    } catch (err) {
      // If localStorage is unavailable for any reason, skip attaching the header.
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle expired/invalid JWT sessions globally on protected API calls.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (shouldTriggerSessionExpiry(error) && !isHandlingSessionExpiry) {
      isHandlingSessionExpiry = true;
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } catch {
        // Ignore storage errors
      }

      if (typeof unauthorizedHandler === "function") {
        unauthorizedHandler();
      }

      // Reset debounce window after concurrent in-flight 401s settle
      setTimeout(() => {
        isHandlingSessionExpiry = false;
      }, 1000);
    }

    return Promise.reject(error);
  }
);

// Warn when baseURL is not configured to help debugging in dev
if (!process.env.REACT_APP_BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn("REACT_APP_BASE_URL is not set. API calls may fail. See .env.example");
}

export const apiConnector = (method, url, bodyData, headers, params) => {
  return axiosInstance({
    method: method,
    url: url,
    data: bodyData ? bodyData : null,
    headers: headers ? headers : null,
    params: params ? params : null,
  });
};
