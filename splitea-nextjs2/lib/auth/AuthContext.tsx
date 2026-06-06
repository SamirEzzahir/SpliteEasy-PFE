"use client";
// lib/auth/AuthContext.tsx — user session, login, logout, register

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, type RegisterPayload } from "@/lib/api/auth";
import { apiErrorMessage, onUnauthorized, tokenStore } from "@/lib/api/client";
import type { ApiUser } from "@/lib/api/types";

interface AuthState {
  user: ApiUser | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = tokenStore.get();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Listen for global 401s emitted by the API client.
    const unsub = onUnauthorized(() => {
      setUser(null);
      router.replace("/login");
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
      tokenStore.set(access_token);
      const me = await authApi.me();
      setUser(me);
      router.replace("/jars");
    } catch (e) {
      setError(apiErrorMessage(e));
      throw e;
    }
  }, [router]);

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

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    router.replace("/login");
  }, [router]);

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
