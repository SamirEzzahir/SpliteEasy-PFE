import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { groupsApi } from '../api/groups'

export const useGroups = () =>
  useQuery({ queryKey: ['groups'], queryFn: () => groupsApi.list().then(r => r.data) })

export const useGroup = (id: number) =>
  useQuery({ queryKey: ['group', id], queryFn: () => groupsApi.get(id).then(r => r.data), enabled: !!id })

export const useGroupMembers = (id: number) =>
  useQuery({ queryKey: ['group-members', id], queryFn: () => groupsApi.members(id).then(r => r.data), enabled: !!id })

export const useGroupMessages = (id: number) =>
  useQuery({ queryKey: ['group-messages', id], queryFn: () => groupsApi.messages(id).then(r => r.data), enabled: !!id })

export const useCreateGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: groupsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}

export const useDeleteGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: groupsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}

export const useLeaveGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: groupsApi.leave,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}
