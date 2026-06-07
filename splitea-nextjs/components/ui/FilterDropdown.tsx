"use client";
// components/ui/FilterDropdown.tsx — canonical filter control.
// Promoted from app/expenses/page.tsx so every page uses the same active-state
// dropdown instead of bare native <select>.

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

interface Option { id: string; label: string }

interface Props {
  icon: string;
  label: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
}

export default function FilterDropdown({ icon, label, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== options[0]?.id;
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="dropdown"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={active ? { borderColor: "var(--primary)", background: "var(--primary-soft)", color: "var(--primary)" } : undefined}
      >
        <Icon name={icon} size={14} className="ic" style={active ? { color: "var(--primary)" } : undefined} />
        {selected?.label ?? label}
        {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", flexShrink: 0 }} />}
        <Icon name="chev" size={12} className="chev" />
      </button>
      {open && (
        <div role="listbox" style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
          background: "var(--surface)", border: "1px solid var(--line)",
          borderRadius: 12, boxShadow: "var(--shadow-lg)", minWidth: 190, padding: "6px 0",
        }}>
          {options.map((o) => (
            <button
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              onClick={() => { onChange(o.id); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "9px 14px", background: "none",
                border: "none", fontSize: 13, cursor: "pointer", textAlign: "left",
                color: o.id === value ? "var(--primary)" : "var(--ink)",
                fontWeight: o.id === value ? 600 : 400,
              }}
            >
              {o.id === value
                ? <Icon name="check" size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />
                : <span style={{ width: 13, flexShrink: 0 }} />}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
