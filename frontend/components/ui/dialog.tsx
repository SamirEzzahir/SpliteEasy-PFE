// components/ui/dialog.tsx — accessible modal dialog (Tailwind, no Radix).
// Closes on Esc / backdrop click, locks scroll, traps initial focus, aria-modal.
"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
  open, onClose, title, description, children, footer, className,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_.15s_ease]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-md rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(11,15,26,.28)]",
          "outline-none animate-[dialogIn_.2s_cubic-bezier(.22,.61,.36,1)]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-6 border-b border-[var(--line-2)] p-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-[var(--ink-3)]">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-[9px] text-[var(--ink-3)] hover:bg-[var(--line-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2.5 border-t border-[var(--line-2)] p-4">{footer}</div>}
      </div>
    </div>
  );
}
