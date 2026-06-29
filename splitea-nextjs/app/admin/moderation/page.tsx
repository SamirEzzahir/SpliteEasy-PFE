"use client";
// app/admin/moderation/page.tsx — moderation queue: filter reports, drill into one.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import FilterDropdown from "@/components/ui/FilterDropdown";
import Icon from "@/components/Icon";
import DataTable, { type Column } from "@/components/admin/DataTable";
import { fmtDateTime, ReportStatusBadge } from "@/components/admin/ui";
import { adminApi, type ModerationReport } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

const STATUS_FILTER = [
  { id: "", label: "All statuses" },
  { id: "open", label: "Open" },
  { id: "reviewing", label: "Reviewing" },
  { id: "dismissed", label: "Dismissed" },
  { id: "actioned", label: "Actioned" },
];
const REASON_FILTER = [
  { id: "", label: "All reasons" },
  { id: "spam", label: "Spam" },
  { id: "abuse", label: "Abuse" },
  { id: "fake_account", label: "Fake account" },
  { id: "inappropriate", label: "Inappropriate" },
  { id: "other", label: "Other" },
];

export default function AdminModerationPage() {
  const [rows, setRows] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.reports({ page, page_size: 20, status: status || undefined, reason: reason || undefined, q: debouncedQ || undefined });
      setRows(res.items); setTotal(res.total); setPages(res.pages);
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [page, status, reason, debouncedQ]);

  useEffect(() => { void load(); }, [load]);

  const columns: Column<ModerationReport>[] = [
    {
      key: "target", header: "Target",
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--ink)" }}>{r.target_username || `${r.target_type} #${r.target_id}`}</div>
          <div style={{ fontSize: 12, color: "var(--ink-4)", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.target_type} · {r.description || "—"}</div>
        </div>
      ),
    },
    { key: "reason", header: "Reason", render: (r) => <span className="admin-badge-pill is-neutral">{r.reason.replace("_", " ")}</span> },
    { key: "reporter", header: "Reporter", render: (r) => r.reporter_username ?? `#${r.reporter_id ?? "?"}` },
    { key: "status", header: "Status", render: (r) => <ReportStatusBadge status={r.status} /> },
    { key: "created_at", header: "Reported", render: (r) => fmtDateTime(r.created_at) },
    {
      key: "actions", header: "", align: "right",
      render: (r) => (
        <div className="admin-row-actions">
          <Link href={`/admin/moderation/${r.id}`} className="admin-icon-btn" title="Review"><Icon name="chevR" size={15} /></Link>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Moderation" subtitle={`${total} ${total === 1 ? "report" : "reports"}`} />
      <DataTable<ModerationReport>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search report details…"
        filters={
          <>
            <FilterDropdown icon="filter" label="Status" options={STATUS_FILTER} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
            <FilterDropdown icon="filter" label="Reason" options={REASON_FILTER} value={reason} onChange={(v) => { setReason(v); setPage(1); }} />
          </>
        }
        emptyIcon="alertTriangle"
        emptyTitle="No reports"
        emptyMessage="User-submitted reports will appear here."
        mobileCard={(r) => (
          <Link href={`/admin/moderation/${r.id}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 600 }}>{r.target_username || `${r.target_type} #${r.target_id}`}</div>
              <ReportStatusBadge status={r.status} />
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{r.reason.replace("_", " ")} · {r.reporter_username ?? "—"} · {fmtDateTime(r.created_at)}</div>
          </Link>
        )}
        page={page}
        totalPages={pages}
        onPage={setPage}
        summary={`${total} ${total === 1 ? "report" : "reports"}`}
      />
    </div>
  );
}
