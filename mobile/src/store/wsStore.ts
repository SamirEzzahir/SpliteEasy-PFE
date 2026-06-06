import { create } from 'zustand'
import { WS_URL } from '../constants/config'
import type { AppNotification, GroupMessage } from '../types'

interface WsState {
  socket: WebSocket | null
  unreadCount: number
  latestMessage: GroupMessage | null
  connect: (userId: number, token: string) => void
  disconnect: () => void
  incrementUnread: () => void
  resetUnread: () => void
}

export const useWsStore = create<WsState>((set, get) => ({
  socket: null,
  unreadCount: 0,
  latestMessage: null,

  connect: (userId, token) => {
    get().disconnect()
    const ws = new WebSocket(`${WS_URL}/ws/${userId}?token=${token}`)

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'new_notification') {
          set((s) => ({ unreadCount: s.unreadCount + 1 }))
        } else if (data.type === 'new_chat_message') {
          set({ latestMessage: data.message })
        }
      } catch {}
    }

    ws.onerror = () => {}
    ws.onclose = () => set({ socket: null })

    set({ socket: ws })
  },

  disconnect: () => {
    const { socket } = get()
    if (socket) {
      socket.close()
      set({ socket: null })
    }
  },

  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
}))
