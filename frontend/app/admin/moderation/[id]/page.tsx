"use client";
// app/admin/moderation/[id]/page.tsx — review a report: status, notes, warn, and a
// jump to the reported user (where suspend/ban already live — no duplicated logic).

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/Icon";
import Skeleton from "@/components/Skeleton";
import { fmtDateTime, promptSelect, promptText, ReportStatusBadge } from "@/components/admin/ui";
import { usePerms } from "@/components/admin/usePerms";
import { adminApi, type ModerationReport } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

export default function AdminReportPage() {
  const params = useParams<{ id: string }>();
  const reportId = Number(params.id);
  const { has } = usePerms();
  const canManage = has("manage_moderation");

  const [report, setReport] = useState<ModerationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await adminApi.report(reportId);
      setReport(r);
      setNotes(r.notes || "");
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [reportId]);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus() {
    const next = await promptSelect({
      title: "Set report status",
      options: { open: "Open", reviewing: "Reviewing", dismissed: "Dismissed", actioned: "Actioned" },
      confirmText: "Apply",
    });
    if (next === null) return;
    try { await adminApi.reportStatus(reportId, next); toast.success("Status updated"); void load(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  async function saveNotes() {
    try { await adminApi.reportNotes(reportId, notes); toast.success("Notes saved"); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  async function warn() {
    const msg = await promptText({ title: "Warn user", label: "Warning message (optional)", placeholder: "Leave blank for the default warning", confirmText: "Send warning" });
    // promptText requires input; allow cancel.
    if (msg === null) return;
    try { await adminApi.warnReport(reportId, msg || undefined); toast.success("Warning sent"); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  return (
    <div>
      <PageHeader
        title={report ? `Report #${report.id}` : "Report"}
        breadcrumbs={[{ label: "Moderation", href: "/admin/moderation" }, { label: report ? `#${report.id}` : "…" }]}
      />

      {loading || !report ? (
        <div className="card" style={{ padding: 22 }}><Skeleton width="40%" height={20} /><Skeleton width="80%" height={14} style={{ marginTop: 12 }} /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 18, alignItems: "start" }} className="admin-detail-grid">
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <ReportStatusBadge status={report.status} />
              <span className="admin-badge-pill is-neutral">{report.reason.replace("_", " ")}</span>
            </div>
            <dl className="admin-kv">
              <dt>Target</dt><dd>{report.target_username ? `${report.target_username} (user #${report.target_id})` : `${report.target_type} #${report.target_id}`}</dd>
              <dt>Reporter</dt><dd>{report.reporter_username || `#${report.reporter_id ?? "?"}`}</dd>
              <dt>Reported</dt><dd>{fmtDateTime(report.created_at)}</dd>
              <dt>Handled by</dt><dd>{report.handled_by_username || "—"}</dd>
            </dl>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: "var(--ink-4)", marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: 13.5, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{report.description || "—"}</div>
            </div>
            <div className="field" style={{ marginTop: 16, marginBottom: 0 }}>
              <label>Internal notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canManage}
                rows={4}
                style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13.5, outline: "none", background: "var(--surface)", color: "var(--ink)", resize: "vertical", fontFamily: "inherit" }}
              />
              {canManage && (
                <button className="btn btn-ghost" style={{ marginTop: 8, alignSelf: "flex-start" }} onClick={saveNotes}><Icon name="check" size={14} /> Save notes</button>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 12px" }}>Actions</h3>
            {!canManage ? (
              <p style={{ fontSize: 13, color: "var(--ink-4)" }}>You have read-only access.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn btn-ghost admin-action-btn" onClick={changeStatus}><Icon name="settle" size={15} /> Change status</button>
                {report.target_type === "user" && (
                  <>
                    <button className="btn btn-ghost admin-action-btn" onClick={warn}><Icon name="alertTriangle" size={15} /> Warn user</button>
                    <Link href={`/admin/users/${report.target_id}`} className="btn btn-ghost admin-action-btn" style={{ textDecoration: "none" }}>
                      <Icon name="friends" size={15} /> Open user (suspend / ban)
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
