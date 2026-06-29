"use client";
// components/admin/DataTable.tsx — the one data table for every admin list page.
// Bundles: search toolbar + filters + table (reusing .exp-table) + a mobile card
// fallback + skeleton loading + empty state + the shared <Pagination>.

import type { ReactNode } from "react";
import Icon from "@/components/Icon";
import Skeleton from "@/components/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;

  // Toolbar
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;

  // Empty state
  emptyIcon?: string;
  emptyTitle: string;
  emptyMessage?: ReactNode;
  emptyAction?: ReactNode;

  // Optional mobile card fallback (renders ≤760px instead of the table)
  mobileCard?: (row: T) => ReactNode;

  // Pagination
  page?: number;
  totalPages?: number;
  onPage?: (page: number) => void;
  summary?: string;
}

export default function DataTable<T>({
  columns, rows, rowKey, loading,
  search, onSearch, searchPlaceholder = "Search…", filters, actions,
  emptyIcon = "search", emptyTitle, emptyMessage, emptyAction,
  mobileCard, page, totalPages, onPage, summary,
}: Props<T>) {
  const hasToolbar = onSearch || filters || actions;
  const showEmpty = !loading && rows.length === 0;

  return (
    <div>
      {hasToolbar && (
        <div className="admin-toolbar">
          {onSearch && (
            <div className="admin-search">
              <Icon name="search" size={15} />
              <input
                value={search ?? ""}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Search"
              />
            </div>
          )}
          {filters}
          {actions && <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>{actions}</div>}
        </div>
      )}

      {showEmpty ? (
        <div className="card" style={{ padding: 8 }}>
          <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} action={emptyAction} />
        </div>
      ) : (
        <>
          {/* Desktop / wide: table */}
          <div className={"card " + (mobileCard ? "admin-desktop" : "")} style={{ padding: 0, overflow: "hidden" }}>
            <div className="admin-table-wrap">
              <table className="exp-table">
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key} style={{ textAlign: c.align ?? "left" }}>{c.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={`sk-${i}`}>
                          {columns.map((c) => (
                            <td key={c.key}><Skeleton width="70%" height={14} /></td>
                          ))}
                        </tr>
                      ))
                    : rows.map((row) => (
                        <tr key={rowKey(row)}>
                          {columns.map((c) => (
                            <td key={c.key} style={{ textAlign: c.align ?? "left" }}>
                              {c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}
                            </td>
                          ))}
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: card fallback */}
          {mobileCard && (
            <div className="admin-mobile">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={`skm-${i}`} className="gx-exp-card">
                      <Skeleton width="60%" height={16} />
                      <Skeleton width="40%" height={13} />
                    </div>
                  ))
                : rows.map((row) => (
                    <div key={rowKey(row)} className="gx-exp-card">{mobileCard(row)}</div>
                  ))}
            </div>
          )}

          {onPage && totalPages != null && totalPages > 1 && (
            <div style={{ marginTop: 16 }}>
              <Pagination page={page ?? 1} totalPages={totalPages} onChange={onPage} summary={summary} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
