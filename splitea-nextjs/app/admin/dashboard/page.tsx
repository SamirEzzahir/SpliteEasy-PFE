"use client";
// app/admin/dashboard/page.tsx — platform overview: KPI cards, trend charts, recent admin activity.

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonStatCard } from "@/components/Skeleton";
import Icon from "@/components/Icon";
import MiniChart from "@/components/admin/MiniChart";
import { fmtDateTime } from "@/components/admin/ui";
import { adminApi, type DashboardStats, type AuditLog } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

const STAT_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
  marginBottom: 22,
};

function prettyAction(a: string): string {
  return a.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, a] = await Promise.all([adminApi.overview(), adminApi.recentActivity(8)]);
        if (!alive) return;
        setStats(s);
        setActivity(a.items);
      } catch (e) {
        toast.error(apiErrorMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview and recent activity" />

      {loading || !stats ? (
        <div style={STAT_GRID}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
      ) : (
        <div style={STAT_GRID}>
          <StatCard icon="friends" label="Total users" value={String(stats.total_users)} tone="primary"
            sub={`${stats.new_users_7d} new this week`} />
          <StatCard icon="check" label="Active users" value={String(stats.active_users)} tone="success" />
          <StatCard icon="lock" label="Suspended / banned" value={String(stats.suspended_users + stats.banned_users)} tone="warn" />
          <StatCard icon="groups" label="Groups" value={String(stats.total_groups)} tone="info" />
          <StatCard icon="expense" label="Expenses" value={String(stats.total_expenses)} tone="neutral" />
          <StatCard icon="settle" label="Settlements" value={String(stats.total_settlements)} tone="primary"
            sub={`${stats.pending_settlements} pending`} />
          <StatCard icon="chat" label="Open tickets" value={String(stats.pending_support)} tone="warn" />
        </div>
      )}

      {/* Trend charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 22 }}>
        <div className="card admin-chart-card">
          <h3>New signups</h3>
          <p className="sub">Last 14 days</p>
          {stats ? <MiniChart data={stats.signups_last_14d} color="var(--primary)" /> : null}
        </div>
        <div className="card admin-chart-card">
          <h3>Expenses created</h3>
          <p className="sub">Last 14 days</p>
          {stats ? <MiniChart data={stats.expenses_last_14d} color="var(--success)" /> : null}
        </div>
      </div>

      {/* Recent admin activity */}
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 14px" }}>Recent admin activity</h3>
        {activity.length === 0 ? (
          <EmptyState icon="activity" title="No activity yet" message="Admin actions will appear here." tone="neutral" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {activity.map((log) => (
              <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line-2)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--primary-soft)", color: "var(--primary)", flexShrink: 0 }}>
                  <Icon name="shield" size={15} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{prettyAction(log.action)}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                    {log.admin_username || "system"}
                    {log.target_type ? ` · ${log.target_type}${log.target_id ? ` #${log.target_id}` : ""}` : ""}
                    {log.details ? ` · ${log.details}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", flexShrink: 0 }}>{fmtDateTime(log.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
