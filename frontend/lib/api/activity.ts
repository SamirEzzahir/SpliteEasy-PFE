import { api } from "./client";
import type { ApiUser } from "./types";

export interface ApiActivityLog {
  id: string;
  user_id: string;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  created_at: string;
  user: ApiUser;
}

export const activityApi = {
  async list(limit = 20, offset = 0): Promise<ApiActivityLog[]> {
    const r = await api.get<ApiActivityLog[]>(`/activity?limit=${limit}&offset=${offset}`);
    return r.data;
  },
};
