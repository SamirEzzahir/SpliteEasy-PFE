// lib/api/client.ts — axios instance with JWT interceptor + global 401 handler

import axios, { AxiosError } from "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean;
  }
}

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
// hadToken: true if a token was present when the 401 arrived (expired/invalid session)
//           false if the request had no token (anonymous endpoint hit) — don't redirect
type AuthListener = (hadToken: boolean) => void;
const unauthorizedListeners = new Set<AuthListener>();

export function onUnauthorized(fn: AuthListener) {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      const skipAuthRedirect = err.config?.skipAuthRedirect;
      if (!skipAuthRedirect) {
        const hadToken = !!tokenStore.get();
        tokenStore.clear();
        unauthorizedListeners.forEach((fn) => fn(hadToken));
      }
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

// WebSocket base — WS can't proxy through Next.js rewrites, so it always points
// straight at the backend. Resolution order:
//   1. NEXT_PUBLIC_WS_URL          — explicit override (recommended)
//   2. NEXT_PUBLIC_API_URL → ws    — reuse the public API host
//   3. derive from the page host   — works on any host the user reaches the app from
// The dev backend listens on 8800 (uvicorn); override via NEXT_PUBLIC_WS_URL for
// Docker/prod where the published port differs.
const DEFAULT_WS_PORT = 8800;

export function wsBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/^http/, "ws");
  }
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.hostname}:${DEFAULT_WS_PORT}`;
  }
  return `ws://127.0.0.1:${DEFAULT_WS_PORT}`;
}
