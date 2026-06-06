import client from './client'
import type { Group, Membership, GroupMessage } from '../types'

export const groupsApi = {
  list: () => client.get<Group[]>('/groups'),
  get: (id: number) => client.get<Group>(`/groups/${id}`),
  create: (data: { title: string; type: string; currency: string; member_ids: number[] }) =>
    client.post<Group>('/groups', data),
  update: (id: number, data: Partial<Group>) => client.put<Group>(`/groups/${id}`, data),
  delete: (id: number) => client.delete(`/groups/${id}`),

  members: (id: number) => client.get<Membership[]>(`/groups/${id}/members`),
  addMembers: (id: number, user_ids: number[], is_admin = false) =>
    client.post(`/groups/${id}/add_members`, { user_ids, is_admin }),
  updateMember: (groupId: number, userId: number, is_admin: boolean) =>
    client.put(`/groups/${groupId}/members/${userId}`, { is_admin }),
  removeMember: (groupId: number, userId: number) =>
    client.delete(`/groups/${groupId}/members/${userId}`),
  leave: (id: number) => client.post(`/groups/${id}/leave`),
  canLeave: (id: number) => client.get<{ can_leave: boolean }>(`/groups/${id}/can_leave`),

  messages: (id: number) => client.get<GroupMessage[]>(`/groups/${id}/messages`),
  sendMessage: (id: number, content: string) =>
    client.post<GroupMessage>(`/groups/${id}/messages`, { content }),

  joinInfo: (id: number) => client.get(`/groups/join/${id}/info`),
  join: (id: number) => client.post(`/groups/join/${id}`),
}
