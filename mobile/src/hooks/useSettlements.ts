import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settlementsApi } from '../api/settlements'

export const useBalances = (groupId: number) =>
  useQuery({
    queryKey: ['balances', groupId],
    queryFn: () => settlementsApi.balances(groupId).then(r => r.data),
    enabled: !!groupId,
  })

export const useSuggestedSettlements = (groupId: number) =>
  useQuery({
    queryKey: ['suggested-settlements', groupId],
    queryFn: () => settlementsApi.suggested(groupId).then(r => r.data),
    enabled: !!groupId,
  })

export const useSettlementHistory = (groupId: number) =>
  useQuery({
    queryKey: ['settlement-history', groupId],
    queryFn: () => settlementsApi.history(groupId).then(r => r.data),
    enabled: !!groupId,
  })

export const usePendingSettlements = () =>
  useQuery({
    queryKey: ['pending-settlements'],
    queryFn: () => settlementsApi.pending().then(r => r.data),
  })

export const useRecordSettlement = (groupId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ toUserId, amount, message }: { toUserId: number; amount: number; message?: string }) =>
      settlementsApi.record(groupId, toUserId, amount, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['balances', groupId] })
      qc.invalidateQueries({ queryKey: ['settlement-history', groupId] })
      qc.invalidateQueries({ queryKey: ['pending-settlements'] })
    },
  })
}

export const useAcceptSettlement = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settlementsApi.accept,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-settlements'] }),
  })
}

export const useRejectSettlement = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      settlementsApi.reject(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-settlements'] }),
  })
}

export const useGlobalBalances = () =>
  useQuery({
    queryKey: ['global-balances'],
    queryFn: () => settlementsApi.globalBalances().then(r => r.data),
  })
