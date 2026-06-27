// lib/api/expenses.ts

import { api } from "./client";
import type { ApiExpense } from "./types";

export interface CreateExpensePayload {
  group_id: number;
  payer_id: number;
  added_by?: number;
  amount: number;
  currency?: string;
  description: string;
  category?: string;
  created_at: string;          // required by backend — ISO datetime string
  split_type?: "equal" | "percentage" | "share";
  wallet_id?: number;
  splits?: { user_id: number; share_amount: number }[];
}

export const expensesApi = {
  async listForGroup(groupId: number, page = 1, pageSize = 50): Promise<ApiExpense[]> {
    const offset = Math.max(0, page - 1) * pageSize;
    const r = await api.get<ApiExpense[] | { expenses: ApiExpense[] }>(
      `/expenses/${groupId}?limit=${pageSize}&offset=${offset}`,
    );
    return Array.isArray(r.data) ? r.data : r.data.expenses;
  },
  async listAll(): Promise<ApiExpense[]> {
    const r = await api.get<ApiExpense[]>("/expenses/all");
    return r.data;
  },
  async get(id: number): Promise<ApiExpense> {
    const r = await api.get<ApiExpense>(`/expenses/exp/${id}`);
    return r.data;
  },
  async create(payload: CreateExpensePayload): Promise<ApiExpense> {
    const r = await api.post<ApiExpense>("/expenses", payload);
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
