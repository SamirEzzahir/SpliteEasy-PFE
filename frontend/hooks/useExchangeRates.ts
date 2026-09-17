"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchExchangeRates, type ExchangeRateSnapshot } from "@/lib/api/exchange-rates";

export function useExchangeRates(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<ExchangeRateSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let inFlight = false;
    let due = 0;
    async function load() {
      if (controller.signal.aborted || inFlight) return;
      clearTimeout(timer);
      if (document.visibilityState !== "visible") {
        timer = setTimeout(load, 60000);
        return;
      }
      inFlight = true;
      setLoading(true);
      setSnapshot(previous => {
        if (!previous || Date.now() - Date.parse(previous.updated_at) > 7 * 86400000) return null;
        return Date.now() >= Date.parse(previous.next_update_at) ? { ...previous, stale: true } : previous;
      });
      let seconds = 60;
      try {
        const data = await fetchExchangeRates(controller.signal);
        if (controller.signal.aborted) return;
        setSnapshot(data);
        setError("");
        seconds = Math.max(60, Math.min(86400, data.refresh_after_seconds || 60));
      } catch {
        if (controller.signal.aborted) return;
        setError("Could not refresh exchange rates.");
        setSnapshot(previous => previous && Date.now() - Date.parse(previous.updated_at) <= 7 * 86400000
          ? { ...previous, stale: true } : null);
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) {
          setLoading(false);
          due = Date.now() + seconds * 1000;
          timer = setTimeout(load, seconds * 1000);
        }
      }
    }
    const resume = () => { if (Date.now() >= due) void load(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    void load();
    return () => {
      controller.abort(); clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [enabled, attempt]);

  return { snapshot, loading, error, refresh };
}
