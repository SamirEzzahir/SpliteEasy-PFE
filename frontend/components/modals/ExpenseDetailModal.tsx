"use client";
// components/modals/ExpenseDetailModal.tsx — read-only expense preview

import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { categoryById, personById } from "@/lib/data";
import { fmt } from "@/lib/format";
import type { Expense, Group } from "@/lib/types";

interface Props {
  expense: Expense;
  group: Group;
  onClose: () => void;
  onEdit: () => void;
}

export default function ExpenseDetailModal({ expense: e, group, onClose, onEdit }: Props) {
  const cat = categoryById(e.categoryId);
  const payer = personById(e.paidBy);
  const currency = group.currency || e.currency || "USD";
  const participants = e.splitIds.length > 0 ? e.splitIds : group.memberIds;
  const sharePerPerson = e.amount / Math.max(1, participants.length);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-md" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 520 }}>

        {/* Header */}
        <div className="modal-h with-icon">
          <div className="modal-h-titlewrap">
            <div className="modal-icon" style={{ background: cat.soft, color: cat.color }}>
              <Icon name={cat.icon} size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: 18 }}>{e.title}</h2>
              <p style={{ fontSize: 13 }}>{e.subtitle || cat.name}</p>
            </div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="modal-b" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Amount */}
          <div className="detail-block">
            <span className="detail-lbl"><Icon name="coin" size={14} /> Amount</span>
            <span className="detail-val big" style={{ color: "var(--primary)" }}>
              {fmt(e.amount, currency)}
            </span>
          </div>

          {/* Category & Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="detail-block">
              <span className="detail-lbl"><Icon name={cat.icon} size={14} /> Category</span>
              <span className="cat-pill" style={{ background: cat.pillBg, color: cat.pillFg, marginTop: 4, width: "fit-content" }}>
                {cat.name}
              </span>
            </div>
            <div className="detail-block">
              <span className="detail-lbl"><Icon name="receipt" size={14} /> Date</span>
              <span className="detail-val">{e.date || "—"}</span>
              {e.time && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{e.time}</span>}
            </div>
          </div>

          {/* Payer */}
          <div className="detail-block">
            <span className="detail-lbl"><Icon name="account" size={14} /> Paid by</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <Avatar id={e.paidBy} size="md" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>
                  {payer.you ? payer.name + " (You)" : payer.name}
                </div>
                {payer.email && <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{payer.email}</div>}
              </div>
            </div>
          </div>

          {/* Split between */}
          <div className="detail-block">
            <span className="detail-lbl"><Icon name="groups" size={14} /> Split between ({participants.length})</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {participants.map((id) => {
                const p = personById(id);
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar id={id} size="sm" />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
                      {p.you ? p.name + " (You)" : p.name}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                      {fmt(sharePerPerson, currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Group */}
          <div className="detail-block">
            <span className="detail-lbl"><Icon name="groups" size={14} /> Group</span>
            <span className="detail-val">{group.name}</span>
          </div>

          {/* Note / Added by */}
          <div className="detail-block" style={{ background: "var(--surface-2, #f8f9fa)", borderRadius: 10, padding: "10px 14px" }}>
            <span className="detail-lbl"><Icon name="receipt" size={14} /> Note</span>
            <span style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4, display: "block" }}>
              Added by <strong style={{ color: "var(--ink)" }}>{e.addedByUsername ?? "—"}</strong> on {e.date} {e.time}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-f">
          <div />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            <button className="btn btn-primary" onClick={onEdit}>
              <Icon name="edit" size={14} /> Edit Expense
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
