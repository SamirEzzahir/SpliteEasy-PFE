"use client";
// components/ui/EmptyState.tsx — canonical empty state: icon + message + optional CTA.

import type { ReactNode } from "react";
import Icon from "@/components/Icon";

interface Props {
  icon?: string;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  tone?: "primary" | "success" | "neutral";
}

const TONE = {
  primary: { bg: "var(--primary-soft)", fg: "var(--primary)" },
  success: { bg: "var(--success-soft)", fg: "var(--success)" },
  neutral: { bg: "var(--line-2)",       fg: "var(--ink-3)" },
};

export default function EmptyState({ icon = "receipt", title, message, action, tone = "primary" }: Props) {
  const t = TONE[tone];
  return (
    <div className="ui-empty">
      <div className="ui-empty-ic" style={{ background: t.bg, color: t.fg }}>
        <Icon name={icon} size={24} />
      </div>
      <div className="ui-empty-title">{title}</div>
      {message && <div className="ui-empty-msg">{message}</div>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  );
}
