// components/ui/button.tsx — shadcn-style Button (Tailwind + CSS variables).
"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-white hover:brightness-110 active:brightness-95 shadow-sm",
  secondary:
    "bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--line-2)]",
  ghost: "text-[var(--ink-2)] hover:bg-[var(--line-2)]",
  danger:
    "bg-[var(--rose-soft)] text-[var(--rose)] hover:brightness-105 border border-transparent",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px] gap-1.5 rounded-[10px]",
  md: "h-10 px-4 text-sm gap-2 rounded-[12px]",
  icon: "h-9 w-9 rounded-[10px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]",
        "disabled:opacity-50 disabled:pointer-events-none select-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
