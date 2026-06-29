"use client";
// app/admin/settlements/page.tsx — platform settlements: filter by status, cancel.

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import FilterDropdown from "@/components/ui/FilterDropdown";
import Icon from "@/components/Icon";
import DataTable, { type Column } from "@/components/admin/DataTable";
import { fmtDate, confirmAction, SettlementBadge } from "@/components/admin/ui";
import { usePerms } from "@/components/admin/usePerms";
import { fmt } from "@/lib/format";
import { adminApi, type AdminSettlement } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

const STATUS_OPTIONS = [
  { id: "", label: "All statuses" },
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
];

export default function AdminSettlementsPage() {
  const { has } = usePerms();
  const canManage = has("manage_settlements");

  const [rows, setRows] = useState<AdminSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.settlements({ page, page_size: 20, status: status || undefined });
      setRows(res.items); setTotal(res.total); setPages(res.pages);
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [page, status]);

  useEffect(() => { void load(); }, [load]);

  async function cancel(s: AdminSettlement) {
    const ok = await confirmAction({ title: "Cancel this settlement?", text: `${s.from_username || "User"} → ${s.to_username || "User"} · ${fmt(s.amount, "MAD")}. It will be marked rejected.`, confirmText: "Cancel settlement", danger: true });
    if (!ok) return;
    try { await adminApi.cancelSettlement(s.id); toast.success("Settlement cancelled"); void load(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  const columns: Column<AdminSettlement>[] = [
    {
      key: "parties", header: "Payment",
      render: (s) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "var(--ink)" }}>
          {s.from_username || `#${s.from_user_id}`}
          <Icon name="chevR" size={13} style={{ color: "var(--ink-4)" }} />
          {s.to_username || `#${s.to_user_id}`}
        </div>
      ),
    },
    { key: "amount", header: "Amount", align: "right", render: (s) => <span style={{ fontWeight: 600 }}>{fmt(s.amount, "MAD")}</span> },
    { key: "status", header: "Status", render: (s) => <SettlementBadge status={s.status} /> },
    { key: "created_at", header: "Date", render: (s) => fmtDate(s.created_at) },
    {
      key: "actions", header: "", align: "right",
      render: (s) => (canManage && s.status !== "rejected") ? (
        <div className="admin-row-actions">
          <button className="admin-icon-btn danger" title="Cancel settlement" onClick={() => cancel(s)}><Icon name="x" size={15} /></button>
        </div>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="Settlements" subtitle={`${total} ${total === 1 ? "settlement" : "settlements"}`} />
      <DataTable<AdminSettlement>
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        loading={loading}
        filters={
          <FilterDropdown icon="filter" label="Status" options={STATUS_OPTIONS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
        }
        emptyIcon="settle"
        emptyTitle="No settlements found"
        emptyMessage="Try a different status filter."
        mobileCard={(s) => (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>{s.from_username || `#${s.from_user_id}`} → {s.to_username || `#${s.to_user_id}`}</div>
              <SettlementBadge status={s.status} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>{fmt(s.amount, "MAD")}</span>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{fmtDate(s.created_at)}</span>
              {canManage && s.status !== "rejected" && (
                <button className="admin-icon-btn danger" onClick={() => cancel(s)}><Icon name="x" size={15} /></button>
              )}
            </div>
          </>
        )}
        page={page}
        totalPages={pages}
        onPage={setPage}
        summary={`${total} ${total === 1 ? "settlement" : "settlements"}`}
      />
    </div>
  );
}
