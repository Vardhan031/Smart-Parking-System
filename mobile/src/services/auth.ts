import api from "./api";
import { API_BASE_URL } from "@/constants/config";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    vehiclePlates: string[];
  };
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getErrorDetails = (error: any) => ({
  status: error?.response?.status,
  message: error?.response?.data?.message || error?.message || "Unknown error",
});

export const authService = {
  login: async (data: LoginPayload) => {
    const normalizedEmail = normalizeEmail(data.email);
    console.log("[mobile-auth] login request", {
      endpoint: `${API_BASE_URL}/user/auth/login`,
      email: normalizedEmail,
      passwordLength: data.password?.length ?? 0,
    });

    try {
      const response = await api.post<AuthResponse>("/user/auth/login", {
        ...data,
        email: normalizedEmail,
      });

      console.log("[mobile-auth] login success", {
        email: normalizedEmail,
        userId: response.data?.user?.id,
      });

      return response;
    } catch (error: any) {
      console.warn("[mobile-auth] login failure", {
        email: normalizedEmail,
        ...getErrorDetails(error),
      });
      throw error;
    }
  },

  register: async (data: RegisterPayload) => {
    const normalizedEmail = normalizeEmail(data.email);
    console.log("[mobile-auth] register request", {
      endpoint: `${API_BASE_URL}/user/auth/register`,
      email: normalizedEmail,
      hasPhone: !!data.phone,
      passwordLength: data.password?.length ?? 0,
    });

    try {
      const response = await api.post<AuthResponse>("/user/auth/register", {
        ...data,
        email: normalizedEmail,
      });

      console.log("[mobile-auth] register success", {
        email: normalizedEmail,
        userId: response.data?.user?.id,
      });

      return response;
    } catch (error: any) {
      console.warn("[mobile-auth] register failure", {
        email: normalizedEmail,
        ...getErrorDetails(error),
      });
      throw error;
    }
  },
};
