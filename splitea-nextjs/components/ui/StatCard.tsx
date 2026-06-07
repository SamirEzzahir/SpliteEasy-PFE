"use client";
// components/ui/StatCard.tsx — the single canonical stat card for the whole app.
// Replaces .dash-stat-card / .groups-summary / .gx-stat / ad-hoc .stat-c usages.

import type { ReactNode } from "react";
import Icon from "@/components/Icon";
import { fmt } from "@/lib/format";

export type StatTone = "primary" | "success" | "danger" | "warn" | "info" | "neutral";

const TONE: Record<StatTone, { bg: string; fg: string }> = {
  primary: { bg: "var(--primary-soft)", fg: "var(--primary)" },
  success: { bg: "var(--success-soft)", fg: "var(--success)" },
  danger:  { bg: "var(--rose-soft)",    fg: "var(--rose)" },
  warn:    { bg: "var(--warn-soft)",    fg: "var(--warn)" },
  info:    { bg: "var(--sky-soft)",     fg: "var(--sky)" },
  neutral: { bg: "var(--line-2)",       fg: "var(--ink-3)" },
};

interface Props {
  icon: string;
  label: string;
  /** Pass a number + currency to auto-format, or a preformatted string/node. */
  value: ReactNode | number;
  currency?: string;
  sub?: ReactNode;
  tone?: StatTone;
  /** Color the value with the tone color (default true). Set false for plain ink. */
  colorValue?: boolean;
  /** Makes the card an interactive button (e.g. clickable summary filters). */
  onClick?: () => void;
  active?: boolean;
  title?: string;
}

export default function StatCard({
  icon, label, value, currency, sub,
  tone = "neutral", colorValue = true, onClick, active, title,
}: Props) {
  const t = TONE[tone];
  const displayValue =
    typeof value === "number" ? fmt(value, currency ?? "MAD") : value;

  const inner = (
    <>
      <div className="ui-stat-ic" style={{ background: t.bg, color: t.fg }}>
        <Icon name={icon} size={22} />
      </div>
      <div className="ui-stat-body">
        <div className="ui-stat-lbl">{label}</div>
        <div className="ui-stat-val num" style={colorValue && tone !== "neutral" ? { color: t.fg } : undefined}>
          {displayValue}
        </div>
        {sub != null && <div className="ui-stat-sub">{sub}</div>}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={"ui-stat-card ui-stat-card--btn" + (active ? " active" : "")}
        onClick={onClick}
        title={title}
      >
        {inner}
      </button>
    );
  }
  return <div className="ui-stat-card">{inner}</div>;
}
