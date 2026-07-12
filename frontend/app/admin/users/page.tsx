"use client";
// app/admin/users/page.tsx — user directory: search, filter, sort, paginate.
// Heavy per-user actions live on the detail page (/admin/users/[id]).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import FilterDropdown from "@/components/ui/FilterDropdown";
import Icon from "@/components/Icon";
import DataTable, { type Column } from "@/components/admin/DataTable";
import { StatusBadge, fmtDate, confirmAction, UserAvatar } from "@/components/admin/ui";
import { usePerms } from "@/components/admin/usePerms";
import { adminApi, type AdminUser } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

const STATUS_OPTIONS = [
  { id: "", label: "All statuses" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
  { id: "banned", label: "Banned" },
];

const SORT_OPTIONS = [
  { id: "created_at:desc", label: "Newest first" },
  { id: "created_at:asc", label: "Oldest first" },
  { id: "username:asc", label: "Name A–Z" },
  { id: "last_login_at:desc", label: "Recently active" },
];

export default function AdminUsersPage() {
  const { has } = usePerms();
  const canManage = has("manage_users");

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("created_at:desc");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sortKey, order] = sort.split(":");
      const res = await adminApi.users({
        page, page_size: 20, q: debouncedQ || undefined, status: status || undefined,
        sort: sortKey, order,
      });
      setRows(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQ, status, sort]);

  useEffect(() => { void load(); }, [load]);

  async function quickToggleStatus(u: AdminUser) {
    const makeActive = u.status !== "active";
    const ok = await confirmAction({
      title: makeActive ? `Reactivate ${u.username}?` : `Suspend ${u.username}?`,
      text: makeActive ? "The user will regain access." : "The user will be blocked from signing in.",
      confirmText: makeActive ? "Reactivate" : "Suspend",
      danger: !makeActive,
    });
    if (!ok) return;
    try {
      await adminApi.setUserStatus(u.id, makeActive ? "active" : "suspended");
      toast.success(`${u.username} ${makeActive ? "reactivated" : "suspended"}`);
      void load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  const columns: Column<AdminUser>[] = [
    {
      key: "user", header: "User",
      render: (u) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <UserAvatar name={u.username} size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "var(--ink)" }}>{u.username}</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (u) => u.role?.name ?? <span style={{ color: "var(--ink-4)" }}>—</span> },
    { key: "status", header: "Status", render: (u) => <StatusBadge status={u.status} /> },
    { key: "last_login_at", header: "Last login", render: (u) => fmtDate(u.last_login_at) },
    { key: "created_at", header: "Joined", render: (u) => fmtDate(u.created_at) },
    {
      key: "actions", header: "", align: "right",
      render: (u) => (
        <div className="admin-row-actions">
          {canManage && (
            <button className="admin-icon-btn" title={u.status === "active" ? "Suspend" : "Reactivate"} onClick={() => quickToggleStatus(u)}>
              <Icon name="lock" size={15} />
            </button>
          )}
          <Link href={`/admin/users/${u.id}`} className="admin-icon-btn" title="View details">
            <Icon name="chevR" size={15} />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Users" subtitle={`${total} ${total === 1 ? "user" : "users"} on the platform`} />
      <DataTable<AdminUser>
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        loading={loading}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search by name or email…"
        filters={
          <>
            <FilterDropdown icon="filter" label="Status" options={STATUS_OPTIONS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
            <FilterDropdown icon="sortArrows" label="Sort" options={SORT_OPTIONS} value={sort} onChange={(v) => { setSort(v); setPage(1); }} />
          </>
        }
        emptyIcon="friends"
        emptyTitle="No users found"
        emptyMessage="Try adjusting your search or filters."
        mobileCard={(u) => (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <UserAvatar name={u.username} size={36} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{u.username}</div>
                <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{u.email}</div>
              </div>
              <StatusBadge status={u.status} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{u.role?.name ?? "No role"} · joined {fmtDate(u.created_at)}</span>
              <Link href={`/admin/users/${u.id}`} className="btn btn-ghost" style={{ textDecoration: "none", padding: "6px 10px" }}>
                View <Icon name="chevR" size={14} />
              </Link>
            </div>
          </>
        )}
        page={page}
        totalPages={pages}
        onPage={setPage}
        summary={`${total} ${total === 1 ? "user" : "users"}`}
      />
    </div>
  );
}
