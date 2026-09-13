"use client";
import { useId, useState, type ReactNode } from "react";
import Icon from "@/components/Icon";

export default function FilterPanel({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="responsive-filters">
    <button type="button" className="btn btn-secondary mobile-filter-toggle" aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(!open)}><Icon name="filter" size={16} />Filters{count > 0 ? ` (${count})` : ""}</button>
    <div id={id} className={`responsive-filter-content${open ? " is-open" : ""}`}>{children}</div>
  </div>;
}
