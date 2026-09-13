"use client";
import { useId, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { fmt } from "@/lib/format";
interface Recipient {
  id: string;
  username: string;
  amount: number; // amount you owe/are owed
  label: string;  // "You owe X" or "You lent X"
}

interface Props {
  currency?: string;
  myId: string;
  myUsername?: string;
  currentBalance: number;   // positive = you are owed, negative = you owe
  recipients: Recipient[];  // people you owe money to
  defaultRecipientId?: string;
  defaultAmount?: number;
  onClose: () => void;
  onConfirm: (toUserId: string, amount: number, message?: string) => Promise<void>;
}


export default function RecordSettlementModal({ currency = "MAD", myUsername = "You", recipients, defaultRecipientId, defaultAmount, onClose, onConfirm }: Props) {
  const formId = useId();
  const [selectedId, setSelectedId] = useState(defaultRecipientId || "");
  const [amount, setAmount] = useState(defaultAmount != null ? String(defaultAmount) : String(recipients.find((r) => r.id === defaultRecipientId)?.amount || ""));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = recipients.find((r) => r.id === selectedId);
  const number = Number(amount);
  const valid = !!selected && Number.isFinite(number) && number > 0;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!valid || saving) return;
    setSaving(true); setError("");
    try { await onConfirm(selectedId, number, message.trim() || undefined); onClose(); }
    catch { setError("Could not record this payment. Your entries are still here. Please try again."); }
    finally { setSaving(false); }
  }
  return <Dialog open onClose={onClose} busy={saving} title="Record a payment"
    description="Record money you have already paid. The recipient will confirm receipt."
    footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
      <button type="submit" form={formId} className="btn btn-primary" disabled={!valid || saving}>{saving ? "Recording…" : "Record payment"}</button></>}>
    <form id={formId} onSubmit={submit} className="expense-form"><fieldset disabled={saving}>
      <label>Paid to<select required value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setAmount(String(recipients.find((r) => r.id === e.target.value)?.amount || "")); }}>
        <option value="">Choose a recipient</option>{recipients.map((r) => <option key={r.id} value={r.id}>{r.username}</option>)}
      </select></label>
      <label>Amount ({currency})<input type="number" inputMode="decimal" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
      {selected && <p className="split-feedback is-valid">{myUsername} → {selected.username}<br /><strong>{fmt(number || 0, currency)}</strong></p>}
      <label>Note (optional)<textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Paid by bank transfer" /></label>
      <p className="field-help">This records a payment; it does not send money.</p>
    </fieldset>{error && <p role="alert" className="form-error">{error}</p>}</form>
  </Dialog>;
}
