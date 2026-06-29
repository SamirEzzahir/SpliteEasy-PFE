"use client";
// components/support/ReportModal.tsx — user-facing "report content" dialog.
// Reusable across the app (report a user, group, expense, message).

import { useState } from "react";
import Icon from "@/components/Icon";
import { reportsApi, REPORT_REASON_OPTIONS, type CreateReportPayload } from "@/lib/api/reports";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

interface Props {
  targetType: CreateReportPayload["target_type"];
  targetId: number;
  targetLabel?: string;
  onClose: () => void;
}

export default function ReportModal({ targetType, targetId, targetLabel, onClose }: Props) {
  const [reason, setReason] = useState<CreateReportPayload["reason"]>("spam");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await reportsApi.create({ target_type: targetType, target_id: targetId, reason, description: description.trim() || undefined });
      toast.success("Report submitted — our team will review it");
      onClose();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,15,26,.45)", zIndex: 300, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 480, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Report {targetLabel || targetType}</h2>
          <button className="btn btn-ghost" style={{ padding: 8 }} onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="field">
          <label>Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value as CreateReportPayload["reason"])}>
            {REPORT_REASON_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Details (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any context that will help us review this report"
            rows={4}
            maxLength={2000}
            style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13.5, outline: "none", background: "var(--surface)", color: "var(--ink)", resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit report"}</button>
        </div>
      </div>
    </div>
  );
}
