// lib/api/friends.ts

import { api } from "./client";
import type { ApiFriend, ApiUser } from "./types";

export const friendsApi = {
  async list(): Promise<ApiFriend[]> {
    const r = await api.get<ApiFriend[]>("/friends/");
    return r.data;
  },
  async pendingRequests(): Promise<ApiFriend[]> {
    const r = await api.get<ApiFriend[]>("/friends/requests/pending");
    return r.data;
  },
  async search(query: string): Promise<ApiUser[]> {
    const r = await api.get<ApiUser[]>(`/friends/search?q=${encodeURIComponent(query)}`);
    return r.data;
  },
  async sendRequest(friendId: number): Promise<ApiFriend> {
    const r = await api.post<ApiFriend>("/friends/request", { friend_id: friendId });
    return r.data;
  },
  async accept(id: number): Promise<ApiFriend> {
    const r = await api.post<ApiFriend>(`/friends/accept/${id}`);
    return r.data;
  },
  async reject(id: number): Promise<ApiFriend> {
    const r = await api.post<ApiFriend>(`/friends/reject/${id}`);
    return r.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/friends/${id}`);
  },
};
