import { displayDate } from "./format";

export const expenseRangeOptions = [
  { id: "all", label: "All time" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Previous month" },
  { id: "last3Months", label: "Last 3 months" },
  { id: "thisYear", label: "This year" },
  { id: "lastYear", label: "Previous year" },
  { id: "custom", label: "Custom date range" },
];

// Local calendar boundaries, with an exclusive end (also correct across DST).
export function expenseRange(preset: string, start = "", end = "", now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth();
  let from: Date | undefined, until: Date | undefined;
  switch (preset) {
    case "thisMonth": from = new Date(y, m, 1); until = new Date(y, m + 1, 1); break;
    case "lastMonth": from = new Date(y, m - 1, 1); until = new Date(y, m, 1); break;
    case "last3Months": from = new Date(y, m - 2, 1); until = new Date(y, m + 1, 1); break;
    case "thisYear": from = new Date(y, 0, 1); until = new Date(y + 1, 0, 1); break;
    case "lastYear": from = new Date(y - 1, 0, 1); until = new Date(y, 0, 1); break;
    case "custom": {
      const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(displayDate(s).getTime());
      if (!valid(start) || !valid(end)) return { error: "Choose a start and end date." };
      if (start > end) return { error: "End date must be on or after start date." };
      from = displayDate(start); until = displayDate(end);
      until.setDate(until.getDate() + 1);
      break;
    }
  }
  return { from: from?.getTime(), until: until?.getTime(), error: "" };
}

export function inExpenseRange(raw: string | undefined, range: ReturnType<typeof expenseRange>) {
  if (range.error) return false;
  if (range.from === undefined && range.until === undefined) return true;
  if (!raw) return false;
  const time = displayDate(raw).getTime();
  return Number.isFinite(time) && (range.from === undefined || time >= range.from) && (range.until === undefined || time < range.until);
}
