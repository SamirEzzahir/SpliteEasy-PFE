"use client";
// app/admin/users/[id]/page.tsx — single user: profile, related counts, and the
// full set of admin actions (role, status, reset password, force logout, delete).

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Icon from "@/components/Icon";
import Skeleton from "@/components/Skeleton";
import {
  StatusBadge, fmtDate, fmtDateTime, confirmAction, promptText, promptSelect, UserAvatar,
} from "@/components/admin/ui";
import { usePerms } from "@/components/admin/usePerms";
import { adminApi, type AdminUserDetail, type AdminRole } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = Number(params.id);
  const { has } = usePerms();
  const canManage = has("manage_users");

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = await adminApi.user(userId);
      setUser(u);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!canManage) return;
    adminApi.roles().then(setRoles).catch(() => {});
  }, [canManage]);

  async function changeRole() {
    if (!user) return;
    const options: Record<string, string> = { "": "— No role —" };
    roles.forEach((r) => { options[String(r.id)] = r.name; });
    const choice = await promptSelect({ title: `Assign role to ${user.username}`, options, confirmText: "Assign" });
    if (choice === null) return;
    try {
      await adminApi.setUserRole(user.id, choice === "" ? null : Number(choice));
      toast.success("Role updated");
      void load();
    } catch (e) { toast.error(apiErrorMessage(e)); }
  }

  async function changeStatus() {
    if (!user) return;
    const status = await promptSelect({
      title: `Set status for ${user.username}`,
      options: { active: "Active", suspended: "Suspended", banned: "Banned" },
      confirmText: "Apply",
    });
    if (status === null) return;
    let reason: string | undefined;
    if (status !== "active") {
      const r = await promptText({ title: "Reason", label: "Add a reason (optional, shown in the audit log)", placeholder: "e.g. spam reports" });
      // promptText requires input; allow cancel to abort the whole action.
      if (r === null) return;
      reason = r;
    }
    try {
      await adminApi.setUserStatus(user.id, status, reason);
      toast.success(`Status set to ${status}`);
      void load();
    } catch (e) { toast.error(apiErrorMessage(e)); }
  }

  async function resetPassword() {
    if (!user) return;
    const pw = await promptText({ title: `Reset password for ${user.username}`, label: "New password (min 6 chars)", inputType: "password", confirmText: "Reset" });
    if (!pw) return;
    try {
      await adminApi.resetPassword(user.id, pw);
      toast.success("Password reset — the user's sessions were revoked");
    } catch (e) { toast.error(apiErrorMessage(e)); }
  }

  async function forceLogout() {
    if (!user) return;
    const ok = await confirmAction({ title: `Force logout ${user.username}?`, text: "All of their active sessions will be revoked.", confirmText: "Force logout", danger: true });
    if (!ok) return;
    try {
      await adminApi.forceLogout(user.id);
      toast.success("Sessions revoked");
    } catch (e) { toast.error(apiErrorMessage(e)); }
  }

  async function verifyEmail() {
    if (!user) return;
    try {
      await adminApi.verifyEmail(user.id);
      toast.success("Email marked verified");
      void load();
    } catch (e) { toast.error(apiErrorMessage(e)); }
  }

  async function deleteUser() {
    if (!user) return;
    const ok = await confirmAction({ title: `Delete ${user.username}?`, text: "This permanently removes the account and all their data. This cannot be undone.", confirmText: "Delete permanently", danger: true });
    if (!ok) return;
    try {
      await adminApi.deleteUser(user.id);
      toast.success("User deleted");
      router.replace("/admin/users");
    } catch (e) { toast.error(apiErrorMessage(e)); }
  }

  return (
    <div>
      <PageHeader
        title={user ? user.username : "User"}
        breadcrumbs={[{ label: "Users", href: "/admin/users" }, { label: user?.username ?? "…" }]}
      />

      {loading || !user ? (
        <div className="card" style={{ padding: 24 }}>
          <Skeleton width="40%" height={22} />
          <Skeleton width="70%" height={14} style={{ marginTop: 12 }} />
          <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 18, alignItems: "start" }} className="admin-detail-grid">
          {/* Left: profile + related */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <UserAvatar name={user.username} size={52} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{user.username}</h2>
                    <StatusBadge status={user.status} />
                  </div>
                  <div style={{ color: "var(--ink-3)", fontSize: 13.5 }}>{user.email}</div>
                </div>
              </div>
              <dl className="admin-kv">
                <dt>Full name</dt><dd>{[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}</dd>
                <dt>Phone</dt><dd>{user.phone || "—"}</dd>
                <dt>Role</dt><dd>{user.role?.name ?? "—"}</dd>
                <dt>Email verified</dt><dd>{user.email_verified ? "Yes" : "No"}</dd>
                <dt>Status reason</dt><dd>{user.status_reason || "—"}</dd>
                <dt>Preferred currency</dt><dd>{user.preferred_currency || "—"}</dd>
                <dt>Last login</dt><dd>{fmtDateTime(user.last_login_at)}</dd>
                <dt>Joined</dt><dd>{fmtDate(user.created_at)}</dd>
              </dl>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 12 }}>
              <StatCard icon="groups" label="Memberships" value={String(user.groups_count)} tone="info" />
              <StatCard icon="crown" label="Owned groups" value={String(user.owned_groups_count)} tone="primary" />
              <StatCard icon="expense" label="Expenses paid" value={String(user.expenses_count)} tone="neutral" />
              <StatCard icon="settle" label="Settlements" value={String(user.settlements_count)} tone="success" />
            </div>
          </div>

          {/* Right: actions */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 14px" }}>Actions</h3>
            {!canManage ? (
              <p style={{ fontSize: 13, color: "var(--ink-4)" }}>You have read-only access to users.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn btn-ghost admin-action-btn" onClick={changeStatus}><Icon name="lock" size={15} /> Change status</button>
                <button className="btn btn-ghost admin-action-btn" onClick={changeRole}><Icon name="shield" size={15} /> Assign role</button>
                {!user.email_verified && (
                  <button className="btn btn-ghost admin-action-btn" onClick={verifyEmail}><Icon name="check" size={15} /> Verify email</button>
                )}
                <button className="btn btn-ghost admin-action-btn" onClick={resetPassword}><Icon name="edit" size={15} /> Reset password</button>
                <button className="btn btn-ghost admin-action-btn" onClick={forceLogout}><Icon name="settle" size={15} /> Force logout</button>
                <button className="btn admin-action-btn" style={{ color: "var(--rose)", background: "var(--rose-soft)" }} onClick={deleteUser}><Icon name="trash" size={15} /> Delete user</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
