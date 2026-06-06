// lib/api/client.ts — axios instance with JWT interceptor + global 401 handler

import axios, { AxiosError } from "axios";

// When NEXT_PUBLIC_API_URL is set, hit it directly. Otherwise hit the Next.js
// rewrite at /api (which proxies to BACKEND_PROXY_TARGET in development).
const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEY = "spliteasy.token";

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
  },
};

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${t}`;
  }
  return config;
});

// Listeners for global auth events (e.g. AuthContext redirects on 401)
type AuthListener = () => void;
const unauthorizedListeners = new Set<AuthListener>();

export function onUnauthorized(fn: AuthListener) {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      tokenStore.clear();
      unauthorizedListeners.forEach((fn) => fn());
    }
    return Promise.reject(err);
  },
);

// Convenience: pull a friendly error message from an axios error
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

// WebSocket base — strips /api prefix when proxied, otherwise mirrors API base.
export function wsBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/^http/, "ws");
  }
  // In dev: WS doesn't proxy through Next.js rewrites, so go straight to the
  // backend. Read window.location to derive the same host the user is on.
  if (typeof window !== "undefined") {
    const target = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000";
    return target;
  }
  return "ws://127.0.0.1:8000";
}
