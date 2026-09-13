"use client";
import { useRef } from "react";

export default function PageTabs<T extends string>({ id, label, value, onChange, items }: {
  id: string; label: string; value: T; onChange: (value: T) => void;
  items: Array<{ value: T; label: string }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return <div className="page-tabs" role="tablist" aria-label={label} ref={ref} onKeyDown={(event) => {
    const current = items.findIndex((item) => item.value === value);
    const next = event.key === "ArrowRight" ? (current + 1) % items.length : event.key === "ArrowLeft" ? (current - 1 + items.length) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); onChange(items[next].value);
    ref.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }}>{items.map((item) => <button key={item.value} type="button" role="tab" id={`${id}-${item.value}`} aria-controls={`${id}-panel-${item.value}`}
    aria-selected={value === item.value} tabIndex={value === item.value ? 0 : -1} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}
