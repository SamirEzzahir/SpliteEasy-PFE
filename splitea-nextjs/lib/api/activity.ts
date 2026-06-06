import { api } from "./client";
import type { ApiUser } from "./types";

export interface ApiActivityLog {
  id: number;
  user_id: number;
  action: string;
  target_type?: string | null;
  target_id?: number | null;
  created_at: string;
  user: ApiUser;
}

export const activityApi = {
  async list(limit = 20): Promise<ApiActivityLog[]> {
    const r = await api.get<ApiActivityLog[]>(`/activity?limit=${limit}`);
    return r.data;
  },
};
