import client from './client'
import type { Wallet, Transaction, Income, IncomeType } from '../types'

export const walletsApi = {
  list: () => client.get<Wallet[]>('/wallets'),
  create: (data: { name: string; category: string; balance: number }) =>
    client.post<Wallet>('/wallets', data),
  update: (id: number, data: Partial<Wallet>) => client.put<Wallet>(`/wallets/${id}`, data),
  delete: (id: number) => client.delete(`/wallets/${id}`),
}

export const transactionsApi = {
  list: () => client.get<Transaction[]>('/transactions'),
  create: (data: {
    from_wallet_id: number
    to_wallet_id?: number
    transaction_type: string
    amount: number
    note?: string
  }) => client.post<Transaction>('/transactions', data),
}

export const incomesApi = {
  list: () => client.get<Income[]>('/incomes'),
  create: (data: {
    income_type_id: number
    wallet_id: number
    amount: number
    date: string
    note?: string
  }) => client.post<Income>('/incomes', data),
  update: (id: number, data: Partial<Income>) => client.put<Income>(`/incomes/${id}`, data),
  delete: (id: number) => client.delete(`/incomes/${id}`),
}

export const incomeTypesApi = {
  list: () => client.get<IncomeType[]>('/income-types'),
  create: (data: { name: string; category?: string }) =>
    client.post<IncomeType>('/income-types', data),
}
