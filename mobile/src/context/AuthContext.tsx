import React, { createContext, useContext, useEffect, useState } from "react";
import { authService, LoginPayload, RegisterPayload } from "@/services/auth";
import { router } from "expo-router";
import { authStorage } from "@/services/authStorage";

interface User {
  id: string;
  name: string;
  email: string;
  vehiclePlates: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore token on app start
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await authStorage.getItem("authToken");
        const storedUser = await authStorage.getItem("user");
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // Token invalid or missing — stay logged out
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (data: LoginPayload) => {
    const email = data.email.trim().toLowerCase();
    console.log("[AuthContext] login start", { email });
    try {
      const res = await authService.login(data);
      const { token: newToken, user: newUser } = res.data;
      await authStorage.setItem("authToken", newToken);
      await authStorage.setItem("user", JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      console.log("[AuthContext] login complete", {
        email: newUser?.email,
        userId: newUser?.id,
      });
      router.replace("/(tabs)");
    } catch (error: any) {
      console.warn("[AuthContext] login error", {
        email,
        status: error?.response?.status,
        message: error?.response?.data?.message || error?.message,
      });
      throw error;
    }
  };

  const register = async (data: RegisterPayload) => {
    const email = data.email.trim().toLowerCase();
    console.log("[AuthContext] register start", { email });
    try {
      const res = await authService.register(data);
      const { token: newToken, user: newUser } = res.data;
      await authStorage.setItem("authToken", newToken);
      await authStorage.setItem("user", JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      console.log("[AuthContext] register complete", {
        email: newUser?.email,
        userId: newUser?.id,
      });
      router.replace("/(auth)/link-vehicle");
    } catch (error: any) {
      console.warn("[AuthContext] register error", {
        email,
        status: error?.response?.status,
        message: error?.response?.data?.message || error?.message,
      });
      throw error;
    }
  };

  const logout = async () => {
    console.log("[AuthContext] logout start");
    await authStorage.removeItem("authToken");
    await authStorage.removeItem("user");
    setToken(null);
    setUser(null);
    console.log("[AuthContext] logout complete");
    router.replace("/(auth)/login");
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
