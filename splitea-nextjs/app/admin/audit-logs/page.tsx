"use client";
// app/admin/audit-logs/page.tsx — immutable trail of admin actions, filterable.

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import FilterDropdown from "@/components/ui/FilterDropdown";
import DataTable, { type Column } from "@/components/admin/DataTable";
import { fmtDateTime } from "@/components/admin/ui";
import { adminApi, type AuditLog } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

// Common action prefixes for quick filtering (the backend filters on exact action,
// but these top-level groups are the useful ones to scan by).
const ACTION_OPTIONS = [
  { id: "", label: "All actions" },
  { id: "user.status.suspended", label: "User suspended" },
  { id: "user.status.banned", label: "User banned" },
  { id: "user.delete", label: "User deleted" },
  { id: "user.role", label: "Role assigned" },
  { id: "user.force_logout", label: "Force logout" },
  { id: "group.delete", label: "Group deleted" },
  { id: "expense.delete", label: "Expense deleted" },
  { id: "settlement.cancel", label: "Settlement cancelled" },
  { id: "role.update", label: "Role updated" },
];

function prettyAction(a: string): string {
  return a.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminAuditLogsPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.auditLogs({ page, page_size: 30, action: action || undefined });
      setRows(res.items); setTotal(res.total); setPages(res.pages);
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [page, action]);

  useEffect(() => { void load(); }, [load]);

  const columns: Column<AuditLog>[] = [
    { key: "action", header: "Action", render: (l) => <span style={{ fontWeight: 600, color: "var(--ink)" }}>{prettyAction(l.action)}</span> },
    { key: "admin", header: "Admin", render: (l) => l.admin_username ?? <span style={{ color: "var(--ink-4)" }}>system</span> },
    {
      key: "target", header: "Target",
      render: (l) => l.target_type ? `${l.target_type}${l.target_id ? ` #${l.target_id}` : ""}` : <span style={{ color: "var(--ink-4)" }}>—</span>,
    },
    { key: "details", header: "Details", render: (l) => <span style={{ color: "var(--ink-3)" }}>{l.details || "—"}</span> },
    { key: "ip", header: "IP", render: (l) => <span style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 12 }}>{l.ip || "—"}</span> },
    { key: "created_at", header: "When", render: (l) => fmtDateTime(l.created_at) },
  ];

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle={`${total} recorded ${total === 1 ? "action" : "actions"}`} />
      <DataTable<AuditLog>
        columns={columns}
        rows={rows}
        rowKey={(l) => l.id}
        loading={loading}
        filters={
          <FilterDropdown icon="filter" label="Action" options={ACTION_OPTIONS} value={action} onChange={(v) => { setAction(v); setPage(1); }} />
        }
        emptyIcon="activity"
        emptyTitle="No audit entries"
        emptyMessage="Administrative actions will be recorded here."
        mobileCard={(l) => (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 600 }}>{prettyAction(l.action)}</div>
              <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{fmtDateTime(l.created_at)}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
              {l.admin_username || "system"}
              {l.target_type ? ` · ${l.target_type}${l.target_id ? ` #${l.target_id}` : ""}` : ""}
              {l.details ? ` · ${l.details}` : ""}
            </div>
          </>
        )}
        page={page}
        totalPages={pages}
        onPage={setPage}
        summary={`${total} ${total === 1 ? "entry" : "entries"}`}
      />
    </div>
  );
}
