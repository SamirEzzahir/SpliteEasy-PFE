// lib/api/users.ts — user profile endpoints

import { api } from "./client";
import type { ApiUser } from "./types";

export interface UpdateProfilePayload {
  full_name?: string;
  username?: string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  phone?: string | null;
  profile_photo?: string | null;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

export type SettlementMode = "separate" | "auto_adjust" | "hybrid";

export const usersApi = {
  async getById(id: string): Promise<ApiUser> {
    const r = await api.get<ApiUser>(`/users/${id}`);
    return r.data;
  },

  async updateProfile(id: string, payload: UpdateProfilePayload): Promise<ApiUser> {
    const r = await api.put<ApiUser>(`/users/${id}`, payload);
    return r.data;
  },

  async changePassword(id: string, payload: ChangePasswordPayload): Promise<void> {
    await api.post("/users/user/me/change-password", payload);
  },

  async setSettlementMode(id: string, mode: SettlementMode): Promise<void> {
    await api.put("/users/user/me/global-settlement-mode", { mode });
  },

  async updateSettlementMode(id: string, mode: SettlementMode): Promise<void> {
    await this.setSettlementMode(id, mode);
  },

  async updatePreferredCurrency(currency: string): Promise<ApiUser> {
    const response = await api.put<ApiUser>("/users/user/me/preferred-currency", { currency });
    return response.data;
  },

  async setOnboardingCompleted(completed: boolean): Promise<void> {
    await api.put("/users/user/me/onboarding", { completed });
  },

  async deactivate(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};
