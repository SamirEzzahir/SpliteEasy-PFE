// lib/ws-context.tsx — single shared WebSocket connection for the whole app.
//
// RN adaptation of the web WSProvider. React Native provides a global
// WebSocket, so the logic is unchanged except tokenStore.get() is now async,
// so connect() awaits the token before building the URL.

import React, { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { tokenStore, wsBaseUrl } from "./api/client";
import { useAuth } from "./auth/AuthContext";

type Handler = (data: unknown) => void;

interface WSContextValue {
  /** Subscribe to a specific WS event type. Returns an unsubscribe fn. */
  subscribe: (type: string, handler: Handler) => () => void;
}

const WSContext = createContext<WSContextValue>({ subscribe: () => () => {} });

export function WSProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<Handler>>>(new Map());
  const attemptsRef = useRef(0);
  const closedRef = useRef(false);
  const MAX_RECONNECTS = 8;

  const dispatch = useCallback((raw: string) => {
    try {
      const data = JSON.parse(raw) as { type?: string };
      if (!data.type) return;
      const set = handlersRef.current.get(data.type);
      set?.forEach((fn) => fn(data));
    } catch {
      // plain string notification — fire "notification_string" handlers
      const set = handlersRef.current.get("notification_string");
      set?.forEach((fn) => fn(raw));
    }
  }, []);

  const connect = useCallback(async () => {
    if (!user?.id) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = await tokenStore.get();
    const url = `${wsBaseUrl()}/Notifications/ws/${user.id}${token ? `?token=${token}` : ""}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => { attemptsRef.current = 0; };
      ws.onmessage = (e) => dispatch(e.data as string);
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        wsRef.current = null;
        if (!closedRef.current && attemptsRef.current < MAX_RECONNECTS) {
          attemptsRef.current += 1;
          const delay = Math.min(30000, 500 * 2 ** attemptsRef.current);
          setTimeout(() => void connect(), delay);
        }
      };
    } catch {
      // malformed URL — skip
    }
  }, [user?.id, dispatch]);

  useEffect(() => {
    if (!user?.id) return;
    closedRef.current = false;
    void connect();
    return () => {
      closedRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
      attemptsRef.current = 0;
    };
  }, [user?.id, connect]);

  const subscribe = useCallback((type: string, handler: Handler) => {
    if (!handlersRef.current.has(type)) handlersRef.current.set(type, new Set());
    handlersRef.current.get(type)!.add(handler);
    return () => handlersRef.current.get(type)?.delete(handler);
  }, []);

  return <WSContext.Provider value={{ subscribe }}>{children}</WSContext.Provider>;
}

export function useWS() {
  return useContext(WSContext);
}
