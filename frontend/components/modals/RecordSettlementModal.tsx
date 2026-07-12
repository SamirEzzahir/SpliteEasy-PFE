"use client";
// components/modals/RecordSettlementModal.tsx

import { useState } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { fmt } from "@/lib/format";

interface Recipient {
  id: number;
  username: string;
  amount: number; // amount you owe/are owed
  label: string;  // "You owe X" or "You lent X"
}

interface Props {
  currency?: string;
  myId: number;
  myUsername?: string;
  currentBalance: number;   // positive = you owe, negative = you lent
  recipients: Recipient[];  // people you owe money to
  defaultRecipientId?: number;
  defaultAmount?: number;
  onClose: () => void;
  onConfirm: (toUserId: number, amount: number, message?: string) => Promise<void>;
}

export default function RecordSettlementModal({
  currency = "MAD",
  myId,
  myUsername = "You",
  currentBalance,
  recipients,
  defaultRecipientId,
  defaultAmount,
  onClose,
  onConfirm,
}: Props) {
  const initialId = defaultRecipientId ?? (defaultAmount != null ? recipients[0]?.id : 0) ?? 0;
  const [selectedId, setSelectedId] = useState<number>(initialId);
  const [amount, setAmount] = useState<string>(
    defaultAmount != null
      ? String(defaultAmount)
      : defaultRecipientId
        ? String(recipients.find((r) => r.id === defaultRecipientId)?.amount ?? "")
        : ""
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = recipients.find((r) => r.id === selectedId) ?? recipients[0];
  const parsedAmount = parseFloat(amount) || 0;

  const balanceLabel =
    currentBalance > 0
      ? `${fmt(currentBalance, currency)} (You lent)`
      : currentBalance < 0
      ? `${fmt(Math.abs(currentBalance), currency)} (You owe)`
      : "Settled";

  const handleRecipientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    setSelectedId(id);
    const r = recipients.find((r) => r.id === id);
    if (r) setAmount(String(r.amount));
    else setAmount("");
  };

  const handleConfirm = async () => {
    if (!selected || !selectedId || parsedAmount <= 0) return;
    setSaving(true);
    try {
      await onConfirm(selected.id, parsedAmount, message || undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-md"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 700, width: "100%" }}
      >
        {/* Header */}
        <div className="modal-h">
          <div>
            <h2 style={{ fontSize: 18, margin: 0 }}>Record Settlement</h2>
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "3px 0 0" }}>
              Settle up balances for this group.
            </p>
          </div>
          <button className="modal-x" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="modal-b settle-modal-grid">
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Balance chip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: currentBalance >= 0 ? "var(--success-soft)" : "var(--rose-soft)",
                color: currentBalance >= 0 ? "var(--success)" : "var(--rose)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              <Icon name="info" size={15} />
              <span style={{ color: "var(--ink-3)", fontWeight: 400, marginRight: 4 }}>
                Current balance:
              </span>
              {balanceLabel}
            </div>

            {/* SETTLE WITH */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="form-label">Settle with</label>
              {recipients.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ink-3)", padding: "10px 0" }}>
                  No one owes you in this group.
                </p>
              ) : (
                <select
                  className="form-input"
                  value={selectedId || ""}
                  onChange={handleRecipientChange}
                  style={{ appearance: "auto", cursor: "pointer" }}
                >
                  {!defaultRecipientId && (
                    <option value="" disabled>Select a member…</option>
                  )}
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.username} — {r.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* AMOUNT */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="form-label">Amount</label>
              <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                <span
                  style={{
                    padding: "0 14px",
                    display: "flex",
                    alignItems: "center",
                    background: "var(--surface-2, #f3f4f6)",
                    borderRight: "1px solid var(--line)",
                    fontSize: 13,
                    color: "var(--ink-3)",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {currency}
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    padding: "10px 12px",
                    fontSize: 14,
                    fontWeight: 600,
                    background: "var(--surface)",
                    color: "var(--ink)",
                  }}
                />
              </div>
            </div>

            {/* MESSAGE */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="form-label">Message (optional)</label>
              <textarea
                className="form-input"
                placeholder="Add a note..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                style={{ resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
          </div>

          {/* Right column — preview */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              background: "var(--surface-2, #f8f9fa)",
              borderRadius: 14,
              padding: "28px 20px",
            }}
          >
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", margin: 0 }}>
              Settlement Preview
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* From: You */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <Avatar id={String(myId)} size="lg" />
                <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>You</span>
              </div>

              {/* Arrow + amount */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: parsedAmount > 0 ? "var(--success)" : "var(--ink-3)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt(parsedAmount, currency)}
                </div>
                <Icon name="settle" size={22} style={{ color: "var(--primary)" }} />
              </div>

              {/* To: Recipient */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                {selected ? (
                  <Avatar id={String(selected.id)} size="lg" />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "var(--line)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      color: "var(--ink-3)",
                    }}
                  >
                    ?
                  </div>
                )}
                <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>
                  {selected?.username ?? "Recipient"}
                </span>
              </div>
            </div>

            <p
              style={{
                fontSize: 13,
                color: "var(--ink-3)",
                textAlign: "center",
                background: "var(--surface)",
                borderRadius: 10,
                padding: "10px 14px",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              You are recording a payment of{" "}
              <strong style={{ color: "var(--ink)" }}>{fmt(parsedAmount, currency)}</strong> to{" "}
              <strong style={{ color: "var(--ink)" }}>{selected?.username ?? "..."}</strong>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-f" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={saving || parsedAmount <= 0 || !selected}
            style={{ minWidth: 160 }}
          >
            {saving ? "Confirming…" : "Confirm Settlement"}
          </button>
        </div>
      </div>
    </div>
  );
}
