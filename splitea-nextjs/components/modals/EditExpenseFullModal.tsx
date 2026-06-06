"use client";
// components/modals/EditExpenseFullModal.tsx — full expense editing flow

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { fmt } from "@/lib/format";
import { CATEGORIES, categoryById, personById } from "@/lib/data";
import { useApp } from "@/lib/store";
import { expensesApi } from "@/lib/api/expenses";
import type { Expense } from "@/lib/types";

interface Props {
  expense: Expense;
  onClose: () => void;
  onSaved: () => Promise<void>;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export default function EditExpenseFullModal({ expense: initial, onClose, onSaved, showToast }: Props) {
  const { groups } = useApp();
  const group = useMemo(() => groups.find((g) => g.id === initial.groupId) || groups[0], [groups, initial.groupId]);

  const [title, setTitle] = useState(initial.title);
  const [amount, setAmount] = useState(String(initial.amount));
  const [paidBy, setPaidBy] = useState(initial.paidBy);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [date, setDate] = useState(initial.date || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
  const [note, setNote] = useState("");
  const [splitIds, setSplitIds] = useState<string[]>(
    initial.splitIds.length > 0 ? initial.splitIds : (group?.memberIds ?? []),
  );
  const [splitType, setSplitType] = useState<"equal" | "percentage" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customPcts, setCustomPcts] = useState<Record<string, string>>({});
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync splitIds if group loads late
  useEffect(() => {
    if (group && splitIds.length === 0) {
      setSplitIds(group.memberIds.slice());
    }
  }, [group]);

  const num = parseFloat(amount) || 0;
  const equalShare = splitIds.length ? num / splitIds.length : 0;
  const equalPct = splitIds.length ? 100 / splitIds.length : 0;

  const getShare = (id: string): number => {
    if (!splitIds.includes(id)) return 0;
    if (splitType === "equal") return equalShare;
    if (splitType === "percentage") return ((parseFloat(customPcts[id] || "0") || 0) / 100) * num;
    return parseFloat(customAmounts[id] || "0") || 0;
  };

  const getPct = (id: string): number => {
    if (!splitIds.includes(id)) return 0;
    if (splitType === "equal") return equalPct;
    if (splitType === "percentage") return parseFloat(customPcts[id] || "0") || 0;
    const share = parseFloat(customAmounts[id] || "0") || 0;
    return num > 0 ? (share / num) * 100 : 0;
  };

  const totalPct = splitIds.reduce((s, id) => s + getPct(id), 0);
  const totalCustom = splitIds.reduce((s, id) => s + (parseFloat(customAmounts[id] || "0") || 0), 0);
  const pctWarning = splitType === "percentage" && Math.abs(totalPct - 100) > 0.5;
  const amtWarning = splitType === "custom" && num > 0 && Math.abs(totalCustom - num) > 0.01;

  const valid = title.trim() && num > 0 && splitIds.length > 0 && group && !pctWarning && !amtWarning;

  const toggle = (id: string) =>
    setSplitIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = async () => {
    if (!valid || !group) return;
    setSaving(true);
    try {
      await expensesApi.update(Number(initial.id), {
        description: title.trim(),
        amount: num,
        category: categoryId,
        created_at: new Date().toISOString(),
        payer_id: Number(paidBy),
        group_id: Number(group.id),
        split_type: splitType === "percentage" ? "share" : splitType,
        splits: splitIds.map((id) => ({
          user_id: Number(id),
          share_amount: getShare(id),
        })),
      });
      showToast("Expense updated", "success");
      await onSaved();
      onClose();
    } catch {
      showToast("Could not update expense", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!group) return null;

  const currency = group.currency || "USD";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>

        <div className="modal-h with-icon">
          <div className="modal-h-titlewrap">
            <div className="modal-icon"><Icon name="edit" size={24} /></div>
            <div>
              <h2>Edit Expense</h2>
              <p>Update the details and split for this expense.</p>
            </div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="modal-b">
          <div className="form-grid-2">
            <div className="form-block">
              <label>Expense Title</label>
              <div className="form-input">
                <Icon name="receipt" size={15} className="ic" />
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dinner at Bella Italia" />
              </div>
            </div>
            <div className="form-block">
              <label>Amount</label>
              <div className="form-input with-after">
                <Icon name="coin" size={15} className="ic" />
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <div className="after">{currency} <Icon name="chev" size={12} /></div>
              </div>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-block">
              <label>Paid By</label>
              <div className="form-input">
                <Icon name="account" size={15} className="ic" />
                <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                  {group.memberIds.map((id) => {
                    const p = personById(id);
                    return <option key={id} value={id}>{p.you ? p.name + " (You)" : p.name}</option>;
                  })}
                </select>
                <Icon name="chev" size={12} className="ic" />
              </div>
            </div>
            <div className="form-block">
              <label>Category</label>
              <div className="form-input">
                <Icon name={categoryById(categoryId).icon} size={15} className="ic" style={{ color: categoryById(categoryId).color }} />
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Icon name="chev" size={12} className="ic" />
              </div>
            </div>
          </div>

          <div className="form-block">
            <label>Date</label>
            <div className="form-input">
              <Icon name="receipt" size={15} className="ic" />
              <input value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="form-block">
            <label>Note <span className="opt">(Optional)</span></label>
            <div className="textarea-wrap">
              <div className="form-input" style={{ alignItems: "flex-start", paddingTop: 8 }}>
                <Icon name="receipt" size={15} className="ic" style={{ marginTop: 4 }} />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 200))}
                  placeholder="Add a note about this expense..."
                />
              </div>
              <div className="counter">{note.length}/200</div>
            </div>
          </div>

          <div className="split-head">
            <label>Split Expense With</label>
          </div>
          <div className="split-tabs">
            {(["equal", "percentage", "custom"] as const).map((t) => (
              <button
                key={t}
                className={"split-tab" + (splitType === t ? " active" : "")}
                onClick={() => { setSplitType(t); setCustomAmounts({}); setCustomPcts({}); }}
              >
                {t === "equal" ? "Equally" : t === "percentage" ? "By Percentage" : "Custom"}
              </button>
            ))}
          </div>

          <div className="mem-rows">
            {group.memberIds.map((id) => {
              const checked = splitIds.includes(id);
              const p = personById(id);
              const isPayer = id === paidBy;
              const share = getShare(id);
              const pct = getPct(id);
              return (
                <div key={id} className="mem-row">
                  <button className={"checkbox" + (checked ? " checked" : "")} onClick={() => toggle(id)} aria-label="select">
                    <Icon name="check" size={12} />
                  </button>
                  <Avatar id={id} size="md" />
                  <span className="nm">
                    {p.you ? p.name + " (You)" : p.name}
                    {isPayer && <span className="paid-tag">Paid</span>}
                  </span>

                  {splitType === "custom" && checked ? (
                    <input
                      type="number" step="0.01" className="split-custom-input"
                      value={customAmounts[id] ?? ""} placeholder="0.00"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [id]: e.target.value }))}
                      style={{ width: 80, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13, textAlign: "right" }}
                    />
                  ) : (
                    <span className="amt num">{checked ? fmt(share, currency) : "—"}</span>
                  )}

                  {splitType === "percentage" && checked ? (
                    <input
                      type="number" step="0.1" min="0" max="100" className="split-custom-input"
                      value={customPcts[id] ?? ""} placeholder="0"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setCustomPcts((prev) => ({ ...prev, [id]: e.target.value }))}
                      style={{ width: 64, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13, textAlign: "right" }}
                    />
                  ) : (
                    <span className="pct num">{checked ? pct.toFixed(1) + "%" : "—"}</span>
                  )}
                </div>
              );
            })}
          </div>

          {pctWarning && (
            <div style={{ fontSize: 12, color: "var(--rose)", marginTop: 6, paddingLeft: 4 }}>
              Percentages total {totalPct.toFixed(1)}% — must equal 100%
            </div>
          )}
          {amtWarning && (
            <div style={{ fontSize: 12, color: "var(--rose)", marginTop: 6, paddingLeft: 4 }}>
              Amounts total {fmt(totalCustom, currency)} — must equal {fmt(num, currency)}
            </div>
          )}

          <button className="add-more-box" onClick={() => setShowMore((v) => !v)}>
            <div className="ic"><Icon name="plus" size={16} /></div>
            <div className="body">
              <div className="nm">Add More Details</div>
              <div className="ds">Add receipt, location and other details</div>
            </div>
            <Icon name="chev" size={14} style={{ color: "var(--ink-3)", transform: showMore ? "rotate(180deg)" : "none", transition: ".2s" }} />
          </button>
          {showMore && (
            <div style={{ padding: 14, background: "#fafbfc", borderRadius: 10, marginTop: 10, fontSize: 12, color: "var(--ink-3)" }}>
              Receipt upload, location pin, and tags coming soon.
            </div>
          )}
        </div>

        <div className="modal-f">
          <div />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!valid || saving} onClick={save} style={{ opacity: valid && !saving ? 1 : 0.5 }}>
              <Icon name={saving ? "receipt" : "check"} size={14} />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
