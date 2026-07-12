"use client";
// app/admin/expenses/page.tsx — every expense on the platform: search and delete.

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/Icon";
import DataTable, { type Column } from "@/components/admin/DataTable";
import { fmtDate, confirmAction } from "@/components/admin/ui";
import { usePerms } from "@/components/admin/usePerms";
import { fmt } from "@/lib/format";
import { adminApi, type AdminExpense } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

export default function AdminExpensesPage() {
  const { has } = usePerms();
  const canManage = has("manage_expenses");

  const [rows, setRows] = useState<AdminExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.expenses({ page, page_size: 20, q: debouncedQ || undefined });
      setRows(res.items); setTotal(res.total); setPages(res.pages);
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [page, debouncedQ]);

  useEffect(() => { void load(); }, [load]);

  async function remove(e: AdminExpense) {
    const ok = await confirmAction({ title: "Delete this expense?", text: `"${e.description}" — ${fmt(e.amount, e.currency ?? "MAD")}. This cannot be undone.`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try { await adminApi.deleteExpense(e.id); toast.success("Expense deleted"); void load(); }
    catch (err) { toast.error(apiErrorMessage(err)); }
  }

  const columns: Column<AdminExpense>[] = [
    {
      key: "description", header: "Expense",
      render: (e) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--ink)" }}>{e.description || "—"}</div>
          <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{e.category || "Uncategorized"}</div>
        </div>
      ),
    },
    { key: "group", header: "Group", render: (e) => e.group_title ?? `#${e.group_id}` },
    { key: "payer", header: "Paid by", render: (e) => e.payer_username ?? <span style={{ color: "var(--ink-4)" }}>—</span> },
    { key: "amount", header: "Amount", align: "right", render: (e) => <span style={{ fontWeight: 600 }}>{fmt(e.amount, e.currency ?? "MAD")}</span> },
    { key: "created_at", header: "Date", render: (e) => fmtDate(e.created_at) },
    {
      key: "actions", header: "", align: "right",
      render: (e) => canManage ? (
        <div className="admin-row-actions">
          <button className="admin-icon-btn danger" title="Delete expense" onClick={() => remove(e)}><Icon name="trash" size={15} /></button>
        </div>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="Expenses" subtitle={`${total} ${total === 1 ? "expense" : "expenses"}`} />
      <DataTable<AdminExpense>
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        loading={loading}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search expenses by description…"
        emptyIcon="expense"
        emptyTitle="No expenses found"
        emptyMessage="Try a different search."
        mobileCard={(e) => (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{e.description || "—"}</div>
                <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{e.group_title ?? `#${e.group_id}`} · {e.payer_username || "—"}</div>
              </div>
              <div style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(e.amount, e.currency ?? "MAD")}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{fmtDate(e.created_at)}</span>
              {canManage && (
                <button className="admin-icon-btn danger" onClick={() => remove(e)}><Icon name="trash" size={15} /></button>
              )}
            </div>
          </>
        )}
        page={page}
        totalPages={pages}
        onPage={setPage}
        summary={`${total} ${total === 1 ? "expense" : "expenses"}`}
      />
    </div>
  );
}
