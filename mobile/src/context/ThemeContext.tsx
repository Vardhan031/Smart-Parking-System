import React, { createContext, useContext } from "react";
import { useColorScheme } from "react-native";
import { Colors, DarkColors, type ColorPalette } from "@/constants/theme";

interface ThemeContextType {
  Colors: ColorPalette;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  Colors,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const activeColors = isDark ? DarkColors : Colors;

  return (
    <ThemeContext.Provider value={{ Colors: activeColors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
