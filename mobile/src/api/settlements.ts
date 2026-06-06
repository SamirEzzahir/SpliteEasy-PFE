import client from './client'
import type { BalanceItem, Settlement } from '../types'

export const settlementsApi = {
  // Per-group
  balances: (groupId: number) =>
    client.get<BalanceItem[]>(`/settle/${groupId}/balances`),
  suggested: (groupId: number) =>
    client.get<Settlement[]>(`/settle/${groupId}/settlements`),
  history: (groupId: number) =>
    client.get<Settlement[]>(`/settle/${groupId}/history`),
  record: (groupId: number, to_user_id: number, amount: number, message?: string) =>
    client.post<Settlement>(`/settle/${groupId}/record`, { to_user_id, amount, message }),
  accept: (settlementId: number) =>
    client.post<Settlement>(`/settle/${settlementId}/accept`),
  reject: (settlementId: number, reason?: string) =>
    client.post<Settlement>(`/settle/${settlementId}/reject`, { reason }),
  pending: () => client.get<Settlement[]>('/settle/pending'),

  // Global (cross-group)
  globalBalances: () => client.get<BalanceItem[]>('/settle/global/balances'),
  globalSuggested: () => client.get<Settlement[]>('/settle/global/settlements'),
  globalHistory: () => client.get<Settlement[]>('/settle/global/history'),
  globalPending: () => client.get<Settlement[]>('/settle/global/pending'),
  globalRecord: (to_user_id: number, amount: number, message?: string) =>
    client.post<Settlement>('/settle/global/record', { to_user_id, amount, message }),
  globalAccept: (id: number) => client.post<Settlement>(`/settle/global/${id}/accept`),
  globalReject: (id: number, reason?: string) =>
    client.post<Settlement>(`/settle/global/${id}/reject`, { reason }),
}
