"use client";
// app/debts-loans/page.tsx — Debts (you owe) & Loans (owed to you).
// Redesigned with Tailwind + a local shadcn-style UI kit + Lucide icons.
// Backend: /debts-loans/*. Theme colors are bound to the app's CSS variables so
// light/dark mode follow the global theme toggle.

import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import {
  Plus, ArrowUpRight, ArrowDownLeft, Scale, Receipt, Coins, HandCoins,
  Trash2, CalendarClock, Wallet, Check,
} from "lucide-react";
import { fmt } from "@/lib/format";
import { useAuth } from "@/lib/auth/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Dialog } from "@/components/ui/dialog";
import { Input, Field } from "@/components/ui/input";
import {
  debtsLoansApi,
  type ApiDebt, type ApiLoan, type ApiDebtLoanSummary, type DebtLoanStatus,
} from "@/lib/api/debts";

type Tab = "debts" | "loans";

interface Row {
  id: number; name: string;
  original_amount: number; remaining_amount: number; total_paid: number;
  status: DebtLoanStatus; due_date?: string | null; note?: string | null;
}

const toRow = (x: ApiDebt | ApiLoan): Row => ({
  id: x.id,
  name: "lender_name" in x ? x.lender_name : x.borrower_name,
  original_amount: x.original_amount,
  remaining_amount: x.remaining_amount,
  total_paid: x.total_paid,
  status: x.status,
  due_date: x.due_date,
  note: x.note,
});

// ── SVG donut: owe vs owed, Net in the center ────────────────────────────────
function Donut({ debt, loan, net, currency }: { debt: number; loan: number; net: number; currency: string }) {
  const SIZE = 176, R = 72, SW = 15, C = 2 * Math.PI * R, cx = SIZE / 2;
  const total = debt + loan;
  const loanLen = (total > 0 ? loan / total : 0) * C;
  const debtLen = (total > 0 ? debt / total : 0) * C;
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="var(--line-2)" strokeWidth={SW} />
        {total > 0 && (
          <>
            <circle cx={cx} cy={cx} r={R} fill="none" stroke="var(--success)" strokeWidth={SW} strokeLinecap="round"
              strokeDasharray={`${Math.max(loanLen - 5, 0)} ${C}`} />
            <circle cx={cx} cy={cx} r={R} fill="none" stroke="var(--rose)" strokeWidth={SW} strokeLinecap="round"
              strokeDasharray={`${Math.max(debtLen - 5, 0)} ${C}`} strokeDashoffset={-loanLen} />
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <span className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-[var(--ink-3)]">Net balance</span>
        <span className="mt-1 w-full truncate text-[16px] font-extrabold leading-none tabular-nums tracking-tight"
          style={{ color: net >= 0 ? "var(--success)" : "var(--rose)" }}>
          {fmt(net, currency)}
        </span>
        <span className="mt-1.5 text-[9.5px] font-semibold text-[var(--ink-4)]">
          {net >= 0 ? "in your favor" : "you owe overall"}
        </span>
      </div>
    </div>
  );
}

// ── SVG progress ring per item ───────────────────────────────────────────────
function Ring({ pct, color }: { pct: number; color: string }) {
  const R = 24, SW = 6, C = 2 * Math.PI * R;
  const len = (Math.min(100, Math.max(0, pct)) / 100) * C;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--line-2)" strokeWidth={SW} />
        <circle cx="28" cy="28" r={R} fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={`${len} ${C - len}`}
          className="transition-[stroke-dasharray] duration-500 ease-out" />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[12px] font-extrabold tabular-nums" style={{ color }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

// ── KPI tile ─────────────────────────────────────────────────────────────────
function Kpi({ icon, label, value, sub, iconBg, iconFg, valueColor }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  iconBg: string; iconFg: string; valueColor: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1" style={{ background: iconFg }} />
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: iconBg, color: iconFg }}>{icon}</span>
        {label}
      </div>
      <div className="mt-2.5 text-[22px] font-extrabold tabular-nums tracking-tight" style={{ color: valueColor }}>{value}</div>
      <div className="mt-0.5 text-[11.5px] font-semibold text-[var(--ink-4)]">{sub}</div>
    </div>
  );
}

// ── Create dialog ────────────────────────────────────────────────────────────
function CreateDialog({
  open, tab, currency, saving, onClose, onSubmit,
}: {
  open: boolean; tab: Tab; currency: string; saving: boolean;
  onClose: () => void;
  onSubmit: (name: string, amount: number, dueDate: string | null, note: string | null) => void;
}) {
  const isDebt = tab === "debts";
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const amt = parseFloat(amount) || 0;
  const valid = name.trim().length > 0 && amt > 0;

  // Reset when reopened
  useEffect(() => { if (open) { setName(""); setAmount(""); setDueDate(""); setNote(""); } }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isDebt ? "Add a Debt" : "Add a Loan"}
      description={isDebt ? "Money you borrowed from someone." : "Money you lent to someone."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={!valid || saving}
            onClick={() => onSubmit(name.trim(), amt, dueDate || null, note.trim() || null)}>
            {saving ? "Saving…" : isDebt ? "Add Debt" : "Add Loan"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label={isDebt ? "Lender (who you owe)" : "Borrower (who owes you)"}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Yassine" autoFocus />
        </Field>
        <Field label={`Amount (${currency})`}>
          <Input type="number" inputMode="decimal" min="0" step="0.01" value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Due date" hint="(optional)">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Note" hint="(optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is this for?" />
        </Field>
      </div>
    </Dialog>
  );
}

export default function DebtsLoansPage() {
  const { user } = useAuth();
  const currency = user?.preferred_currency || "MAD";

  const [tab, setTab] = useState<Tab>("debts");
  const [summary, setSummary] = useState<ApiDebtLoanSummary | null>(null);
  const [debts, setDebts] = useState<ApiDebt[]>([]);
  const [loans, setLoans] = useState<ApiLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<Set<number>>(new Set());

  const refetch = useCallback(async () => {
    setLoading(true);
    const [sumRes, debtRes, loanRes] = await Promise.allSettled([
      debtsLoansApi.summary(), debtsLoansApi.listDebts(), debtsLoansApi.listLoans(),
    ]);
    if (sumRes.status === "fulfilled") setSummary(sumRes.value);
    if (debtRes.status === "fulfilled") setDebts(debtRes.value); else toast.error("Could not load debts");
    if (loanRes.status === "fulfilled") setLoans(loanRes.value); else toast.error("Could not load loans");
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const rows: Row[] = useMemo(
    () => (tab === "debts" ? debts.map(toRow) : loans.map(toRow)),
    [tab, debts, loans],
  );

  const isDebt = tab === "debts";
  const accent = isDebt ? "var(--rose)" : "var(--success)";
  const totalDebt = summary?.total_debt ?? 0;
  const totalLoans = summary?.total_loans ?? 0;
  const net = summary?.net ?? 0;

  const setActingId = (id: number, on: boolean) =>
    setActing((prev) => { const s = new Set(prev); on ? s.add(id) : s.delete(id); return s; });

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleCreate = async (name: string, amount: number, dueDate: string | null, note: string | null) => {
    setSaving(true);
    try {
      const due = dueDate ? new Date(dueDate).toISOString() : null;
      if (isDebt) await debtsLoansApi.createDebt({ lender_name: name, original_amount: amount, due_date: due, note });
      else await debtsLoansApi.createLoan({ borrower_name: name, original_amount: amount, due_date: due, note });
      toast.success(isDebt ? "Debt added" : "Loan added");
      setShowCreate(false);
      await refetch();
    } catch { toast.error("Could not save"); }
    finally { setSaving(false); }
  };

  const repay = async (row: Row) => {
    const result = await Swal.fire({
      title: isDebt ? "Record a Payment" : "Record a Repayment",
      html: `Remaining: <b>${fmt(row.remaining_amount, currency)}</b>`,
      input: "number",
      inputLabel: `Amount (${currency})`,
      inputValue: row.remaining_amount,
      inputAttributes: { min: "0", max: String(row.remaining_amount), step: "0.01" },
      showCancelButton: true, confirmButtonColor: "#5b4ef0", cancelButtonColor: "#6b7280", confirmButtonText: "Record",
      inputValidator: (v) => {
        const n = parseFloat(v);
        if (!n || n <= 0) return "Enter a valid amount";
        if (n > row.remaining_amount + 0.001) return "Amount exceeds the remaining balance";
        return null;
      },
    });
    if (!result.isConfirmed) return;
    const amount = Number(result.value);
    setActingId(row.id, true);
    try {
      if (isDebt) await debtsLoansApi.repayDebt(row.id, amount); else await debtsLoansApi.repayLoan(row.id, amount);
      toast.success("Payment recorded");
      await refetch();
    } catch { toast.error("Could not record payment"); }
    finally { setActingId(row.id, false); }
  };

  const remove = async (row: Row) => {
    const result = await Swal.fire({
      title: `Delete this ${isDebt ? "debt" : "loan"}?`,
      text: `${row.name} — ${fmt(row.original_amount, currency)}`,
      icon: "warning", showCancelButton: true,
      confirmButtonColor: "#ef4444", cancelButtonColor: "#6b7280", confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;
    setActingId(row.id, true);
    try {
      if (isDebt) await debtsLoansApi.deleteDebt(row.id); else await debtsLoansApi.deleteLoan(row.id);
      toast.success("Deleted");
      await refetch();
    } catch { toast.error("Could not delete"); }
    finally { setActingId(row.id, false); }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const statusBadge = (s: DebtLoanStatus) => {
    if (s === "fully_paid") return <Badge tone="success"><Check size={11} /> Paid</Badge>;
    if (s === "partially_paid") return <Badge tone="warn">◑ Partial</Badge>;
    return <Badge tone="danger">● Active</Badge>;
  };

  const dueBadge = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
    const overdue = d.getTime() < Date.now();
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return (
      <Badge tone={overdue ? "danger" : "neutral"}>
        <CalendarClock size={11} /> {overdue ? `Overdue ${label}` : `Due ${label}`}
      </Badge>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-[var(--ink)]">Debts &amp; Loans</h1>
          <p className="mt-1 text-[13.5px] text-[var(--ink-3)]">
            Track money you <strong className="text-[var(--rose)]">owe</strong> and money{" "}
            <strong className="text-[var(--success)]">owed to you</strong>
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> {isDebt ? "Add Debt" : "Add Loan"}
        </Button>
      </div>

      {/* Hero */}
      {loading ? (
        <div className="sk-block h-[200px] rounded-[20px]" />
      ) : (
        <Card className="overflow-hidden">
          <div
            className="grid grid-cols-1 items-center gap-6 p-6 lg:grid-cols-[auto_1fr]"
            style={{ background: "radial-gradient(120% 140% at 0% 0%, var(--primary-soft), transparent 60%)" }}
          >
            <div className="mx-auto"><Donut debt={totalDebt} loan={totalLoans} net={net} currency={currency} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Kpi icon={<ArrowUpRight size={15} />} label="You Owe" value={fmt(totalDebt, currency)}
                iconBg="var(--rose-soft)" iconFg="var(--rose)" valueColor="var(--rose)"
                sub={`${summary?.active_debts_count ?? 0} active · ${summary?.total_debts_count ?? 0} total`} />
              <Kpi icon={<ArrowDownLeft size={15} />} label="Owed to You" value={fmt(totalLoans, currency)}
                iconBg="var(--success-soft)" iconFg="var(--success)" valueColor="var(--success)"
                sub={`${summary?.active_loans_count ?? 0} active · ${summary?.total_loans_count ?? 0} total`} />
              <Kpi icon={<Scale size={15} />} label="Net Position" value={fmt(net, currency)}
                iconBg="var(--primary-soft)" iconFg="var(--primary)"
                valueColor={net >= 0 ? "var(--success)" : "var(--rose)"}
                sub={net >= 0 ? "In your favor" : "You owe overall"} />
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "debts", label: <><Receipt size={14} /> Debts <span className="ml-1 rounded-full bg-[var(--line-2)] px-1.5 text-[11px] text-[var(--ink-3)]">{debts.length}</span></> },
          { value: "loans", label: <><Coins size={14} /> Loans <span className="ml-1 rounded-full bg-[var(--line-2)] px-1.5 text-[11px] text-[var(--ink-3)]">{loans.length}</span></> },
        ]}
      />

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="sk-block h-[150px] rounded-[18px]" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--line-2)] text-[var(--ink-4)]">
            <Wallet size={26} />
          </div>
          <div className="mt-3 text-[16px] font-extrabold text-[var(--ink)]">No {isDebt ? "debts" : "loans"} yet</div>
          <p className="mb-4 mt-1 text-[13.5px] text-[var(--ink-3)]">
            {isDebt ? "Track money you borrowed from someone." : "Track money you lent to someone."}
          </p>
          <Button onClick={() => setShowCreate(true)}><Plus size={16} /> {isDebt ? "Add Debt" : "Add Loan"}</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row, i) => {
            const pct = row.original_amount > 0 ? (row.total_paid / row.original_amount) * 100 : 0;
            const paid = row.status === "fully_paid";
            const ringColor = paid ? "var(--success)" : accent;
            return (
              <Card
                key={row.id}
                className="flex gap-4 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--primary-soft)] hover:shadow-lg"
                style={{ animation: `dl-in .4s cubic-bezier(.22,.61,.36,1) both`, animationDelay: `${Math.min(i * 45, 360)}ms` }}
              >
                <Ring pct={pct} color={ringColor} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-extrabold tracking-tight text-[var(--ink)]">{row.name}</div>
                  {row.note
                    ? <div className="truncate text-[12px] text-[var(--ink-3)]">{row.note}</div>
                    : <div className="text-[12px] font-medium text-[var(--ink-4)]">{isDebt ? "You owe" : "Owes you"}</div>}
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-[19px] font-extrabold tabular-nums tracking-tight"
                      style={{ color: paid ? "var(--ink-3)" : accent }}>
                      {fmt(row.remaining_amount, currency)}
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--ink-4)]">of {fmt(row.original_amount, currency)}</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {statusBadge(row.status)}
                    {dueBadge(row.due_date)}
                  </div>
                  <div className="mt-3.5 flex items-center gap-2">
                    {!paid && (
                      <Button size="sm" className="flex-1" disabled={acting.has(row.id)} onClick={() => repay(row)}>
                        <HandCoins size={14} /> {isDebt ? "Pay" : "Receive"}
                      </Button>
                    )}
                    {paid ? (
                      <Button size="sm" variant="secondary"
                        className="flex-1 text-[var(--rose)] border-[var(--rose-soft)] hover:bg-[var(--rose-soft)]"
                        disabled={acting.has(row.id)} onClick={() => remove(row)}>
                        <Trash2 size={14} /> Delete
                      </Button>
                    ) : (
                      <Button size="icon" variant="secondary" aria-label="Delete"
                        className="text-[var(--ink-4)] hover:text-[var(--rose)] hover:border-[var(--rose-soft)] hover:bg-[var(--rose-soft)]"
                        disabled={acting.has(row.id)} onClick={() => remove(row)}>
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateDialog open={showCreate} tab={tab} currency={currency} saving={saving}
        onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
    </div>
  );
}
