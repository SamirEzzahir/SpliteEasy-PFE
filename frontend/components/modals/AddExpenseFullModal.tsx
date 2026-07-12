"use client";
// components/modals/AddExpenseFullModal.tsx — full splitting flow

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { fmt } from "@/lib/format";
import { CATEGORIES, categoryById, personById } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { Expense } from "@/lib/types";

interface Props {
  onClose: () => void;
  onSubmit: (e: Expense) => void;
  defaultGroupId?: string;
}

export default function AddExpenseFullModal({ onClose, onSubmit, defaultGroupId }: Props) {
  // Pull real groups from the store — mock GROUPS would have stale ids.
  const { groups } = useApp();
  const fallbackGroupId = defaultGroupId || groups[0]?.id || "";

  const [title, setTitle] = useState("Dinner at Bella Italia");
  const [amount, setAmount] = useState("85.60");
  const [groupId, setGroupId] = useState(fallbackGroupId);
  const [paidBy, setPaidBy] = useState("");
  const [categoryId, setCategoryId] = useState("food");
  const [date, setDate] = useState(
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  );
  const [note, setNote] = useState("");
  const [splitIds, setSplitIds] = useState<string[]>([]);
  const [splitType, setSplitType] = useState<"equal" | "percentage" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customPcts, setCustomPcts] = useState<Record<string, string>>({});
  const [showMore, setShowMore] = useState(false);

  const group = useMemo(
    () => groups.find((g) => g.id === groupId) || groups[0],
    [groups, groupId],
  );

  // When the group changes reset split + payer + custom inputs.
  useEffect(() => {
    if (!group) return;
    const ids = group.memberIds.slice(0, Math.min(5, group.memberIds.length));
    setSplitIds(ids);
    setPaidBy((prev) => (group.memberIds.includes(prev) ? prev : group.memberIds[0] || ""));
    setCustomAmounts({});
    setCustomPcts({});
  }, [group]);

  const num = parseFloat(amount) || 0;
  const equalShare = splitIds.length ? num / splitIds.length : 0;
  const equalPct = splitIds.length ? 100 / splitIds.length : 0;

  const getShare = (id: string): number => {
    if (!splitIds.includes(id)) return 0;
    if (splitType === "equal") return equalShare;
    if (splitType === "percentage") {
      const pct = parseFloat(customPcts[id] || "0") || 0;
      return (pct / 100) * num;
    }
    return parseFloat(customAmounts[id] || "0") || 0;
  };

  const getPct = (id: string): number => {
    if (!splitIds.includes(id)) return 0;
    if (splitType === "equal") return equalPct;
    if (splitType === "percentage") return parseFloat(customPcts[id] || "0") || 0;
    // custom amount — derive % from amount
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

  const submit = () => {
    if (!valid || !group) return;
    onSubmit({
      id: "e" + Date.now(),
      title: title.trim(),
      subtitle: "",
      groupId: group.id,
      paidBy,
      categoryId,
      amount: num,
      currency: group.currency || "USD",
      date,
      time: "Just now",
      splitIds: [...splitIds],
      splitType,
      customAmounts: splitType === "custom" ? { ...customAmounts } : splitType === "percentage" ? Object.fromEntries(splitIds.map((id) => [id, String(getShare(id))])) : undefined,
    } as any);
  };

  if (!group) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
          <div className="modal-h">
            <div>
              <h2>No groups yet</h2>
              <p>Create a group before adding expenses.</p>
            </div>
            <button className="modal-x" onClick={onClose}><Icon name="x" size={16} /></button>
          </div>
          <div className="modal-f" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={onClose}>Got it</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h with-icon">
          <div className="modal-h-titlewrap">
            <div className="modal-icon"><Icon name="receipt" size={24} /></div>
            <div>
              <h2>Add New Expense</h2>
              <p>Enter expense details and split it with group members.</p>
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
                <div className="after">USD <Icon name="chev" size={12} /></div>
              </div>
            </div>
          </div>

          <div className="form-grid-2">
            {!defaultGroupId && (
              <div className="form-block">
                <label>Group</label>
                <div className="form-input">
                  <Icon name="groups" size={15} className="ic" />
                  <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <Icon name="chev" size={12} className="ic" />
                </div>
              </div>
            )}
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
          </div>

          <div className="form-grid-2">
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
            <div className="form-block">
              <label>Date</label>
              <div className="form-input">
                <Icon name="receipt" size={15} className="ic" />
                <input value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="form-block">
            <label>Description <span className="opt">(Optional)</span></label>
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
                  <button
                    className={"checkbox" + (checked ? " checked" : "")}
                    onClick={() => toggle(id)}
                    aria-label="select"
                  >
                    <Icon name="check" size={12} />
                  </button>
                  <Avatar id={id} size="md" />
                  <span className="nm">
                    {p.you ? p.name + " (You)" : p.name}
                    {isPayer && <span className="paid-tag">Paid</span>}
                  </span>

                  {/* Amount column */}
                  {splitType === "custom" && checked ? (
                    <input
                      type="number"
                      step="0.01"
                      className="split-custom-input"
                      value={customAmounts[id] ?? ""}
                      placeholder="0.00"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [id]: e.target.value }))}
                      style={{ width: 80, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13, textAlign: "right" }}
                    />
                  ) : (
                    <span className="amt num">{checked ? fmt(share, group.currency) : "—"}</span>
                  )}

                  {/* Percentage column */}
                  {splitType === "percentage" && checked ? (
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      className="split-custom-input"
                      value={customPcts[id] ?? ""}
                      placeholder="0"
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

          {/* Validation warnings */}
          {pctWarning && (
            <div style={{ fontSize: 12, color: "var(--rose)", marginTop: 6, paddingLeft: 4 }}>
              Percentages total {totalPct.toFixed(1)}% — must equal 100%
            </div>
          )}
          {amtWarning && (
            <div style={{ fontSize: 12, color: "var(--rose)", marginTop: 6, paddingLeft: 4 }}>
              Amounts total {fmt(totalCustom, group.currency)} — must equal {fmt(num, group.currency)}
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
            <button className="btn btn-primary" disabled={!valid} onClick={submit} style={{ opacity: valid ? 1 : 0.5 }}>
              <Icon name="plus" size={14} /> Add Expense
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
