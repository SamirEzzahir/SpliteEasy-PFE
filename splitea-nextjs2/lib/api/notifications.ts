// lib/api/notifications.ts

import { api } from "./client";
import type { ApiNotification } from "./types";

export const notificationsApi = {
  async list(): Promise<ApiNotification[]> {
    const r = await api.get<ApiNotification[]>("/Notifications/");
    return r.data;
  },
  async markRead(id: number): Promise<void> {
    await api.put(`/Notifications/${id}/read`);
  },
  async markAllRead(): Promise<void> {
    await api.put("/Notifications/read-all");
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/Notifications/${id}`);
  },
};
