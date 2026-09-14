"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { fmt } from "@/lib/format";

const CHANGE_EVENT = "spliteasy:wallet-privacy";
const memory = new Map<string, boolean>();
export const MASKED_BALANCE = "*****.**";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readHidden(key: string | null) {
  if (!key) return true;
  if (memory.has(key)) return memory.get(key)!;
  try {
    return window.localStorage.getItem(key) === "hidden";
  } catch {
    return memory.get(key) ?? false;
  }
}

// Hide on the server/first hydration frame so a saved preference never flashes balances.
const serverSnapshot = () => true;

export function useWalletPrivacy() {
  const { user } = useAuth();
  const key = user ? `spliteasy.wallet-privacy.${user.id}` : null;
  const snapshot = useCallback(() => readHidden(key), [key]);
  const balancesHidden = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const toggleBalances = useCallback(() => {
    if (!key) return;
    const hidden = !readHidden(key);
    try {
      window.localStorage.setItem(key, hidden ? "hidden" : "visible");
      memory.delete(key);
    } catch {
      // The toggle still works for this session when storage is unavailable.
      memory.set(key, hidden);
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [key]);

  const formatBalance = (value: string | number, currency?: string | null) =>
    balancesHidden ? MASKED_BALANCE : fmt(Number(value), currency || "MAD");

  return { balancesHidden, toggleBalances, formatBalance };
}
