import { Platform, ViewStyle } from "react-native";

export const Colors = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#DBEAFE",
  primaryGhost: "#EFF6FF",
  secondary: "#64748B",
  success: "#16A34A",
  successLight: "#DCFCE7",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  danger: "#DC2626",
  dangerLight: "#FEE2E2",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceHover: "#F1F5F9",
  text: "#0F172A",
  textSecondary: "#64748B",
  textTertiary: "#94A3B8",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  disabled: "#CBD5E1",
  overlay: "rgba(15, 23, 42, 0.4)",
};

export const DarkColors = {
  primary: "#3B82F6",
  primaryDark: "#2563EB",
  primaryLight: "#1D4ED8",
  primaryGhost: "#1E3A5F",
  secondary: "#94A3B8",
  success: "#22C55E",
  successLight: "#14532D",
  warning: "#F59E0B",
  warningLight: "#451A03",
  danger: "#EF4444",
  dangerLight: "#450A0A",
  background: "#0F172A",
  surface: "#1E293B",
  surfaceHover: "#334155",
  text: "#F8FAFC",
  textSecondary: "#94A3B8",
  textTertiary: "#64748B",
  border: "#334155",
  borderLight: "#1E293B",
  disabled: "#475569",
  overlay: "rgba(0, 0, 0, 0.6)",
};

export type ColorPalette = typeof Colors;

export const FontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extraBold: "Inter_800ExtraBold",
};

export const Spacing = {
  xs: 4,
  sm: 8,
  smPlus: 12,
  md: 16,
  mdPlus: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 30,
  hero: 40,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

const shadowBase = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  android: {
    elevation: 2,
  },
  default: {},
}) as ViewStyle;

const shadowMd = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
  },
  android: {
    elevation: 5,
  },
  default: {},
}) as ViewStyle;

const shadowLg = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
  },
  android: {
    elevation: 12,
  },
  default: {},
}) as ViewStyle;

export const Shadows = {
  sm: shadowBase,
  md: shadowMd,
  lg: shadowLg,
};
