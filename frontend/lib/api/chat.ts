// lib/api/chat.ts

import { api } from "./client";

export interface ChatMessage {
  id: string;
  group_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export const chatApi = {
  async fetchMessages(groupId: string): Promise<ChatMessage[]> {
    const r = await api.get<ChatMessage[]>(`/groups/${groupId}/messages`);
    // backend already returns oldest-first (it reverses internally)
    return r.data;
  },
  async sendMessage(groupId: string, content: string): Promise<ChatMessage> {
    const r = await api.post<ChatMessage>(`/groups/${groupId}/messages`, {
      content,
      group_id: groupId,
    });
    return r.data;
  },
  async sendTyping(groupId: string): Promise<void> {
    await api.post(`/groups/${groupId}/typing`, {});
  },
};
