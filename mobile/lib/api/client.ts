// lib/api/client.ts — axios instance with JWT interceptor + global 401 handler.
//
// React Native adaptation of the web client:
//   • token persisted in AsyncStorage (async) instead of localStorage (sync)
//   • baseURL is a constant (BASE_URL) — no Next.js /api rewrite proxy
//   • 401 handling stays a plain in-memory listener Set (no DOM events)

import axios, { AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL, TOKEN_KEY, WS_URL } from "../config";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean;
  }
}

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// AsyncStorage-backed token store. Note: get() is async here (unlike the web
// localStorage version), so callers must await it.
export const tokenStore = {
  async get(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async set(token: string) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },
  async clear() {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },
};

// Attach JWT on every request.
api.interceptors.request.use(async (config) => {
  const t = await tokenStore.get();
  if (t) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${t}`;
  }
  return config;
});

// Listeners for global auth events (AuthContext subscribes to redirect on 401).
// hadToken: true if a token was present when the 401 arrived (expired session)
//           false if the request had no token — don't redirect.
type AuthListener = (hadToken: boolean) => void;
const unauthorizedListeners = new Set<AuthListener>();

export function onUnauthorized(fn: AuthListener) {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      const skipAuthRedirect = err.config?.skipAuthRedirect;
      if (!skipAuthRedirect) {
        const hadToken = !!(await tokenStore.get());
        await tokenStore.clear();
        unauthorizedListeners.forEach((fn) => fn(hadToken));
      }
    }
    return Promise.reject(err);
  },
);

// Pull a friendly error message from an axios error.
export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { detail?: unknown; message?: string } | undefined;
    if (data?.detail) {
      if (typeof data.detail === "string") return data.detail;
      if (Array.isArray(data.detail) && data.detail.length > 0) {
        const first = data.detail[0] as { msg?: string };
        if (first?.msg) return first.msg;
      }
    }
    if (data?.message) return data.message;
    return err.message;
  }
  return String(err);
}

// WebSocket base — derived from WS_URL. RN provides a global WebSocket.
export function wsBaseUrl(): string {
  return WS_URL;
}
