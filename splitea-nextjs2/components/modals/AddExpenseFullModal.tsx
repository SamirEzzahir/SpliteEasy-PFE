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
  const [showMore, setShowMore] = useState(false);

  const group = useMemo(
    () => groups.find((g) => g.id === groupId) || groups[0],
    [groups, groupId],
  );

  // When the group changes (or first becomes available) reset split + payer.
  useEffect(() => {
    if (!group) return;
    setSplitIds(group.memberIds.slice(0, Math.min(5, group.memberIds.length)));
    setPaidBy((prev) => (group.memberIds.includes(prev) ? prev : group.memberIds[0] || ""));
  }, [group]);

  const num = parseFloat(amount) || 0;
  const perPerson = splitIds.length ? num / splitIds.length : 0;
  const perPct = splitIds.length ? 100 / splitIds.length : 0;
  const valid = title.trim() && num > 0 && splitIds.length > 0 && group;

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
      date,
      time: "Just now",
      splitIds: [...splitIds],
    });
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
            <button className="split-mode">
              <Icon name="split-equal" size={14} /> Split Equally <Icon name="chev" size={11} />
            </button>
          </div>

          <div className="mem-rows">
            {group.memberIds.map((id) => {
              const checked = splitIds.includes(id);
              const p = personById(id);
              const isPayer = id === paidBy;
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
                  <span className="amt num">{checked ? fmt(perPerson) : "—"}</span>
                  <span className="pct num">{checked ? Math.round(perPct) + "%" : "—"}</span>
                </div>
              );
            })}
          </div>

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
