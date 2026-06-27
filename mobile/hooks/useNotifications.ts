// hooks/useNotifications.ts — REST + shared WebSocket notifications feed.
// Ported unchanged from the web (no web-only APIs); only imports adjusted.

import { useCallback, useEffect, useRef, useState } from "react";
import { notificationsApi } from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/AuthContext";
import { useWS } from "@/lib/ws-context";
import { mapNotification } from "@/lib/api/mappers";

export type Notif = ReturnType<typeof mapNotification>;

const POLL_MS = 5 * 60 * 1000;

export function useNotifications() {
  const { user } = useAuth();
  const { subscribe } = useWS();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await notificationsApi.list();
      const mapped = list.map(mapNotification);
      setItems(mapped);
      setUnread(mapped.filter((n) => !n.isRead).length);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh();

    // Subscribe to any WS event that signals a new notification
    const unsub1 = subscribe("notification_string", () => void refresh());
    const unsub2 = subscribe("notification", () => void refresh());

    // Fallback poll
    pollRef.current = setInterval(() => void refresh(), POLL_MS);

    return () => {
      unsub1();
      unsub2();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [user, refresh, subscribe]);

  const markRead = useCallback(async (id: number) => {
    await notificationsApi.markRead(id);
    setItems((s) => s.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnread((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead();
    setItems((s) => s.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  }, []);

  return { items, unread, refresh, markRead, markAllRead };
}
