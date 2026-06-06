// lib/api/users.ts — user profile, password, settlement mode, deactivation
// Maps onto the backend `/users` router defined in routers/users.py

import { api } from "./client";
import type { ApiUser } from "./types";

export type SettlementMode = "separate" | "auto_adjust" | "hybrid";

export interface UpdateProfilePayload {
  full_name?: string | null;
  email?: string | null;
  username?: string | null;
  gender?: string | null;
  profile_picture?: string | null;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export const usersApi = {
  async list(): Promise<ApiUser[]> {
    const r = await api.get<ApiUser[]>("/users/");
    return r.data;
  },
  async get(id: number): Promise<ApiUser> {
    const r = await api.get<ApiUser>(`/users/${id}`);
    return r.data;
  },
  async updateProfile(id: number, payload: UpdateProfilePayload): Promise<ApiUser> {
    const r = await api.put<ApiUser>(`/users/${id}`, payload);
    return r.data;
  },
  async deactivate(id: number): Promise<void> {
    await api.delete(`/users/${id}`);
  },
  async changePassword(id: number, payload: ChangePasswordPayload): Promise<void> {
    await api.post(`/users/${id}/change-password`, payload);
  },
  async setSettlementMode(id: number, mode: SettlementMode): Promise<ApiUser> {
    const r = await api.put<ApiUser>(`/users/${id}/settlement-mode`, { mode });
    return r.data;
  },
};
