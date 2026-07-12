// lib/api/announcements.ts — user-facing active announcements (banner/popup).

import { api } from "./client";

export interface ActiveAnnouncement {
  id: number;
  title: string;
  body: string;
  type: string;
  delivery: "banner" | "popup" | "notification";
}

export const announcementsApi = {
  async active(): Promise<ActiveAnnouncement[]> {
    const { data } = await api.get<ActiveAnnouncement[]>("/announcements/active", { skipAuthRedirect: true });
    return data;
  },
};
