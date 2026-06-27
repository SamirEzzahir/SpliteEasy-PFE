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
  async getById(id: number): Promise<ApiUser> {
    const r = await api.get<ApiUser>(`/users/${id}`);
    return r.data;
  },

  async updateProfile(id: number, payload: UpdateProfilePayload): Promise<ApiUser> {
    const r = await api.put<ApiUser>(`/users/${id}`, payload);
    return r.data;
  },

  async changePassword(id: number, payload: ChangePasswordPayload): Promise<void> {
    await api.post("/users/user/me/change-password", payload);
  },

  async setSettlementMode(id: number, mode: SettlementMode): Promise<void> {
    await api.put("/users/user/me/global-settlement-mode", { mode });
  },

  async updateSettlementMode(id: number, mode: SettlementMode): Promise<void> {
    await this.setSettlementMode(id, mode);
  },

  async updatePreferredCurrency(currency: string): Promise<void> {
    await api.put("/users/user/me/preferred-currency", { currency });
  },

  async setOnboardingCompleted(completed: boolean): Promise<void> {
    await api.put("/users/user/me/onboarding", { completed });
  },

  async deactivate(id: number): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};
