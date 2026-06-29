"use client";
// app/admin/groups/page.tsx — every group on the platform: search, delete, transfer ownership.

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/Icon";
import DataTable, { type Column } from "@/components/admin/DataTable";
import { fmtDate, confirmAction, promptText } from "@/components/admin/ui";
import { usePerms } from "@/components/admin/usePerms";
import { adminApi, type AdminGroup } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

export default function AdminGroupsPage() {
  const { has } = usePerms();
  const canManage = has("manage_groups");

  const [rows, setRows] = useState<AdminGroup[]>([]);
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
      const res = await adminApi.groups({ page, page_size: 20, q: debouncedQ || undefined });
      setRows(res.items); setTotal(res.total); setPages(res.pages);
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [page, debouncedQ]);

  useEffect(() => { void load(); }, [load]);

  async function remove(g: AdminGroup) {
    const ok = await confirmAction({ title: `Delete "${g.title}"?`, text: "All its expenses, splits and messages are removed. This cannot be undone.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try { await adminApi.deleteGroup(g.id); toast.success("Group deleted"); void load(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  async function transfer(g: AdminGroup) {
    const idStr = await promptText({ title: `Transfer "${g.title}"`, label: "New owner — user ID", inputType: "text", placeholder: "e.g. 42", confirmText: "Transfer" });
    if (!idStr) return;
    const newOwnerId = Number(idStr);
    if (!Number.isInteger(newOwnerId) || newOwnerId <= 0) { toast.error("Enter a valid numeric user ID"); return; }
    try { await adminApi.transferOwner(g.id, newOwnerId); toast.success("Ownership transferred"); void load(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  const columns: Column<AdminGroup>[] = [
    {
      key: "title", header: "Group",
      render: (g) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--ink)" }}>{g.title}</div>
          <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{g.type || "—"} · {g.currency || "—"}</div>
        </div>
      ),
    },
    { key: "owner", header: "Owner", render: (g) => g.owner_username ?? <span style={{ color: "var(--ink-4)" }}>—</span> },
    { key: "members", header: "Members", align: "right", render: (g) => String(g.members_count) },
    { key: "expenses", header: "Expenses", align: "right", render: (g) => String(g.expenses_count) },
    { key: "created_at", header: "Created", render: (g) => fmtDate(g.created_at) },
    {
      key: "actions", header: "", align: "right",
      render: (g) => canManage ? (
        <div className="admin-row-actions">
          <button className="admin-icon-btn" title="Transfer ownership" onClick={() => transfer(g)}><Icon name="crown" size={15} /></button>
          <button className="admin-icon-btn danger" title="Delete group" onClick={() => remove(g)}><Icon name="trash" size={15} /></button>
        </div>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="Groups" subtitle={`${total} ${total === 1 ? "group" : "groups"}`} />
      <DataTable<AdminGroup>
        columns={columns}
        rows={rows}
        rowKey={(g) => g.id}
        loading={loading}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search groups by title…"
        emptyIcon="groups"
        emptyTitle="No groups found"
        emptyMessage="Try a different search."
        mobileCard={(g) => (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{g.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-4)" }}>Owner: {g.owner_username || "—"}</div>
              </div>
              {canManage && (
                <div className="admin-row-actions">
                  <button className="admin-icon-btn" onClick={() => transfer(g)}><Icon name="crown" size={15} /></button>
                  <button className="admin-icon-btn danger" onClick={() => remove(g)}><Icon name="trash" size={15} /></button>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{g.members_count} members · {g.expenses_count} expenses · {fmtDate(g.created_at)}</div>
          </>
        )}
        page={page}
        totalPages={pages}
        onPage={setPage}
        summary={`${total} ${total === 1 ? "group" : "groups"}`}
      />
    </div>
  );
}
