import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { friendsApi } from '../api/friends'

export const useFriends = () =>
  useQuery({ queryKey: ['friends'], queryFn: () => friendsApi.my().then(r => r.data) })

export const useSentRequests = () =>
  useQuery({ queryKey: ['sent-requests'], queryFn: () => friendsApi.sentRequests().then(r => r.data) })

export const useReceivedRequests = () =>
  useQuery({ queryKey: ['received-requests'], queryFn: () => friendsApi.receivedRequests().then(r => r.data) })

export const useSendFriendRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: friendsApi.sendRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sent-requests'] }),
  })
}

export const useAcceptFriendRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: friendsApi.acceptRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['received-requests'] })
      qc.invalidateQueries({ queryKey: ['friends'] })
    },
  })
}

export const useRejectFriendRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: friendsApi.rejectRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['received-requests'] }),
  })
}

export const useRemoveFriend = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: friendsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
  })
}
