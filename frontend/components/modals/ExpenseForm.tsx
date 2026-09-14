"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Dialog } from "@/components/ui/dialog";
import { PeoplePicker } from "@/components/ui/PeoplePicker";
import { CATEGORIES, personById } from "@/lib/data";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth/AuthContext";
import { fmt } from "@/lib/format";
import { allocateShares } from "@/lib/expense-split";
import type { Expense } from "@/lib/types";
import WalletSelect from "@/components/money/WalletSelect";
import { apiErrorMessage } from "@/lib/api/client";

export default function ExpenseForm({ initial, defaultGroupId, onClose, onSubmit }: {
  initial?: Expense; defaultGroupId?: string; onClose: () => void;
  onSubmit: (expense: Expense) => Promise<void> | void;
}) {
  const { groups, loading } = useApp();
  const { user } = useAuth();
  const formId = useId();
  const [groupId, setGroupId] = useState(initial?.groupId || defaultGroupId || groups[0]?.id || "");
  const group = groups.find((g) => g.id === groupId);
  const [title, setTitle] = useState(initial?.title || "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [paidBy, setPaidBy] = useState(initial?.paidBy || (group?.memberIds.includes(user?.id || "") ? user!.id : group?.memberIds[0]) || "");
  const [splitIds, setSplitIds] = useState(initial?.splitIds || group?.memberIds || []);
  useEffect(() => {
    const available=group || (!groupId?groups[0]:undefined);
    if(available && !paidBy) {
      setGroupId(available.id);
      setPaidBy(available.memberIds.includes(user?.id || "")?user!.id:available.memberIds[0] || "");
      setSplitIds(available.memberIds);
    }
  }, [group,groupId,groups,paidBy,user?.id]);
  const [splitType, setSplitType] = useState<NonNullable<Expense["splitType"]>>(initial?.splitType || "equal");
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(
    Object.entries(initial?.splitAmounts || {}).map(([id, share]) => [id, String(initial?.splitType === "percentage" ? share / initial.amount * 100 : share)])));
  const [categoryId, setCategoryId] = useState(initial?.categoryId || "food");
  const [date, setDate] = useState(() => initial?._rawDate?.slice(0, 10) || (initial?.date.match(/^\d{4}-\d{2}-\d{2}$/) ? initial.date : new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)));
  const [note, setNote] = useState(initial?.note || "");
  const [walletId,setWalletId] = useState(initial?.walletId || "");
  const [requestId] = useState(() => crypto.randomUUID());
  const [jarType,setJarType] = useState(initial?.isFromJar ? initial.jarType || "" : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const currency = initial?.currency || group?.currency || "MAD";
  const num = Number(amount);
  const weights = Object.fromEntries(splitIds.map((id) => [id, Number(values[id] || 0)]));
  const allocated = Object.values(weights).reduce((a, b) => a + b, 0);
  const validValues = Object.values(weights).every((v) => Number.isFinite(v) && v >= 0);
  const remaining = splitType === "percentage" ? 100 - allocated : num - allocated;
  const splitValid = splitType === "equal" || (validValues && Math.abs(remaining) < (splitType === "percentage" ? 0.0001 : 0.005));
  const shares = splitType === "custom" ? weights : allocateShares(num, splitIds, splitType === "percentage" ? weights : undefined);
  const valid = !!group && !!title.trim() && Number.isFinite(num) && num > 0 && !!date && group.memberIds.includes(paidBy) && splitIds.length > 0 && splitValid;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || !group || saving) return;
    setSaving(true); setError("");
    try {
      await onSubmit({ ...initial, id: initial?.id || `draft-${Date.now()}`, title: title.trim(), subtitle: initial?.subtitle || "",
        amount: num, currency, groupId, paidBy, categoryId, date, time: initial?.time || "Just now", note,
        splitIds, splitType, splitAmounts: shares, requestId,
        walletId: paidBy===user?.id ? walletId || null : initial?.paidBy===user?.id ? null : undefined,
        jarType: paidBy===user?.id ? jarType || null : initial?.paidBy===user?.id ? null : undefined,
        isFromJar: paidBy===user?.id ? !!jarType : initial?.paidBy===user?.id ? false : undefined });
      onClose();
    } catch (error) {
      setError(apiErrorMessage(error));
    } finally { setSaving(false); }
  }
  return <Dialog open onClose={onClose} busy={saving} className="expense-dialog" title={initial ? "Edit expense" : "Add expense"}
    description="Enter what was paid, then review everyone's share."
    footer={group ? <><button className="btn btn-secondary" type="button" disabled={saving} onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" type="submit" form={formId} disabled={!valid || saving}>{saving ? "Saving…" : initial ? "Save changes" : "Add expense"}</button></> : undefined}>
    {!group ? loading ? <div className="sk-block" style={{height:180}} role="status" aria-label="Loading groups"/> : <div className="empty-state"><p>Create a group to start sharing expenses.</p><Link href="/groups" className="btn btn-primary" onClick={onClose}>Go to groups</Link></div> :
    <form id={formId} onSubmit={submit} className="expense-form">
      <fieldset disabled={saving}>
        <div className="expense-core-fields">
          <label>Amount ({currency})<input autoFocus type="number" inputMode="decimal" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="expense-amount-input" /></label>
          <label>Description<input required maxLength={250} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dinner together" /></label>
        </div>
        <div className="form-grid-2">
          <label>Group<select value={groupId} disabled={!!initial || !!defaultGroupId} onChange={(e) => {
            const next = groups.find((g) => g.id === e.target.value)!;
            setGroupId(next.id); setSplitIds(next.memberIds); setPaidBy(next.memberIds.includes(user?.id || "") ? user!.id : next.memberIds[0] || ""); setValues({});
          }}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label>Paid by<select value={paidBy} required onChange={(e) => setPaidBy(e.target.value)}>{group.memberIds.map((id) => <option key={id} value={id}>{id === user?.id ? "You" : personById(id).name}</option>)}</select></label>
        </div>
        {paidBy===user?.id && <><WalletSelect value={walletId} onChange={setWalletId} currency={currency}/><label>Your budget (optional)<select value={jarType} onChange={e=>setJarType(e.target.value)}><option value="">No budget</option>{[["NEC","Essentials"],["FFA","Financial freedom"],["EDU","Learning"],["LTSS","Long-term saving"],["PLAY","Play"],["GIVE","Giving"]].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{jarType && <p className="field-help">Only your own share counts against this budget.</p>}</>}
        <section className="expense-split-section" aria-labelledby={`${formId}-split`}>
          <PeoplePicker
            key={groupId}
            headingId={`${formId}-split`}
            title={`Split between ${splitIds.length} ${splitIds.length === 1 ? "person" : "people"}`}
            description="Choose who shares this expense."
            people={group.memberIds.map(personById)}
            selectedIds={splitIds}
            onChange={setSplitIds}
            currentUserId={user?.id}
            disabled={saving}
          />
          <div className="expense-shares">
            <div className="section-heading"><h4>Each person's share</h4>
              <select aria-label="Split method" value={splitType} onChange={(e) => { setSplitType(e.target.value as typeof splitType); setValues({}); }}>
                <option value="equal">Equally</option><option value="percentage">By percentage</option><option value="custom">Exact amounts</option>
              </select></div>
            {splitIds.map((id) => <div key={id} className="expense-person-row">
              <div className="expense-person">
                <span aria-hidden="true"><Avatar id={id} size="sm" /></span>
                <span>{id === user?.id ? "You" : personById(id).name}{id === paidBy && <small>Paid the expense</small>}</span>
              </div>
              {splitType !== "equal" && <label className="expense-share-input"><span className="sr-only">{personById(id).name}: {splitType === "percentage" ? "percentage" : "amount"}</span>
                <input type="number" inputMode="decimal" min="0" max={splitType === "percentage" ? 100 : undefined} step={splitType === "percentage" ? "any" : "0.01"} value={values[id] || ""} placeholder="0" onChange={(e) => setValues({ ...values, [id]: e.target.value })} />{splitType === "percentage" && <span>%</span>}</label>}
              <strong className="num">{fmt(shares[id] || 0, currency)}</strong>
            </div>)}
          </div>
          <p className={`split-feedback${splitValid && splitIds.length ? " is-valid" : ""}`} role="status">
            {!splitIds.length ? "Select at least one person." : splitType === "equal" ? "Shared equally. Any remaining cent is included in the shares above." : splitValid ? "Fully allocated — the shares match the total." : splitType === "percentage" ? `${Number(remaining.toFixed(2))}% remaining to allocate` : `${fmt(remaining, currency)} remaining to allocate`}
          </p>
        </section>
        <details className="optional-details"><summary>Date, category & note</summary><div className="form-grid-2">
          <label>Date<input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Category<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div><label>Note (optional)<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the group should know" /></label></details>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>}
  </Dialog>;
}
