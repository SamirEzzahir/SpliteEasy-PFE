import type { Group } from "./types";

export interface GroupCurrencyTotal {
  currency: string;
  total: number;
  owed: number;
  owe: number;
}

/** Aggregate recorded amounts only within the same currency; no FX conversion. */
export function summarizeGroups(groups: Pick<Group, "currency" | "total" | "balance">[]) {
  const currencies = new Map<string, GroupCurrencyTotal>();
  for (const group of groups) {
    const currency = group.currency?.trim().toUpperCase() || "MAD";
    const row = currencies.get(currency) || { currency, total: 0, owed: 0, owe: 0 };
    row.total += group.total;
    row.owed += Math.max(0, group.balance);
    row.owe += Math.max(0, -group.balance);
    currencies.set(currency, row);
  }
  return { active: groups.length, currencies: Array.from(currencies.values()) };
}
