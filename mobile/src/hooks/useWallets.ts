import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { walletsApi, incomesApi, incomeTypesApi } from '../api/wallets'

export const useWallets = () =>
  useQuery({ queryKey: ['wallets'], queryFn: () => walletsApi.list().then(r => r.data) })

export const useCreateWallet = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: walletsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallets'] }),
  })
}

export const useDeleteWallet = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: walletsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallets'] }),
  })
}

export const useIncomes = () =>
  useQuery({ queryKey: ['incomes'], queryFn: () => incomesApi.list().then(r => r.data) })

export const useIncomeTypes = () =>
  useQuery({ queryKey: ['income-types'], queryFn: () => incomeTypesApi.list().then(r => r.data) })

export const useCreateIncome = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: incomesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incomes'] })
      qc.invalidateQueries({ queryKey: ['wallets'] })
    },
  })
}

export const useDeleteIncome = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: incomesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incomes'] }),
  })
}
