"use client";
// components/modals/SettlementDetailModal.tsx

import { useState } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { fmt } from "@/lib/format";
import type { ApiSettlement } from "@/lib/api/types";

interface Props {
  settlement: ApiSettlement;
  myId: number;
  currency: string;
  onClose: () => void;
  onAccept: (id: number) => Promise<void>;
  onReject: (id: number) => Promise<void>;
}

const STATUS_STYLE: Record<string, { bg: string; label: string; pillClass: string }> = {
  pending:  { bg: "linear-gradient(90deg,#f59e0b,#f97316)", label: "🕐 Pending",  pillClass: "st-pill pending"  },
  accepted: { bg: "linear-gradient(90deg,#10b981,#059669)", label: "✅ Accepted", pillClass: "st-pill accepted" },
  rejected: { bg: "linear-gradient(90deg,#f43f5e,#e11d48)", label: "❌ Rejected", pillClass: "st-pill rejected" },
};

function fmtFull(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export default function SettlementDetailModal({ settlement: s, myId, currency, onClose, onAccept, onReject }: Props) {
  const [acting, setActing] = useState(false);
  const style = STATUS_STYLE[s.status] ?? STATUS_STYLE.pending;

  const canAct = s.status === "pending" && s.to_user_id === myId;

  const handleAccept = async () => {
    setActing(true);
    try { await onAccept(s.id); } finally { setActing(false); }
  };
  const handleReject = async () => {
    setActing(true);
    try { await onReject(s.id); } finally { setActing(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>

        {/* Header — color reflects status */}
        <div
          className="modal-h"
          style={{ background: style.bg, borderRadius: "14px 14px 0 0", padding: "16px 20px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: 10, padding: 8, display: "flex" }}>
              <Icon name="settle" size={20} style={{ color: "#fff" }} />
            </div>
            <div>
              <h2 style={{ fontSize: 17, margin: 0, color: "#fff", fontWeight: 700 }}>Settlement Details</h2>
              <p style={{ fontSize: 12.5, margin: "2px 0 0", color: "rgba(255,255,255,0.8)" }}>
                Group payment record
              </p>
            </div>
          </div>
          <button
            className="modal-x"
            onClick={onClose}
            style={{ color: "#fff", background: "rgba(255,255,255,0.2)", border: "none" }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="modal-b" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* From → To */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, background: "var(--surface-2,#f8f9fa)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
              <Avatar id={String(s.from_user_id)} size="lg" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{s.from_username ?? `User ${s.from_user_id}`}</span>
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Payer</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
                {fmt(s.amount, currency)}
              </span>
              <Icon name="settle" size={22} style={{ color: "var(--primary)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
              <Avatar id={String(s.to_user_id)} size="lg" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{s.to_username ?? `User ${s.to_user_id}`}</span>
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Receiving</span>
            </div>
          </div>

          {/* Amount + Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="detail-block">
              <span className="detail-lbl"><Icon name="coin" size={14} /> Amount</span>
              <span className="detail-val big" style={{ color: "var(--success)" }}>{fmt(s.amount, currency)}</span>
            </div>
            <div className="detail-block">
              <span className="detail-lbl"><Icon name="receipt" size={14} /> Status</span>
              <span className={style.pillClass} style={{ marginTop: 6, display: "inline-flex" }}>{style.label}</span>
            </div>
          </div>

          {/* Date */}
          <div className="detail-block">
            <span className="detail-lbl"><Icon name="receipt" size={14} /> Date</span>
            <span className="detail-val">{fmtFull(s.created_at)}</span>
          </div>

          {/* Message / note */}
          {(s.message || s.description) && (
            <div className="detail-block" style={{ background: "var(--surface-2,#f8f9fa)", borderRadius: 10, padding: "10px 14px" }}>
              <span className="detail-lbl"><Icon name="receipt" size={14} /> Note</span>
              <span style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4, display: "block" }}>
                {s.message || s.description}
              </span>
            </div>
          )}

          {/* Rejected reason */}
          {s.status === "rejected" && s.rejected_reason && (
            <div className="detail-block" style={{ background: "var(--rose-soft)", borderRadius: 10, padding: "10px 14px" }}>
              <span className="detail-lbl" style={{ color: "var(--rose)" }}><Icon name="x" size={14} /> Rejection reason</span>
              <span style={{ fontSize: 13, color: "var(--rose)", marginTop: 4, display: "block" }}>
                {s.rejected_reason}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-f" style={{ justifyContent: "flex-end" }}>
          {canAct ? (
            <>
              <button className="btn btn-secondary" onClick={onClose} disabled={acting}>Close</button>
              <button
                className="btn btn-secondary"
                style={{ color: "var(--rose)", borderColor: "var(--rose-soft)" }}
                disabled={acting}
                onClick={handleReject}
              >
                <Icon name="x" size={13} /> Reject
              </button>
              <button className="btn btn-primary" disabled={acting} onClick={handleAccept}>
                <Icon name="check" size={13} /> {acting ? "Confirming…" : "Accept"}
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}
