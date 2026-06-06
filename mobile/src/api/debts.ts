import client from './client'
import type { Debt, Loan } from '../types'

export const debtsApi = {
  list: () => client.get<Debt[]>('/debts'),
  create: (data: Omit<Debt, 'id' | 'user_id' | 'created_at' | 'updated_at'>) =>
    client.post<Debt>('/debts', data),
  update: (id: number, data: Partial<Debt>) => client.put<Debt>(`/debts/${id}`, data),
  delete: (id: number) => client.delete(`/debts/${id}`),
  repay: (id: number, amount: number, wallet_id?: number) =>
    client.post(`/debts/${id}/repay`, { amount, wallet_id }),
}

export const loansApi = {
  list: () => client.get<Loan[]>('/loans'),
  create: (data: Omit<Loan, 'id' | 'user_id' | 'created_at' | 'updated_at'>) =>
    client.post<Loan>('/loans', data),
  update: (id: number, data: Partial<Loan>) => client.put<Loan>(`/loans/${id}`, data),
  delete: (id: number) => client.delete(`/loans/${id}`),
  repay: (id: number, amount: number, wallet_id?: number) =>
    client.post(`/loans/${id}/repay`, { amount, wallet_id }),
}
