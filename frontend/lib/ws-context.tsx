"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { tokenStore, wsBaseUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";

type Handler = (data: unknown) => void;
const WSContext = createContext<{ connected: boolean; subscribe: (type: string, handler: Handler) => () => void }>({ connected: false, subscribe: () => () => {} });

export function WSProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [connected, setConnected] = useState(false);
  const handlers = useRef(new Map<string, Set<Handler>>());
  const emit = useCallback((type: string, data: unknown) => {
    handlers.current.get(type)?.forEach(handler => { try { handler(data); } catch { /* Isolate subscribers. */ } });
  }, []);

  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let attempts = 0;
    let lastMessage = Date.now();
    const schedule = () => {
      if (!stopped) retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)));
    };
    function connect() {
      clearTimeout(retry);
      if (stopped || (socket && socket.readyState < WebSocket.CLOSING)) return;
      const token = tokenStore.get();
      if (!token) return;
      try {
        const ws = new WebSocket(wsBaseUrl().replace(/\/$/, "") + "/Notifications/ws/" + userId + "?token=" + encodeURIComponent(token));
        socket = ws;
        ws.onopen = () => {
          if (stopped) { ws.close(); return; }
          attempts = 0;
          lastMessage = Date.now();
          setConnected(true);
          emit("connected", null);
          heartbeat = setInterval(() => {
            if (Date.now() - lastMessage > 60000) { ws.close(); return; }
            if (ws.readyState === WebSocket.OPEN) ws.send("ping");
          }, 25000);
        };
        ws.onmessage = event => {
          lastMessage = Date.now();
          if (event.data === "pong") return;
          try {
            const data = JSON.parse(event.data);
            if (data.type) emit(data.type, data);
          } catch { emit("notification_string", event.data); }
        };
        ws.onerror = () => ws.close();
        ws.onclose = event => {
          clearInterval(heartbeat);
          if (socket === ws) socket = null;
          if (!stopped) {
            setConnected(false);
            if (event.code !== 1008) schedule();
          }
        };
      } catch { schedule(); }
    }
    const resume = () => { if (document.visibilityState === "visible") connect(); };
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearInterval(heartbeat);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
      if (socket) { socket.onclose = null; socket.close(); }
      setConnected(false);
    };
  }, [userId, emit]);

  const subscribe = useCallback((type: string, handler: Handler) => {
    if (!handlers.current.has(type)) handlers.current.set(type, new Set());
    handlers.current.get(type)!.add(handler);
    return () => { handlers.current.get(type)?.delete(handler); };
  }, []);
  return <WSContext.Provider value={{ connected, subscribe }}>{children}</WSContext.Provider>;
}

export const useWS = () => useContext(WSContext);
