import client from './client'
import type { AppNotification } from '../types'

export const notificationsApi = {
  list: (limit = 20, offset = 0) =>
    client.get<AppNotification[]>('/notifications/', { params: { limit, offset } }),
  markRead: (id: number) => client.post(`/notifications/${id}/read`),
}
