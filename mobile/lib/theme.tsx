// lib/theme.tsx — design tokens (ported from globals.css) + theme provider.
//
// The web app themes via CSS custom properties. In RN we expose the same token
// names through a context. Components read tokens via useTheme().t.* instead of
// hardcoding hex. The chosen mode ("light" | "dark" | "system") is persisted to
// AsyncStorage under THEME_KEY and resolved against the OS color scheme.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEME_KEY } from "./config";

export interface ThemeTokens {
  bg: string;
  surface: string;
  ink: string;
  ink2: string;
  ink3: string;
  ink4: string;
  line: string;
  line2: string;
  primary: string;
  primary2: string;
  primarySoft: string;
  success: string;
  successSoft: string;
  warn: string;
  warnSoft: string;
  rose: string;
  roseSoft: string;
  teal: string;
  tealSoft: string;
  sky: string;
  skySoft: string;
}

export const LIGHT: ThemeTokens = {
  bg: "#f4f4f7",
  surface: "#ffffff",
  ink: "#0b0f1a",
  ink2: "#3b4356",
  ink3: "#6b7280",
  ink4: "#9aa1ad",
  line: "#e8e9ee",
  line2: "#eef0f4",
  primary: "#5b4ef0",
  primary2: "#4a3ee8",
  primarySoft: "#eeecff",
  success: "#10b981",
  successSoft: "#dcfce7",
  warn: "#f59e0b",
  warnSoft: "#fef3c7",
  rose: "#f43f5e",
  roseSoft: "#ffe4e6",
  teal: "#14b8a6",
  tealSoft: "#ccfbf1",
  sky: "#0ea5e9",
  skySoft: "#e0f2fe",
};

export const DARK: ThemeTokens = {
  bg: "#0f1423",
  surface: "#151b2d",
  ink: "#f7f8fb",
  ink2: "#d8dce7",
  ink3: "#9aa4b8",
  ink4: "#717b92",
  line: "#293149",
  line2: "#20283d",
  primary: "#7a6fff",
  primary2: "#665cf0",
  primarySoft: "rgba(122,111,255,0.16)",
  success: "#34d399",
  successSoft: "rgba(16,185,129,0.16)",
  warn: "#fbbf24",
  warnSoft: "rgba(245,158,11,0.18)",
  rose: "#fb7185",
  roseSoft: "rgba(244,63,94,0.16)",
  teal: "#2dd4bf",
  tealSoft: "rgba(20,184,166,0.16)",
  sky: "#38bdf8",
  skySoft: "rgba(14,165,233,0.16)",
};

// Shared radii / spacing tokens (from --radius 14px, pills 999px).
export const RADIUS = 14;
export const PILL = 999;

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  t: ThemeTokens;
  setMode: (m: ThemeMode) => void;
}

const ThemeCtx = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme(); // "light" | "dark" | null
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    void (async () => {
      try {
        const saved = (await AsyncStorage.getItem(THEME_KEY)) as ThemeMode | null;
        if (saved === "light" || saved === "dark" || saved === "system") {
          setModeState(saved);
        }
      } catch {
        // keep default
      }
    })();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    void AsyncStorage.setItem(THEME_KEY, m);
  }, []);

  const isDark = mode === "system" ? system === "dark" : mode === "dark";
  const t = isDark ? DARK : LIGHT;

  const value = useMemo<ThemeState>(() => ({ mode, isDark, t, setMode }), [mode, isDark, t, setMode]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
