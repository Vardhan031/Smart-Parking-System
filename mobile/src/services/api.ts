import axios from "axios";
import { API_BASE_URL } from "@/constants/config";
import { authStorage } from "@/services/authStorage";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

console.log("[api] initialized", { baseURL: API_BASE_URL });

const isAuthRequest = (url?: string) => (url || "").includes("/auth/");

// Attach JWT token from SecureStore to every request
api.interceptors.request.use(async (config) => {
  const token = await authStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (isAuthRequest(config.url)) {
    console.log("[api] auth request", {
      method: config.method?.toUpperCase(),
      url: `${config.baseURL || ""}${config.url || ""}`,
      hasToken: !!token,
    });
  }
  return config;
});

// Unwrap { success, data } envelope so callers get res.data = actual payload
api.interceptors.response.use(
  (response) => {
    if (isAuthRequest(response.config?.url)) {
      console.log("[api] auth response", {
        method: response.config?.method?.toUpperCase(),
        url: `${response.config?.baseURL || ""}${response.config?.url || ""}`,
        status: response.status,
      });
    }
    if (response.data?.success && "data" in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    if (isAuthRequest(error?.config?.url)) {
      console.warn("[api] auth error response", {
        method: error?.config?.method?.toUpperCase(),
        url: `${error?.config?.baseURL || ""}${error?.config?.url || ""}`,
        status: error?.response?.status,
        message: error?.response?.data?.message || error?.message,
      });
    }
    if (error.response?.status === 401) {
      await authStorage.removeItem("authToken");
      // Navigation to login is handled by AuthContext
    }
    return Promise.reject(error);
  }
);

export default api;
