import type { Expense } from "./types";

/** Saved shares are authoritative, including zero and a payer outside the split. */
export function expenseShare(expense: Expense, userId: string, fallbackIds: string[] = []): number {
  const saved = expense.splitAmounts?.[userId];
  if (saved !== undefined) return saved;
  const ids = expense.splitIds.length ? expense.splitIds : fallbackIds;
  return allocateShares(expense.amount, ids)[userId] ?? 0;
}

/** Allocate whole cents deterministically; displayed shares equal submitted shares. */
export function allocateShares(amount: number, ids: string[], weights?: Record<string, number>): Record<string, number> {
  const cents = Math.round(amount * 100);
  const total = ids.reduce((sum, id) => sum + (weights?.[id] ?? (weights ? 0 : 1)), 0);
  if (!ids.length || total <= 0 || !Number.isFinite(cents) || cents < 0) return {};
  const rows = ids.map((id, index) => {
    const exact = cents * (weights?.[id] ?? 1) / total;
    return { id, index, cents: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  const remainder = cents - rows.reduce((sum, row) => sum + row.cents, 0);
  const order = [...rows].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i++) order[i % order.length].cents++;
  return Object.fromEntries(rows.map((row) => [row.id, row.cents / 100]));
}
