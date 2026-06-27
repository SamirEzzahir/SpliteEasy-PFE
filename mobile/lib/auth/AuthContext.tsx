// lib/auth/AuthContext.tsx — user session, login, logout, register.
//
// RN adaptation of the web AuthContext:
//   • token persisted via AsyncStorage-backed tokenStore (async)
//   • NO imperative navigation here — the root layout's <AuthGuard> watches
//     `user`/`loading` and redirects. This keeps navigation in one place and
//     drops the next/navigation dependency entirely.

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi, type RegisterPayload } from "../api/auth";
import { apiErrorMessage, onUnauthorized, tokenStore } from "../api/client";
import type { ApiUser } from "../api/types";

interface AuthState {
  user: ApiUser | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = await tokenStore.get();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      await tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Global 401s emitted by the API client clear the session. The AuthGuard
    // reacts to user becoming null and redirects to /login.
    const unsub = onUnauthorized(() => {
      setUser(null);
    });
    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const { access_token } = await authApi.login(username, password);
      await tokenStore.set(access_token);
      const me = await authApi.me();
      setUser(me);
    } catch (e) {
      setError(apiErrorMessage(e));
      throw e;
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setError(null);
    try {
      await authApi.register(payload);
      await login(payload.username, payload.password);
    } catch (e) {
      setError(apiErrorMessage(e));
      throw e;
    }
  }, [login]);

  const logout = useCallback(async () => {
    await tokenStore.clear();
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, error, login, register, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
