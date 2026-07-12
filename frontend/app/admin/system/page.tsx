"use client";
// app/admin/system/page.tsx — platform health: service status, version, uptime, host metrics.

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/Icon";
import Skeleton from "@/components/Skeleton";
import { adminApi, type SystemHealth } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}

function StatusCard({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: ok ? "var(--success-soft)" : "var(--rose-soft)", color: ok ? "var(--success)" : "var(--rose)" }}>
        <Icon name={ok ? "check" : "x"} size={18} />
      </div>
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{detail ?? (ok ? "Operational" : "Down")}</div>
      </div>
    </div>
  );
}

function MetricBar({ label, percent }: { label: string; percent: number | null }) {
  const available = percent != null;
  const tone = !available ? "var(--ink-4)" : percent > 85 ? "var(--rose)" : percent > 60 ? "var(--warn)" : "var(--success)";
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: tone }}>{available ? `${Math.round(percent)}%` : "unavailable"}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "var(--line-2)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${available ? percent : 0}%`, background: tone, transition: "width .3s" }} />
      </div>
    </div>
  );
}

export default function AdminSystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setHealth(await adminApi.system()); }
    catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 2000); // light auto-refresh
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <PageHeader
        title="System"
        subtitle="Platform health & diagnostics"
        actions={<button className="btn btn-ghost" onClick={load}><Icon name="settle" size={15} /> Refresh</button>}
      />

      {loading || !health ? (
        <div className="card" style={{ padding: 22 }}><Skeleton width="40%" height={18} /><Skeleton width="70%" height={14} style={{ marginTop: 12 }} /></div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 14, marginBottom: 18 }}>
            <StatusCard label="Backend API" ok={health.backend === "ok"} />
            <StatusCard label="Database" ok={health.database === "ok"} detail={health.database === "ok" ? "Connected" : "Unreachable"} />
            <StatusCard label="WebSocket" ok={health.websocket.status === "ok"} detail={`${health.websocket.active_connections} active connection${health.websocket.active_connections === 1 ? "" : "s"}`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 14, marginBottom: 18 }}>
            <MetricBar label="CPU" percent={health.cpu_percent} />
            <MetricBar label="Memory" percent={health.memory_percent} />
            <MetricBar label="Disk" percent={health.disk_percent} />
          </div>

          <div className="card" style={{ padding: 20 }}>
            <dl className="admin-kv">
              <dt>App version</dt><dd>{health.app_version}</dd>
              <dt>Build</dt><dd>{health.build_version}</dd>
              <dt>Uptime</dt><dd>{uptime(health.uptime_seconds)}</dd>
              <dt>Host metrics</dt><dd>{health.metrics_available ? "available (psutil)" : "unavailable — install psutil"}</dd>
            </dl>
          </div>
        </>
      )}
    </div>
  );
}
