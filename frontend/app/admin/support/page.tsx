"use client";
// app/admin/support/page.tsx — admin ticket queue: search, filter, drill into a ticket.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import FilterDropdown from "@/components/ui/FilterDropdown";
import Icon from "@/components/Icon";
import DataTable, { type Column } from "@/components/admin/DataTable";
import {
  StatusBadge, PriorityBadge, CategoryBadge, fmtWhen,
  STATUS_OPTIONS, PRIORITY_OPTIONS,
} from "@/components/support/ui";
import { adminApi } from "@/lib/api/admin";
import type { Ticket } from "@/lib/api/support";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

const STATUS_FILTER = [{ id: "", label: "All statuses" }, ...STATUS_OPTIONS];
const PRIORITY_FILTER = [{ id: "", label: "All priorities" }, ...PRIORITY_OPTIONS];

export default function AdminSupportPage() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.tickets({ page, page_size: 20, q: debouncedQ || undefined, status: status || undefined, priority: priority || undefined });
      setRows(res.items); setTotal(res.total); setPages(res.pages);
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [page, debouncedQ, status, priority]);

  useEffect(() => { void load(); }, [load]);

  const columns: Column<Ticket>[] = [
    {
      key: "subject", header: "Ticket",
      render: (t) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--ink)" }}>{t.subject}</div>
          <div style={{ fontSize: 12, color: "var(--ink-4)" }}>#{t.id} · {t.reply_count} repl{t.reply_count === 1 ? "y" : "ies"}</div>
        </div>
      ),
    },
    { key: "requester", header: "From", render: (t) => t.requester_username ?? `#${t.user_id}` },
    { key: "category", header: "Category", render: (t) => <CategoryBadge category={t.category} /> },
    { key: "priority", header: "Priority", render: (t) => <PriorityBadge priority={t.priority} /> },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
    { key: "assignee", header: "Assignee", render: (t) => t.assignee_username ?? <span style={{ color: "var(--ink-4)" }}>Unassigned</span> },
    { key: "updated_at", header: "Updated", render: (t) => fmtWhen(t.updated_at) },
    {
      key: "actions", header: "", align: "right",
      render: (t) => (
        <div className="admin-row-actions">
          <Link href={`/admin/support/${t.id}`} className="admin-icon-btn" title="Open ticket"><Icon name="chevR" size={15} /></Link>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Support" subtitle={`${total} ${total === 1 ? "ticket" : "tickets"}`} />
      <DataTable<Ticket>
        columns={columns}
        rows={rows}
        rowKey={(t) => t.id}
        loading={loading}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search tickets…"
        filters={
          <>
            <FilterDropdown icon="filter" label="Status" options={STATUS_FILTER} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
            <FilterDropdown icon="filter" label="Priority" options={PRIORITY_FILTER} value={priority} onChange={(v) => { setPriority(v); setPage(1); }} />
          </>
        }
        emptyIcon="chat"
        emptyTitle="No tickets"
        emptyMessage="User-submitted tickets will appear here."
        mobileCard={(t) => (
          <Link href={`/admin/support/${t.id}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 600 }}>{t.subject}</div>
              <StatusBadge status={t.status} />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <PriorityBadge priority={t.priority} />
              <CategoryBadge category={t.category} />
              <span style={{ fontSize: 12, color: "var(--ink-4)", marginLeft: "auto" }}>{t.requester_username ?? `#${t.user_id}`} · {fmtWhen(t.updated_at)}</span>
            </div>
          </Link>
        )}
        page={page}
        totalPages={pages}
        onPage={setPage}
        summary={`${total} ${total === 1 ? "ticket" : "tickets"}`}
      />
    </div>
  );
}
