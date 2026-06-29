// lib/api/support.ts — user-facing support portal client (/support/*) + shared
// ticket types. Admin-side ticket methods live on adminApi (lib/api/admin.ts) and
// reuse these types.

import { api } from "./client";
import type { Paginated } from "./admin";

export type { Paginated };

export interface TicketReply {
  id: number;
  author_id?: number | null;
  author_username?: string | null;
  is_admin: boolean;
  body: string;
  created_at: string;
}

export interface Ticket {
  id: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  user_id: number;
  requester_username?: string | null;
  assigned_to_id?: number | null;
  assignee_username?: string | null;
  reply_count: number;
  created_at: string;
  updated_at?: string | null;
}

export interface TicketDetail extends Ticket {
  message: string;
  replies: TicketReply[];
}

export interface CreateTicketPayload {
  subject: string;
  message: string;
  category: string;
  priority: string;
}

export interface TicketListParams {
  page?: number;
  page_size?: number;
  status?: string;
  category?: string;
  q?: string;
}

export const supportApi = {
  async create(payload: CreateTicketPayload): Promise<TicketDetail> {
    return (await api.post<TicketDetail>("/support/tickets", payload)).data;
  },
  async list(params: TicketListParams = {}): Promise<Paginated<Ticket>> {
    return (await api.get<Paginated<Ticket>>("/support/tickets", { params })).data;
  },
  async get(id: number): Promise<TicketDetail> {
    return (await api.get<TicketDetail>(`/support/tickets/${id}`)).data;
  },
  async reply(id: number, body: string): Promise<TicketReply> {
    return (await api.post<TicketReply>(`/support/tickets/${id}/replies`, { body })).data;
  },
  async close(id: number) {
    return (await api.post(`/support/tickets/${id}/close`)).data;
  },
};
