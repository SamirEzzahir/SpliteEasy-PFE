import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expensesApi, type CreateExpensePayload } from '../api/expenses'

export const useExpenses = (groupId: number) =>
  useInfiniteQuery({
    queryKey: ['expenses', groupId],
    queryFn: ({ pageParam = 0 }) =>
      expensesApi.list(groupId, 20, pageParam as number).then(r => r.data),
    getNextPageParam: (last) =>
      last.has_more ? last.offset + last.expenses.length : undefined,
    initialPageParam: 0,
    enabled: !!groupId,
  })

export const useCreateExpense = (groupId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateExpensePayload) => expensesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', groupId] })
      qc.invalidateQueries({ queryKey: ['balances', groupId] })
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export const useDeleteExpense = (groupId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: expensesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', groupId] })
      qc.invalidateQueries({ queryKey: ['balances', groupId] })
    },
  })
}
