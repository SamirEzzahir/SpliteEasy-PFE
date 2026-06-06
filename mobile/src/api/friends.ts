import client from './client'
import type { Friend, FriendRequest, User } from '../types'

export const friendsApi = {
  my: () => client.get<Friend[]>('/friends/my'),
  search: (query: string) => client.get<User[]>(`/friends/search?query=${encodeURIComponent(query)}`),
  sentRequests: () => client.get<FriendRequest[]>('/friends/requests/sent'),
  receivedRequests: () => client.get<FriendRequest[]>('/friends/requests/received'),
  sendRequest: (friendId: number) => client.post(`/friends/request/${friendId}`),
  acceptRequest: (requestId: number) => client.post(`/friends/request/${requestId}/accept`),
  rejectRequest: (requestId: number) => client.post(`/friends/request/${requestId}/reject`),
  remove: (friendshipId: number) => client.delete(`/friends/remove/${friendshipId}`),
}
