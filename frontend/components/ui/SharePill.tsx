"use client";
// components/ui/SharePill.tsx — canonical "Your Share" badge.
// owe = rose pill, lent = green pill, neutral = muted text ("—" / "Even").

import type { ReactNode } from "react";

interface Props {
  kind: "owe" | "lent" | "neutral";
  children: ReactNode;
}

const STYLE: Record<"owe" | "lent", { background: string; color: string }> = {
  owe:  { background: "var(--rose-soft)",    color: "var(--rose)" },
  lent: { background: "var(--success-soft)", color: "var(--success)" },
};

export default function SharePill({ kind, children }: Props) {
  if (kind === "neutral") {
    return <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{children}</span>;
  }
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 9px", borderRadius: 8, fontSize: 12, fontWeight: 700,
        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
        ...STYLE[kind],
      }}
    >
      {children}
    </span>
  );
}
