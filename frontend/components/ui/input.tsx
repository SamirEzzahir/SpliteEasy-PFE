// components/ui/input.tsx — shadcn-style Input + Field label (Tailwind).
"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-[12px] border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[15px] text-[var(--ink)]",
        "placeholder:text-[var(--ink-4)] transition-shadow",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:border-[var(--primary)]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export function Field({
  label, hint, children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--ink-2)]">
        {label}
        {hint && <span className="ml-1 font-normal text-[var(--ink-4)]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
