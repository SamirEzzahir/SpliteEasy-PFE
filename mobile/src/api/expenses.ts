import client from './client'
import type { Expense, PaginatedExpenses } from '../types'

export interface CreateExpensePayload {
  group_id: number
  payer_id: number
  description: string
  amount: number
  category?: string
  split_type: 'equal' | 'percentage' | 'share'
  wallet_id?: number | null
  note?: string | null
  splits: { user_id: number; share_amount: number }[]
}

export const expensesApi = {
  list: (groupId: number, limit = 20, offset = 0) =>
    client.get<PaginatedExpenses>(`/expenses/${groupId}`, { params: { limit, offset } }),

  all: (limit = 200) =>
    client.get<Expense[]>('/expenses/all', { params: { limit } }),

  create: (data: CreateExpensePayload) => client.post<Expense>('/expenses', data),

  update: (id: number, data: Partial<CreateExpensePayload>) =>
    client.put<Expense>(`/expenses/${id}`, data),

  delete: (id: number) => client.delete(`/expenses/${id}`),
}
