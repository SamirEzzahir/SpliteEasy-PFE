// lib/api/expenses.ts

import { api } from "./client";
import type { ApiExpense } from "./types";

export interface CreateExpensePayload {
  group_id: number;
  payer_id: number;
  amount: number;
  description: string;
  category?: string;
  date?: string;
  split_type?: "equal" | "percentage" | "share";
  wallet_id?: number;
  splits?: { user_id: number; amount: number }[];
}

export const expensesApi = {
  async listForGroup(groupId: number, page = 1, pageSize = 50): Promise<ApiExpense[]> {
    const r = await api.get<ApiExpense[]>(
      `/expenses/group/${groupId}?page=${page}&page_size=${pageSize}`,
    );
    return r.data;
  },
  async listAll(): Promise<ApiExpense[]> {
    // Walk all user groups and combine. The backend has no /expenses/all endpoint,
    // so callers using this on the All-Expenses page should pre-fetch groups and
    // then fan out — done in the page itself.
    return [];
  },
  async get(id: number): Promise<ApiExpense> {
    const r = await api.get<ApiExpense>(`/expenses/${id}`);
    return r.data;
  },
  async create(payload: CreateExpensePayload): Promise<ApiExpense> {
    const r = await api.post<ApiExpense>("/expenses/", payload);
    return r.data;
  },
  async update(id: number, payload: Partial<CreateExpensePayload>): Promise<ApiExpense> {
    const r = await api.put<ApiExpense>(`/expenses/${id}`, payload);
    return r.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/expenses/${id}`);
  },
};
