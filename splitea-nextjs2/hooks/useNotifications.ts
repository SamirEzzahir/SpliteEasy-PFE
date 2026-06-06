"use client";
// hooks/useNotifications.ts — REST + WebSocket notifications feed.
//
// Fetches the initial list on mount, then subscribes to /Notifications/ws/{user_id}
// for live pushes. Falls back to polling every 5 minutes if the WS connection
// drops and reconnect attempts are exhausted.

import { useCallback, useEffect, useRef, useState } from "react";
import { notificationsApi } from "@/lib/api/notifications";
import { tokenStore, wsBaseUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { mapNotification } from "@/lib/api/mappers";

export type Notif = ReturnType<typeof mapNotification>;

const MAX_RECONNECTS = 5;
const POLL_MS = 5 * 60 * 1000;

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await notificationsApi.list();
      const mapped = list.map(mapNotification);
      setItems(mapped);
      setUnread(mapped.filter((n) => !n.isRead).length);
    } catch {
      // Network/auth errors are non-fatal — the next poll or WS msg will retry.
    }
  }, []);

  const connect = useCallback(() => {
    if (!user) return;
    const token = tokenStore.get();
    const base = wsBaseUrl();
    // Some backends accept the token via query string; we include it for safety.
    const url = `${base}/Notifications/ws/${user.id}${token ? `?token=${token}` : ""}`;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        attemptsRef.current = 0;
      };
      ws.onmessage = () => {
        // Any message means *something* changed — re-pull the canonical list.
        void refresh();
      };
      ws.onclose = () => {
        if (attemptsRef.current < MAX_RECONNECTS) {
          attemptsRef.current += 1;
          const delay = Math.min(30000, 1000 * 2 ** attemptsRef.current);
          setTimeout(() => connect(), delay);
        } else {
          // Reconnects exhausted — fall back to polling.
          if (!pollRef.current) {
            pollRef.current = setInterval(() => void refresh(), POLL_MS);
          }
        }
      };
      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Constructor can throw if the URL is malformed; fall back to polling.
      if (!pollRef.current) pollRef.current = setInterval(() => void refresh(), POLL_MS);
    }
  }, [user, refresh]);

  useEffect(() => {
    if (!user) return;
    void refresh();
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      attemptsRef.current = 0;
    };
  }, [user, refresh, connect]);

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
