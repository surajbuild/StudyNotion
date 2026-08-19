import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_BASE_URL,
});

// Ensure cookies (httpOnly token cookie from server) are sent with requests.
// This is required because the backend authenticates using a cookie named `token`.
axiosInstance.defaults.withCredentials = true;

// Attach Authorization header automatically when a token exists in localStorage.
// This keeps the client code simpler (no need to manually pass headers everywhere).
axiosInstance.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (err) {
      // If localStorage is unavailable for any reason, skip attaching the header.
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Warn when baseURL is not configured to help debugging in dev
if (!process.env.REACT_APP_BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('REACT_APP_BASE_URL is not set. API calls may fail. See .env.example');
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
