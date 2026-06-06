import { useState, useEffect, useCallback, useRef } from 'react'
import client, { getApiWsBase } from '../api/client'
import type { Notification } from '../types'

export function useNotifications(userId: number | null) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const res = await client.get<Notification[]>('/Notifications/?limit=10')
      setNotifications(res.data)
    } catch { /* ignore */ }
  }, [userId])

  const markAllRead = useCallback(async () => {
    try {
      await client.post('/Notifications/read-all')
      load()
    } catch { /* ignore */ }
  }, [load])

  const connect = useCallback(() => {
    if (!userId) return
    const wsUrl = `${getApiWsBase()}/Notifications/ws/${userId}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => { reconnectAttempts.current = 0 }
    ws.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data)
        if (parsed.type === 'new_chat_message') {
          window.dispatchEvent(new CustomEvent('newChatMessage', { detail: parsed.message }))
          return
        }
      } catch { /* not JSON */ }
      load()
    }
    ws.onclose = (e) => {
      if (e.code !== 1000 && reconnectAttempts.current < 5) {
        reconnectAttempts.current++
        setTimeout(connect, 3000)
      }
    }
  }, [userId, load])

  useEffect(() => {
    if (!userId) return
    load()
    connect()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => {
      clearInterval(interval)
      wsRef.current?.close(1000, 'cleanup')
    }
  }, [userId, load, connect])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return { notifications, unreadCount, markAllRead, reload: load }
}
