"use client";
// components/support/ui.tsx — shared ticket vocabulary + badges used by BOTH the
// user portal (/support) and the admin panel (/admin/support). Badges are
// self-styled (inline) so they don't depend on admin-only CSS.

export const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  feature: "Feature Request",
  account: "Account",
  payment: "Payment",
  other: "Other",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_user: "Waiting for User",
  resolved: "Resolved",
  closed: "Closed",
};

export function fmtWhen(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label }));
export const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([id, label]) => ({ id, label }));
export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label }));

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
        whiteSpace: "nowrap", background: bg, color: fg,
      }}
    >
      {label}
    </span>
  );
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  open: { bg: "var(--primary-soft)", fg: "var(--primary)" },
  in_progress: { bg: "var(--sky-soft)", fg: "var(--sky)" },
  waiting_user: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  resolved: { bg: "var(--success-soft)", fg: "var(--success)" },
  closed: { bg: "var(--line-2)", fg: "var(--ink-3)" },
};

const PRIORITY_TONE: Record<string, { bg: string; fg: string }> = {
  low: { bg: "var(--line-2)", fg: "var(--ink-3)" },
  medium: { bg: "var(--sky-soft)", fg: "var(--sky)" },
  high: { bg: "var(--rose-soft)", fg: "var(--rose)" },
};

export function StatusBadge({ status }: { status: string }) {
  const t = STATUS_TONE[status] ?? STATUS_TONE.closed;
  return <Pill label={STATUS_LABELS[status] ?? status} bg={t.bg} fg={t.fg} />;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const t = PRIORITY_TONE[priority] ?? PRIORITY_TONE.low;
  return <Pill label={PRIORITY_LABELS[priority] ?? priority} bg={t.bg} fg={t.fg} />;
}

export function CategoryBadge({ category }: { category: string }) {
  return <Pill label={CATEGORY_LABELS[category] ?? category} bg="var(--line-2)" fg="var(--ink-2)" />;
}
