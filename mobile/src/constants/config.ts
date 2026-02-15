import { Platform } from "react-native";

// Override this in local dev with:
// EXPO_PUBLIC_API_BASE_URL=http://<host>:5000/api
const DEFAULT_WEB_API_BASE_URL = "http://localhost:5000/api";
const DEFAULT_NATIVE_API_BASE_URL = "http://192.168.1.18:5000/api";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === "web"
    ? DEFAULT_WEB_API_BASE_URL
    : DEFAULT_NATIVE_API_BASE_URL);

export const SLOT_STATUS = {
  AVAILABLE: "AVAILABLE",
  OCCUPIED: "OCCUPIED",
  MAINTENANCE: "MAINTENANCE",
} as const;

export const SESSION_STATUS = {
  IN: "IN",
  OUT: "OUT",
} as const;

export const VEHICLE_TYPES = ["CAR", "BIKE"] as const;

export type SlotStatus = (typeof SLOT_STATUS)[keyof typeof SLOT_STATUS];
export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];
export type VehicleType = (typeof VEHICLE_TYPES)[number];
