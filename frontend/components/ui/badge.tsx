// components/ui/badge.tsx — shadcn-style status Badge (Tailwind + CSS variables).
import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "danger" | "warn" | "primary";

const TONES: Record<Tone, string> = {
  neutral: "bg-[var(--line-2)] text-[var(--ink-3)]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  danger: "bg-[var(--rose-soft)] text-[var(--rose)]",
  warn: "bg-[var(--warn-soft)] text-[var(--warn)]",
  primary: "bg-[var(--primary-soft)] text-[var(--primary)]",
};

export function Badge({
  tone = "neutral", className, ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
