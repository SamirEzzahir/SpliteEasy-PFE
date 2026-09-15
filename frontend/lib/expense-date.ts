function parseExpenseTimestamp(iso: string): Date {
  const value = iso.trim();
  // The API can return UTC timestamps without a timezone suffix.
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`);
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function expenseDateInput(iso?: string): string {
  return localDate(iso ? parseExpenseTimestamp(iso) : new Date());
}

export function expenseTimestamp(date: string, original?: string): string {
  const timestamp = original ? parseExpenseTimestamp(original) : new Date();
  // Keep the exact instant (and sub-millisecond precision) on ordinary edits.
  if (localDate(timestamp) === date) return original || timestamp.toISOString();

  const [year, month, day] = date.split("-").map(Number);
  timestamp.setFullYear(year, month - 1, day);
  return timestamp.toISOString();
}
