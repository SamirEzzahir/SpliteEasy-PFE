"use client";
// app/admin/analytics/page.tsx — platform analytics with date range + granularity.

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import FilterDropdown from "@/components/ui/FilterDropdown";
import StatCard from "@/components/ui/StatCard";
import { SkeletonStatCard } from "@/components/Skeleton";
import LineChart from "@/components/admin/LineChart";
import { adminApi, type AnalyticsResult } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

const METRICS: { key: string; label: string; color: string; tone: "primary" | "success" | "info" | "warn" | "danger" | "neutral" }[] = [
  { key: "users", label: "New users", color: "var(--primary)", tone: "primary" },
  { key: "expenses", label: "Expenses created", color: "var(--success)", tone: "success" },
  { key: "groups", label: "Groups created", color: "var(--sky)", tone: "info" },
  { key: "settlements", label: "Settlements", color: "var(--teal, var(--sky))", tone: "info" },
  { key: "tickets", label: "Support tickets", color: "var(--warn)", tone: "warn" },
  { key: "reports", label: "Moderation reports", color: "var(--rose)", tone: "danger" },
];

const GRANULARITY = [
  { id: "day", label: "Daily" },
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AdminAnalyticsPage() {
  const [from, setFrom] = useState(isoDaysAgo(29));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [granularity, setGranularity] = useState("day");
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await adminApi.analytics({ from, to, granularity })); }
    catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [from, to, granularity]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Platform growth and activity" />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 18 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>From</label>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>To</label>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        <FilterDropdown icon="filter" label="Granularity" options={GRANULARITY} value={granularity} onChange={setGranularity} />
      </div>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 22 }}>
        {loading || !data
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)
          : METRICS.map((m) => (
              <StatCard key={m.key} icon="bars" label={m.label} value={String(data.totals[m.key] ?? 0)} tone={m.tone} />
            ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {METRICS.map((m) => (
          <div key={m.key} className="card admin-chart-card">
            <h3>{m.label}</h3>
            <p className="sub">{from} → {to}</p>
            {data && !loading ? <LineChart data={data.series[m.key] ?? []} color={m.color} /> : <div style={{ height: 180 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
