// lib/api/groups.ts

import { api } from "./client";
import type { ApiGroup, ApiMembership } from "./types";

export interface CreateGroupPayload {
  title: string;
  currency: string;
  type?: string;
}

export const groupsApi = {
  async list(): Promise<ApiGroup[]> {
    const r = await api.get<ApiGroup[]>("/groups/");
    return r.data;
  },
  async get(id: number): Promise<ApiGroup> {
    const r = await api.get<ApiGroup>(`/groups/${id}`);
    return r.data;
  },
  async create(payload: CreateGroupPayload): Promise<ApiGroup> {
    const r = await api.post<ApiGroup>("/groups/", payload);
    return r.data;
  },
  async update(id: number, payload: Partial<CreateGroupPayload>): Promise<ApiGroup> {
    const r = await api.put<ApiGroup>(`/groups/${id}`, payload);
    return r.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/groups/${id}`);
  },
  async leave(id: number): Promise<void> {
    await api.post(`/groups/${id}/leave`);
  },
  async members(groupId: number): Promise<ApiMembership[]> {
    const r = await api.get<ApiMembership[]>(`/memberships/${groupId}`);
    return r.data;
  },
  async addMember(groupId: number, userId: number, isAdmin = false): Promise<ApiMembership> {
    const r = await api.post<ApiMembership>("/memberships/", {
      group_id: groupId,
      user_id: userId,
      is_admin: isAdmin,
    });
    return r.data;
  },
  async removeMember(groupId: number, userId: number): Promise<void> {
    await api.delete(`/memberships/${groupId}/${userId}`);
  },
};
