// lib/api/friends.ts

import { api } from "./client";
import type { ApiUser } from "./types";

// Shapes returned by the backend friends router
export interface ApiFriendEntry {
  friendship_id: string;
  user_id: string;
  username: string;
  email: string;
  phone?: string;
}

export interface ApiReceivedRequest {
  id: string;
  user_id?: string;
  user_username?: string;
  user_email: string;
  user_full_name?: string | null;
  user_first_name?: string | null;
  user_last_name?: string | null;
}

export interface ApiSentRequest {
  id: string;
  friend_id?: string;
  friend_username?: string;
  friend_email: string;
  friend_full_name?: string | null;
  friend_first_name?: string | null;
  friend_last_name?: string | null;
}

export interface ApiFriendSuggestion {
  user: ApiUser;
  mutuals: number;
}

export const friendsApi = {
  async list(): Promise<ApiFriendEntry[]> {
    const r = await api.get<ApiFriendEntry[]>("/friends/my");
    return r.data;
  },

  // Requests waiting for me to accept/reject
  async pendingRequests(): Promise<ApiReceivedRequest[]> {
    const r = await api.get<ApiReceivedRequest[]>("/friends/requests/received");
    return r.data;
  },

  // Requests I have sent (still pending)
  async sentRequests(): Promise<ApiSentRequest[]> {
    const r = await api.get<ApiSentRequest[]>("/friends/requests/sent");
    return r.data;
  },

  async search(query: string): Promise<ApiUser[]> {
    const r = await api.get<ApiUser[]>(`/friends/search?query=${encodeURIComponent(query)}`);
    return r.data;
  },

  async suggestions(limit = 5): Promise<ApiFriendSuggestion[]> {
    const r = await api.get<ApiFriendSuggestion[]>(`/friends/suggestions?limit=${limit}`);
    return r.data;
  },

  async sendRequest(friendId: string): Promise<{ message: string }> {
    const r = await api.post<{ message: string }>(`/friends/request/${friendId}`);
    return r.data;
  },

  async accept(requestId: string): Promise<{ message: string }> {
    const r = await api.post<{ message: string }>(`/friends/request/${requestId}/accept`);
    return r.data;
  },

  async reject(requestId: string): Promise<{ message: string }> {
    const r = await api.post<{ message: string }>(`/friends/request/${requestId}/reject`);
    return r.data;
  },

  async remove(friendshipId: string): Promise<void> {
    await api.delete(`/friends/remove/${friendshipId}`);
  },
};
