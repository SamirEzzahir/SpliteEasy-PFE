import type { ApiBalanceEntry } from "./api/types";
import type { Group } from "./types";

export function groupBalanceSnapshot(entries: ApiBalanceEntry[] | null, userId: string) {
  const unavailable = { balance: 0, balanceUnavailable: true, outstanding: undefined };
  if (!entries) return unavailable;
  let mine = 0, outstanding = 0;
  for (const entry of entries) {
    const raw = entry.net ?? entry.balance;
    if (raw == null || !Number.isFinite(Number(raw))) return unavailable;
    const cents = Math.round(Number(raw) * 100);
    if (String(entry.user_id) === userId) mine = cents;
    outstanding += Math.max(0, cents);
  }
  return { balance: mine / 100, balanceUnavailable: false, outstanding: outstanding / 100 };
}

export function groupBalanceLabel(group: Pick<Group, "balance" | "balanceUnavailable" | "outstanding">) {
  if (group.balanceUnavailable) return "Balance unavailable";
  if (group.balance > 0) return "You are owed";
  if (group.balance < 0) return "You owe";
  if ((group.outstanding ?? 0) > 0) return "Others have balances";
  return "Settled";
}
