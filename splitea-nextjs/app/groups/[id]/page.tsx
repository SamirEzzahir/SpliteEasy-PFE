"use client";
// app/groups/[id]/page.tsx — Group Expenses (one group view)

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import Icon from "@/components/Icon";
import { Avatar, AvatarStack } from "@/components/Avatar";
import AddExpenseFullModal from "@/components/modals/AddExpenseFullModal";
import EditExpenseFullModal from "@/components/modals/EditExpenseFullModal";
import ExpenseDetailModal from "@/components/modals/ExpenseDetailModal";
import SettlementDetailModal from "@/components/modals/SettlementDetailModal";
import ManageGroupMembersModal from "@/components/modals/ManageGroupMembersModal";
import GroupChat from "@/components/chat/GroupChat";
import { SkeletonGroupExpenseRow, SkeletonGroupStat } from "@/components/Skeleton";
import { CATEGORIES, categoryById, personById } from "@/lib/data";
import { useAuth } from "@/lib/auth/AuthContext";
import { expensesApi } from "@/lib/api/expenses";
import { settleApi } from "@/lib/api/settle";
import { useApp } from "@/lib/store";
import type { ApiBalanceEntry, ApiSettlement } from "@/lib/api/types";
import type { Expense } from "@/lib/types";

type UnifiedRow = { kind: "expense"; data: Expense; ts: number } | { kind: "settlement"; data: ApiSettlement; ts: number };

const fmtMad = (n: number) =>
  "MAD " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { groups, expenses, addExpense, refetchSplitting, showToast, loading } = useApp();

  const groupId = Number(params.id);
  const group = groups.find((g) => Number(g.id) === groupId);

  const [query, setQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paidByFilter, setPaidByFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [balances, setBalances] = useState<ApiBalanceEntry[]>([]);
  const [settlementHistory, setSettlementHistory] = useState<ApiSettlement[]>([]);
  const [showSettlements, setShowSettlements] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [viewExpense, setViewExpense] = useState<string | null>(null);
  const [viewSettlement, setViewSettlement] = useState<ApiSettlement | null>(null);
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const pageSize = 7;

  const fetchSideData = useCallback(async () => {
    if (!Number.isFinite(groupId)) return;
    const [bal, hist] = await Promise.allSettled([
      settleApi.groupBalances(groupId),
      settleApi.groupHistory(groupId),
    ]);
    if (bal.status === "fulfilled") setBalances(bal.value);
    if (hist.status === "fulfilled") setSettlementHistory(hist.value);
  }, [groupId]);

  useEffect(() => { fetchSideData(); }, [fetchSideData]);

  const groupExpenses = useMemo(
    () => expenses.filter((e) => String(e.groupId) === String(params.id)),
    [expenses, params.id],
  );

  // Unified list: expenses + settlements merged and sorted newest-first
  const unifiedRows = useMemo((): UnifiedRow[] => {
    const toTs = (iso?: string) => iso ? new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime() : 0;
    const expRows: UnifiedRow[] = groupExpenses.map((e) => ({
      kind: "expense",
      data: e,
      ts: toTs(e._rawDate),
    }));
    const settleRows: UnifiedRow[] = settlementHistory.map((s) => ({
      kind: "settlement",
      data: s,
      ts: toTs(s.created_at),
    }));
    const combined = showSettlements ? [...expRows, ...settleRows] : expRows;
    return combined.sort((a, b) => b.ts - a.ts);
  }, [groupExpenses, settlementHistory, showSettlements]);

  const filtered = useMemo(() => {
    const now = new Date();
    const q = query.toLowerCase();
    return unifiedRows.filter((row) => {
      if (row.kind === "settlement") {
        // settlements only filtered by search query
        if (!q.trim()) return true;
        const s = row.data;
        return `settlement ${s.from_username ?? ""} ${s.to_username ?? ""}`.toLowerCase().includes(q);
      }
      const e = row.data;
      const matchesQuery = !q.trim() || `${e.title} ${e.subtitle}`.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "all" || e.categoryId === categoryFilter;
      const matchesPayer = paidByFilter === "all" || e.paidBy === paidByFilter;
      let matchesMonth = true;
      if (monthFilter === "this") {
        const d = e._rawDate ? new Date(e._rawDate.endsWith("Z") ? e._rawDate : e._rawDate + "Z") : new Date(NaN);
        matchesMonth = Number.isNaN(d.getTime()) || (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
      }
      return matchesQuery && matchesCategory && matchesPayer && matchesMonth;
    });
  }, [categoryFilter, unifiedRows, monthFilter, paidByFilter, query]);

  useEffect(() => { setPage(1); }, [query, monthFilter, categoryFilter, paidByFilter]);

  const totals = useMemo(() => {
    const total = groupExpenses.reduce((s, e) => s + e.amount, 0);
    const currentRow = balances.find((b) => b.user_id === user?.id);
    const currentNet = currentRow?.net ?? currentRow?.balance ?? group?.balance ?? 0;
    const youOwe = currentNet < 0 ? Math.abs(currentNet) : 0;
    const youAreOwed = currentNet > 0 ? currentNet : 0;
    const unsettled = balances
      .filter((b) => (b.net ?? b.balance ?? 0) > 0)
      .reduce((sum, b) => sum + (b.net ?? b.balance ?? 0), 0);
    const settled = Math.max(0, total - unsettled);
    return { total, youOwe, youAreOwed, unsettled, settled };
  }, [balances, group?.balance, groupExpenses, user?.id]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const currentUserId = String(user?.id || "");
  const groupPayers = Array.from(new Set(groupExpenses.map((expense) => expense.paidBy)));

  const settleUp = () => {
    if (!group) return;
    router.push(`/groups/${group.id}/settle`);
  };

  const deleteExpense = async (expenseId: string, title: string) => {
    const result = await Swal.fire({
      title: "Delete expense?",
      text: `"${title}" will be permanently removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;

    let undone = false;

    const doDelete = async () => {
      if (undone) return;
      try {
        await expensesApi.remove(Number(expenseId));
        await refetchSplitting();
      } catch {
        toast.error("Could not delete expense");
      }
    };

    const timer = setTimeout(doDelete, 5000);

    toast.warning(
      ({ closeToast }) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%" }}>
          <span style={{ fontSize: 14 }}>
            <strong>"{title}"</strong> will be deleted
          </span>
          <button
            onClick={() => {
              undone = true;
              clearTimeout(timer);
              closeToast?.();
              toast.info("Delete cancelled");
            }}
            style={{
              background: "rgba(255,255,255,0.25)",
              border: "1px solid rgba(255,255,255,0.4)",
              color: "#fff",
              borderRadius: 6,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Undo
          </button>
        </div>
      ),
      { autoClose: 5000, closeOnClick: false },
    );
  };

  if (!loading && !group) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Group not found</h1>
            <p>That group doesn&apos;t exist or you don&apos;t have access.</p>
          </div>
        </div>
        <Link href="/groups" className="btn btn-primary" style={{ width: "fit-content" }}>
          ← Back to groups
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="breadcrumb">
        <Link href="/groups">Groups</Link>
        <Icon name="chevR" size={12} className="sep" />
        <span className="cur">{group?.name ?? "..."}</span>
      </div>

      <div className="page-head">
        <div>
          <h1>Expenses</h1>
          <p>Track and manage all group expenses in one place.</p>
        </div>
        <div className="page-actions">
          {/* Desktop: all buttons visible */}
          <button className="btn btn-secondary gx-hide-mobile" onClick={() => showToast("Export coming next")}><Icon name="download" size={14} /> Export Excel</button>
          <button className="btn btn-secondary gx-hide-mobile" onClick={() => showToast("Import coming next")}><Icon name="upload" size={14} /> Import Excel</button>
          <button className="btn btn-primary" onClick={() => setShowAddExpense(true)}><Icon name="plus" size={14} /> Add Expense</button>
          <button className="btn btn-secondary gx-hide-mobile" onClick={() => setShowMembers(true)}><Icon name="groups" size={14} /> Members</button>
          <button className="btn btn-secondary gx-hide-mobile" onClick={settleUp}><Icon name="settle" size={14} /> Settle</button>

          {/* Mobile: "⋯" more menu */}
          <div className="gx-more-wrap gx-show-mobile">
            <button className="btn btn-secondary" onClick={() => setShowMoreMenu((v) => !v)}>
              <Icon name="dots" size={16} />
            </button>
            {showMoreMenu && (
              <>
                <div className="gx-more-backdrop" onClick={() => setShowMoreMenu(false)} />
                <div className="gx-more-menu">
                  <button onClick={() => { showToast("Export coming next"); setShowMoreMenu(false); }}>
                    <Icon name="download" size={15} /> Export Excel
                  </button>
                  <button onClick={() => { showToast("Import coming next"); setShowMoreMenu(false); }}>
                    <Icon name="upload" size={15} /> Import Excel
                  </button>
                  <button onClick={() => { setShowMembers(true); setShowMoreMenu(false); }}>
                    <Icon name="groups" size={15} /> Members
                  </button>
                  <button onClick={() => { settleUp(); setShowMoreMenu(false); }}>
                    <Icon name="settle" size={15} /> Settle Up
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 5 stat cards */}
      <div className="stat-grid-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonGroupStat key={i} />)
        ) : (
          <>
            <div className="gx-stat">
              <span className="lbl">Total Expenses</span>
              <span className="v" style={{ color: "var(--primary)" }}>{fmtMad(totals.total)}</span>
              <span className="sub">Across {groupExpenses.length} expenses</span>
            </div>
            <div className="gx-stat">
              <span className="lbl">You Owe</span>
              <span className="v" style={{ color: "var(--rose)" }}>{fmtMad(totals.youOwe)}</span>
              <span className="sub">To the group</span>
            </div>
            <div className="gx-stat">
              <span className="lbl">You Are Owed</span>
              <span className="v" style={{ color: "var(--success)" }}>{fmtMad(totals.youAreOwed)}</span>
              <span className="sub">From the group</span>
            </div>
            <div className="gx-stat">
              <span className="lbl">Unsettled</span>
              <span className="v" style={{ color: "#f59e0b" }}>{fmtMad(totals.unsettled)}</span>
              <span className="sub">Open balance</span>
            </div>
            <div className="gx-stat">
              <span className="lbl">Settled</span>
              <span className="v" style={{ color: "var(--success)" }}>{fmtMad(totals.settled)}</span>
              <span className="sub">Estimated settled</span>
            </div>
          </>
        )}
      </div>

      {/* Filters + table */}
      <div className="card" style={{ padding: 18 }}>
        <div className="filter-row">
          <select className="dropdown" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="all">All Dates</option>
            <option value="this">This Month</option>
          </select>
          <select className="dropdown" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
          <select className="dropdown" value={paidByFilter} onChange={(e) => setPaidByFilter(e.target.value)}>
            <option value="all">All Paid By</option>
            {groupPayers.map((id) => <option key={id} value={id}>{personById(id).name}</option>)}
          </select>
          <button
            className="btn btn-secondary"
            onClick={() => setShowSettlements((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              padding: "6px 12px",
              borderColor: showSettlements ? "var(--teal)" : undefined,
              color: showSettlements ? "var(--teal)" : "var(--ink-3)",
              whiteSpace: "nowrap",
            }}
          >
            <Icon name="settle" size={13} />
            {showSettlements ? "Hide Settlements" : "Show Settlements"}
            {settlementHistory.length > 0 && (
              <span style={{
                background: showSettlements ? "var(--teal)" : "var(--line)",
                color: showSettlements ? "#fff" : "var(--ink-3)",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                padding: "1px 6px",
              }}>
                {settlementHistory.length}
              </span>
            )}
          </button>
          <div className="filter-grow" />
          <div className="search" style={{ width: 280 }}>
            <Icon name="search" size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search expenses..." />
          </div>
        </div>

        <table className="exp-table">
          <thead>
            <tr>
              <th>Expense</th>
              <th>Category</th>
              <th>Paid By</th>
              <th>Participants</th>
              <th>Amount</th>
              <th>Your Share</th>
              <th>Date</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => <SkeletonGroupExpenseRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "48px 0", textAlign: "center", color: "var(--ink-3)" }}>
                  No expenses in this group yet.
                </td>
              </tr>
            ) : (
              paged.map((row) => {
                // ── Settlement row ──────────────────────────────────────────
                if (row.kind === "settlement") {
                  const s = row.data;
                  const statusPillClass = s.status === "accepted" ? "st-pill accepted" : s.status === "rejected" ? "st-pill rejected" : "st-pill pending";
                  const statusLabel = s.status === "accepted" ? "✅ Accepted" : s.status === "rejected" ? "❌ Rejected" : "🕐 Pending";
                  const isPayer = s.from_user_id === user?.id;
                  const d = s.created_at ? new Date(s.created_at.endsWith("Z") ? s.created_at : s.created_at + "Z") : null;
                  const dateStr = d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
                  const timeStr = d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
                  return (
                    <tr key={`s-${s.id}`} style={{ borderLeft: "3px solid var(--teal)", background: "rgba(20,184,166,0.03)" }}>
                      <td>
                        <div className="exp-cell">
                          <div className="ic" style={{ background: "rgba(20,184,166,0.12)", color: "var(--teal)" }}>
                            <Icon name="settle" size={18} />
                          </div>
                          <div className="body">
                            <div className="nm" style={{ color: "var(--teal)", fontWeight: 700 }}>Settlement</div>
                            <div className="ds" style={{ fontSize: 11.5 }}>
                              {isPayer ? `You paid ${s.to_username ?? ""}` : `${s.from_username ?? ""} paid you`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="cat-pill" style={{ background: "rgba(20,184,166,0.12)", color: "var(--teal)", marginTop: 0, fontSize: 11 }}>
                          Payment
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar id={String(s.from_user_id)} size="sm" />
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                            {s.from_username ?? `User ${s.from_user_id}`}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar id={String(s.to_user_id)} size="sm" />
                          <span style={{ fontSize: 13, fontWeight: 400, color: "var(--ink-3)" }}>
                            → {s.to_username ?? `User ${s.to_user_id}`}
                          </span>
                        </div>
                      </td>
                      <td className="num" style={{ fontWeight: 700, color: "var(--teal)" }}>{fmtMad(s.amount)}</td>
                      <td><span className={statusPillClass}>{statusLabel}</span></td>
                      <td>
                        <div className="exp-date">{dateStr}</div>
                        <div className="exp-time">{timeStr}</div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                          <button className="tbl-act" aria-label="View" onClick={() => setViewSettlement(s)}>
                            <Icon name="search" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // ── Expense row ─────────────────────────────────────────────
                const e = row.data;
                const cat = categoryById(e.categoryId);
                const payer = personById(e.paidBy);
                const yourShare = e.amount / Math.max(1, e.splitIds.length || group?.memberIds.length || 1);
                const youArePayer = e.paidBy === currentUserId;
                const youParticipate = e.splitIds.length === 0 || e.splitIds.includes(currentUserId);
                const notInvolved = !youArePayer && !youParticipate;
                const onlyYou = youArePayer && (e.splitIds.length === 0 || (e.splitIds.length === 1 && e.splitIds[0] === currentUserId));
                const shareLabel = notInvolved ? "Not split" : onlyYou ? "Even" : youArePayer ? "You lent" : "You owe";
                const shareColor = (notInvolved || onlyYou) ? "var(--ink-3)" : youArePayer ? "var(--success)" : "var(--rose)";
                const participants = (e.splitIds.length > 0 ? e.splitIds : (group?.memberIds ?? [])).slice(0, 4);
                return (
                  <tr key={`e-${e.id}`}>
                    <td>
                      <div className="exp-cell">
                        <div className="ic" style={{ background: cat.soft, color: cat.color }}>
                          <Icon name={cat.icon} size={18} />
                        </div>
                        <div className="body">
                          <div className="nm">{e.title}</div>
                          <div className="ds">{e.subtitle}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="cat-pill" style={{ background: cat.pillBg, color: cat.pillFg, marginTop: 0 }}>
                        {cat.name}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar id={e.paidBy} size="sm" />
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                          {payer.you ? "You" : payer.name.split(" ")[0]}
                        </span>
                      </div>
                    </td>
                    <td><AvatarStack ids={participants} max={3} /></td>
                    <td className="num" style={{ fontWeight: 600, color: "var(--ink)" }}>{fmtMad(e.amount)}</td>
                    <td>
                      <div style={{ fontSize: 12, color: shareColor, fontWeight: 600 }}>{shareLabel}</div>
                      <div className="num" style={{ fontWeight: 600, color: notInvolved ? "var(--ink-3)" : shareColor }}>
                        {notInvolved ? "—" : onlyYou ? fmtMad(e.amount) : youArePayer ? fmtMad(e.amount - yourShare) : fmtMad(yourShare)}
                      </div>
                    </td>
                    <td>
                      <div className="exp-date">{e.date || "No date"}</div>
                      <div className="exp-time">{e.time || ""}</div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                        <button className="tbl-act" aria-label="View" onClick={() => setViewExpense(e.id)}><Icon name="search" size={14} /></button>
                        <button className="tbl-act" aria-label="Edit" onClick={() => setEditExpenseId(e.id)}><Icon name="edit" size={14} /></button>
                        <button className="tbl-act danger" aria-label="Delete" onClick={() => deleteExpense(e.id, e.title)}><Icon name="trash" size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* ── Mobile expense cards (hidden on desktop via CSS) ── */}
        <div className="gx-exp-cards">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="gx-exp-card" style={{ opacity: 0.5 }}>
                <div className="gx-exp-card-top">
                  <div className="gx-exp-card-ic sk-block" style={{ width: 40, height: 40 }} />
                  <div className="gx-exp-card-title">
                    <div className="sk-block" style={{ width: "60%", height: 14, borderRadius: 5, marginBottom: 6 }} />
                    <div className="sk-block" style={{ width: "35%", height: 11, borderRadius: 4 }} />
                  </div>
                  <div className="sk-block" style={{ width: 64, height: 16, borderRadius: 5 }} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 14 }}>
              No expenses in this group yet.
            </div>
          ) : (
            paged.map((row) => {
              // ── Settlement mobile card ──────────────────────────────────
              if (row.kind === "settlement") {
                const s = row.data;
                const isPayer = s.from_user_id === user?.id;
                const statusLabel = s.status === "accepted" ? "✅ Accepted" : s.status === "rejected" ? "❌ Rejected" : "🕐 Pending";
                const d = s.created_at ? new Date(s.created_at.endsWith("Z") ? s.created_at : s.created_at + "Z") : null;
                return (
                  <div key={`s-${s.id}`} className="gx-exp-card" style={{ borderLeft: "3px solid var(--teal)" }}>
                    <div className="gx-exp-card-top">
                      <div className="gx-exp-card-ic" style={{ background: "rgba(20,184,166,0.12)", color: "var(--teal)" }}>
                        <Icon name="settle" size={20} />
                      </div>
                      <div className="gx-exp-card-title">
                        <div className="nm" style={{ color: "var(--teal)", fontWeight: 700 }}>Settlement</div>
                        <div className="ds">{d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</div>
                      </div>
                      <div className="gx-exp-card-amount" style={{ color: "var(--teal)" }}>{fmtMad(s.amount)}</div>
                    </div>
                    <div className="gx-exp-card-meta">
                      <div className="gx-exp-card-field">
                        <span className="lbl">From</span>
                        <span className="val"><Avatar id={String(s.from_user_id)} size="sm" />{s.from_username}</span>
                      </div>
                      <div className="gx-exp-card-field">
                        <span className="lbl">To</span>
                        <span className="val"><Avatar id={String(s.to_user_id)} size="sm" />{s.to_username}</span>
                      </div>
                      <div className="gx-exp-card-field">
                        <span className="lbl">Status</span>
                        <span className="val">{statusLabel}</span>
                      </div>
                      <div className="gx-exp-card-field">
                        <span className="lbl">Direction</span>
                        <span className="val" style={{ color: isPayer ? "var(--rose)" : "var(--success)" }}>
                          {isPayer ? "You paid" : "Received"}
                        </span>
                      </div>
                    </div>
                    <div className="gx-exp-card-actions">
                      <button className="tbl-act" aria-label="View" onClick={() => setViewSettlement(s)}><Icon name="search" size={14} /></button>
                    </div>
                  </div>
                );
              }

              // ── Expense mobile card ─────────────────────────────────────
              const e = row.data;
              const cat = categoryById(e.categoryId);
              const payer = personById(e.paidBy);
              const splitCount = e.splitIds.length || group?.memberIds.length || 1;
              const yourShare = e.amount / Math.max(1, splitCount);
              const youArePayer = e.paidBy === currentUserId;
              const youParticipate = e.splitIds.length === 0 || e.splitIds.includes(currentUserId);
              const notInvolved = !youArePayer && !youParticipate;
              const onlyYou = youArePayer && (e.splitIds.length === 0 || (e.splitIds.length === 1 && e.splitIds[0] === currentUserId));
              const shareLabel = notInvolved ? "Not split" : onlyYou ? "Even" : youArePayer ? "You lent" : "You owe";
              const shareColor = (notInvolved || onlyYou) ? "var(--ink-3)" : youArePayer ? "var(--success)" : "var(--rose)";
              const shareAmt = notInvolved ? "—" : onlyYou ? fmtMad(e.amount) : youArePayer ? fmtMad(e.amount - yourShare) : fmtMad(yourShare);
              return (
                <div key={`e-${e.id}`} className="gx-exp-card">
                  <div className="gx-exp-card-top">
                    <div className="gx-exp-card-ic" style={{ background: cat.soft, color: cat.color }}>
                      <Icon name={cat.icon} size={20} />
                    </div>
                    <div className="gx-exp-card-title">
                      <div className="nm">{e.title}</div>
                      <div className="ds">{e.date || "No date"} · {e.time}</div>
                    </div>
                    <div className="gx-exp-card-amount">{fmtMad(e.amount)}</div>
                  </div>
                  <div className="gx-exp-card-meta">
                    <div className="gx-exp-card-field">
                      <span className="lbl">Paid by</span>
                      <span className="val">
                        <Avatar id={e.paidBy} size="sm" />
                        {payer.you ? "You" : payer.name.split(" ")[0]}
                      </span>
                    </div>
                    <div className="gx-exp-card-field">
                      <span className="lbl">Category</span>
                      <span className="val">
                        <span className="cat-pill" style={{ background: cat.pillBg, color: cat.pillFg, marginTop: 0, fontSize: 11 }}>
                          {cat.name}
                        </span>
                      </span>
                    </div>
                    <div className="gx-exp-card-field">
                      <span className="lbl">Your share</span>
                      <span className="val" style={{ color: shareColor }}>{shareLabel} · {shareAmt}</span>
                    </div>
                    <div className="gx-exp-card-field">
                      <span className="lbl">Participants</span>
                      <span className="val">
                        <AvatarStack ids={(e.splitIds.length > 0 ? e.splitIds : (group?.memberIds ?? [])).slice(0, 4)} max={3} />
                      </span>
                    </div>
                  </div>
                  <div className="gx-exp-card-actions">
                    <button className="tbl-act" aria-label="View" onClick={() => setViewExpense(e.id)}><Icon name="search" size={14} /></button>
                    <button className="tbl-act" aria-label="Edit" onClick={() => setEditExpenseId(e.id)}><Icon name="edit" size={14} /></button>
                    <button className="tbl-act danger" aria-label="Delete" onClick={() => deleteExpense(e.id, e.title)}><Icon name="trash" size={14} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pag">
          <span>Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} expenses</span>
          <div className="pag-pages">
            <button className="pag-btn" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><Icon name="chevR" size={12} style={{ transform: "rotate(180deg)" }} /></button>
            {Array.from({ length: totalPages }).map((_, index) => (
              <button key={index + 1} className={"pag-btn" + (currentPage === index + 1 ? " active" : "")} onClick={() => setPage(index + 1)}>
                {index + 1}
              </button>
            ))}
            <button className="pag-btn" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><Icon name="chevR" size={12} /></button>
          </div>
        </div>
      </div>

      {showAddExpense && group && (
        <AddExpenseFullModal
          defaultGroupId={group.id}
          onClose={() => setShowAddExpense(false)}
          onSubmit={async (expense) => {
            await addExpense(expense);
            setShowAddExpense(false);
          }}
        />
      )}

      {showMembers && group && (
        <ManageGroupMembersModal
          group={group}
          onClose={() => setShowMembers(false)}
          onChanged={refetchSplitting}
          onToast={showToast}
        />
      )}

      {(() => {
        const exp = viewExpense ? expenses.find((e) => e.id === viewExpense) : null;
        return exp && group ? (
          <ExpenseDetailModal
            expense={exp}
            group={group}
            onClose={() => setViewExpense(null)}
            onEdit={() => { setViewExpense(null); setEditExpenseId(exp.id); }}
          />
        ) : null;
      })()}

      {(() => {
        const exp = editExpenseId ? expenses.find((e) => e.id === editExpenseId) : null;
        return exp ? (
          <EditExpenseFullModal
            expense={exp}
            onClose={() => setEditExpenseId(null)}
            onSaved={refetchSplitting}
            showToast={showToast}
          />
        ) : null;
      })()}

      {viewSettlement && user && (
        <SettlementDetailModal
          settlement={viewSettlement}
          myId={user.id}
          currency={group?.currency ?? "MAD"}
          onClose={() => setViewSettlement(null)}
          onAccept={async (id) => {
            await settleApi.acceptSettlement(id);
            toast.success("Settlement accepted!");
            setViewSettlement(null);
            await fetchSideData();
          }}
          onReject={async (id) => {
            const result = await Swal.fire({
              title: "Reject Settlement",
              input: "textarea",
              inputLabel: "Reason (optional)",
              showCancelButton: true,
              confirmButtonColor: "#ef4444",
              cancelButtonColor: "#6b7280",
              confirmButtonText: "Reject",
            });
            if (!result.isConfirmed) return;
            await settleApi.rejectSettlement(id, result.value || undefined);
            toast.success("Settlement rejected");
            setViewSettlement(null);
            await fetchSideData();
          }}
        />
      )}

      {/* Floating group chat — only when group is loaded */}
      {group && (
        <GroupChat groupId={groupId} groupName={group.name} />
      )}
    </>
  );
}
