// lib/api/auth.ts — auth endpoints

import { api } from "./client";
import type { ApiLoginResponse, ApiUser } from "./types";

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  full_name?: string;
}

export const authApi = {
  async login(username: string, password: string): Promise<ApiLoginResponse> {
    // The backend uses OAuth2PasswordRequestForm, which wants form-encoded
    // username/password — not JSON.
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    const r = await api.post<ApiLoginResponse>("/auth/login", form.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return r.data;
  },

  async register(payload: RegisterPayload): Promise<ApiUser> {
    const r = await api.post<ApiUser>("/auth/register", payload);
    return r.data;
  },

  async me(): Promise<ApiUser> {
    const r = await api.get<ApiUser>("/auth/me");
    return r.data;
  },
};
