// lib/api/notifications.ts

import { api } from "./client";
import type { ApiNotification } from "./types";

export const notificationsApi = {
  async list(): Promise<ApiNotification[]> {
    const r = await api.get<ApiNotification[]>("/Notifications/", { skipAuthRedirect: true });
    return r.data;
  },
  async markRead(id: number): Promise<void> {
    await api.put(`/Notifications/${id}/read`, undefined, { skipAuthRedirect: true });
  },
  async markAllRead(): Promise<void> {
    await api.post("/Notifications/read-all", undefined, { skipAuthRedirect: true });
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/Notifications/${id}`, { skipAuthRedirect: true });
  },
};
