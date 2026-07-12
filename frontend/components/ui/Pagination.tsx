"use client";
// components/ui/Pagination.tsx — canonical ellipsis pagination (1 … 4 5 6 … 20).
// Used by Expenses, Group Detail, and Groups so all three match.

import { useMemo } from "react";
import Icon from "@/components/Icon";

interface Props {
  page: number;          // current page (1-based)
  totalPages: number;
  onChange: (page: number) => void;
  /** Optional left-side summary text, e.g. "1–7 of 232 items". */
  summary?: string;
}

export default function Pagination({ page, totalPages, onChange, summary }: Props) {
  const pages = useMemo(() => {
    const out: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) out.push(i);
    } else {
      out.push(1);
      if (page > 3) out.push("…");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) out.push(i);
      if (page < totalPages - 2) out.push("…");
      out.push(totalPages);
    }
    return out;
  }, [page, totalPages]);

  return (
    <div className="pag" style={{ paddingBottom: 8 }}>
      {summary != null && <span>{summary}</span>}
      <div className="pag-pages">
        <button className="pag-btn" disabled={page === 1} onClick={() => onChange(Math.max(1, page - 1))} aria-label="Previous page">
          <Icon name="chevR" size={12} style={{ transform: "rotate(180deg)" }} />
        </button>
        {pages.map((n, i) =>
          n === "…" ? (
            <span key={`el-${i}`} style={{ padding: "0 4px", color: "var(--ink-4)", fontSize: 13, userSelect: "none" }}>…</span>
          ) : (
            <button
              key={n}
              className={"pag-btn" + (n === page ? " active" : "")}
              onClick={() => onChange(n)}
              aria-current={n === page ? "page" : undefined}
            >
              {n}
            </button>
          )
        )}
        <button className="pag-btn" disabled={page === totalPages} onClick={() => onChange(Math.min(totalPages, page + 1))} aria-label="Next page">
          <Icon name="chevR" size={12} />
        </button>
      </div>
    </div>
  );
}
