// lib/api/groups.ts

import { api } from "./client";
import type { ApiGroup, ApiMembership } from "./types";

export interface CreateGroupPayload {
  title: string;
  currency: string;
  type?: string;
  photo?: string | null;
  description?: string | null;
  member_ids?: string[];
}

export const groupsApi = {
  async list(): Promise<ApiGroup[]> {
    const r = await api.get<ApiGroup[]>("/groups/");
    return r.data;
  },
  async get(id: string): Promise<ApiGroup> {
    const r = await api.get<ApiGroup>(`/groups/${id}`);
    return r.data;
  },
  async create(payload: CreateGroupPayload): Promise<ApiGroup> {
    const r = await api.post<ApiGroup>("/groups/", payload);
    return r.data;
  },
  async update(id: string, payload: Partial<CreateGroupPayload>): Promise<ApiGroup> {
    const r = await api.put<ApiGroup>(`/groups/${id}`, payload);
    return r.data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/groups/${id}`);
  },
  async leave(id: string): Promise<void> {
    await api.post(`/groups/${id}/leave`);
  },
  async members(groupId: string): Promise<ApiMembership[]> {
    const r = await api.get<ApiMembership[]>(`/groups/${groupId}/members`);
    return r.data;
  },
  async addMember(groupId: string, userId: string, isAdmin = false): Promise<ApiMembership> {
    const r = await api.post<ApiMembership[]>(`/groups/${groupId}/add_members`, {
      user_ids: [userId],
      is_admin: isAdmin,
    });
    return r.data[0];
  },
  async updateMember(groupId: string, userId: string, isAdmin: boolean): Promise<ApiMembership> {
    const r = await api.put<ApiMembership>(`/groups/${groupId}/members/${userId}`, {
      is_admin: isAdmin,
    });
    return r.data;
  },
  async removeMember(groupId: string, userId: string): Promise<void> {
    await api.delete(`/groups/${groupId}/members/${userId}`);
  },
};
