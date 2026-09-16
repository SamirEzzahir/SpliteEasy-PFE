"use client";
import { usePreferences } from "@/hooks/usePreferences";
// app/groups/[id]/page.tsx — Group Activity (expenses + settlements)

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import PageHeader from "@/components/ui/PageHeader";
import PageTabs from "@/components/ui/PageTabs";
import FilterPanel from "@/components/ui/FilterPanel";
import Icon from "@/components/Icon";
import { Avatar, AvatarStack } from "@/components/Avatar";
import AddExpenseFullModal from "@/components/modals/AddExpenseFullModal";
import EditExpenseFullModal from "@/components/modals/EditExpenseFullModal";
import ExpenseDetailModal from "@/components/modals/ExpenseDetailModal";
import SettlementDetailModal from "@/components/modals/SettlementDetailModal";
import ManageGroupMembersModal from "@/components/modals/ManageGroupMembersModal";
import GroupChat from "@/components/chat/GroupChat";
import { SkeletonGroupExpenseRow, SkeletonGroupStat } from "@/components/Skeleton";
import StatCard from "@/components/ui/StatCard";
import Pagination from "@/components/ui/Pagination";
import SharePill from "@/components/ui/SharePill";
import { CATEGORIES, categoryById, personById } from "@/lib/data";
import { fmt, fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth/AuthContext";
import { expensesApi } from "@/lib/api/expenses";
import { settleApi } from "@/lib/api/settle";
import { useApp } from "@/lib/store";
import type { ApiBalanceEntry, ApiSettlement } from "@/lib/api/types";
import type { Expense } from "@/lib/types";

type UnifiedRow =
  | { kind: "expense";    data: Expense;       ts: number }
  | { kind: "settlement"; data: ApiSettlement; ts: number };

export default function GroupDetailPage() {
  usePreferences();
  const params  = useParams<{ id: string }>();
  const router  = useRouter();
  const { user } = useAuth();
  const { groups, expenses, addExpense, refetchSplitting, showToast, loading } = useApp();

  const groupId = String(params.id);
  const group = groups.find((g) => g.id === groupId);
  const isDefaultPersonal = group?.isDefaultPersonal === true;
  const hasGroup = !!group;
  // Convenience: group currency with MAD fallback
  const currency = group?.currency ?? "MAD";

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"expenses" | "balances" | "members" | "chat">("expenses");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("tab") === "balances") setTab("balances"); }, []);
  useEffect(() => { if (isDefaultPersonal) setTab("expenses"); }, [isDefaultPersonal]);
  const [query,          setQuery]          = useState("");
  const [monthFilter,    setMonthFilter]    = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paidByFilter,   setPaidByFilter]   = useState("all");
  const [page,           setPage]           = useState(1);
  const pageSize = 7;

  // ── Side data (balances + settlement history — fetched independently) ────────
  const [balances,           setBalances]           = useState<ApiBalanceEntry[]>([]);
  const [settlementHistory,  setSettlementHistory]  = useState<ApiSettlement[]>([]);
  const [showSettlements,    setShowSettlements]    = useState(true);

  // ── Modal visibility ─────────────────────────────────────────────────────────
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showMembers,    setShowMembers]    = useState(false);
  const [viewExpense,    setViewExpense]    = useState<string | null>(null);
  const [viewSettlement, setViewSettlement] = useState<ApiSettlement | null>(null);
  const [editExpenseId,  setEditExpenseId]  = useState<string | null>(null);
  // Fix: track whether edit was opened from inside ExpenseDetailModal so we can restore it on cancel
  const [editFromView,   setEditFromView]   = useState(false);

  // ── Mobile UI ────────────────────────────────────────────────────────────────
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // ── Settlement inline action loading state ───────────────────────────────────
  const [actingSettlementId, setActingSettlementId] = useState<string | null>(null);

  // ── Side data fetch ──────────────────────────────────────────────────────────
  const fetchSideData = useCallback(async () => {
    if (!groupId || !hasGroup) return;
    if (isDefaultPersonal) {
      setBalances([]);
      setSettlementHistory([]);
      return;
    }
    const [bal, hist] = await Promise.allSettled([
      settleApi.groupBalances(groupId),
      settleApi.groupHistory(groupId),
    ]);
    if (bal.status  === "fulfilled") setBalances(bal.value);
    if (hist.status === "fulfilled") setSettlementHistory(hist.value);
  }, [groupId, hasGroup, isDefaultPersonal]);

  useEffect(() => { fetchSideData(); }, [fetchSideData]);

  // ── Derived data ──────────────────────────────────────────────────────────────
  const groupExpenses = useMemo(
    () => expenses.filter((e) => String(e.groupId) === String(params.id)),
    [expenses, params.id],
  );

  // Build unified sorted feed (expenses + optional settlements)
  const unifiedRows = useMemo((): UnifiedRow[] => {
    const toTs = (iso?: string) =>
      iso ? new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime() : 0;
    const expRows: UnifiedRow[] = groupExpenses.map((e) => ({
      kind: "expense", data: e, ts: toTs(e._rawDate),
    }));
    const settleRows: UnifiedRow[] = settlementHistory.map((s) => ({
      kind: "settlement", data: s, ts: toTs(s.created_at),
    }));
    const combined = showSettlements && !isDefaultPersonal ? [...expRows, ...settleRows] : expRows;
    return combined.sort((a, b) => b.ts - a.ts);
  }, [groupExpenses, settlementHistory, showSettlements, isDefaultPersonal]);

  // Filter unified rows
  // Fix: date filter now applies to settlements as well as expenses (symmetric behaviour)
  const filtered = useMemo(() => {
    const now = new Date();
    const q   = query.toLowerCase();
    return unifiedRows.filter((row) => {
      if (row.kind === "settlement") {
        const s = row.data;
        // Apply same date filter to settlements — symmetric with expenses
        if (monthFilter === "this") {
          const d = s.created_at
            ? new Date(s.created_at.endsWith("Z") ? s.created_at : s.created_at + "Z")
            : new Date(NaN);
          const inMonth = Number.isNaN(d.getTime()) ||
            (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
          if (!inMonth) return false;
        }
        if (!q.trim()) return true;
        return `settlement ${s.from_username ?? ""} ${s.to_username ?? ""}`.toLowerCase().includes(q);
      }

      const e = row.data;
      // Search by expense name AND by participant/payer names (same model as /groups)
      const matchesQuery = !q.trim()
        || `${e.title} ${e.subtitle}`.toLowerCase().includes(q)
        || [e.paidBy, ...e.splitIds].some((id) => personById(id).name.toLowerCase().includes(q));
      const matchesCategory = categoryFilter === "all" || e.categoryId === categoryFilter;
      const matchesPayer    = paidByFilter === "all" || e.paidBy === paidByFilter;
      let matchesMonth = true;
      if (monthFilter === "this") {
        const d = e._rawDate
          ? new Date(e._rawDate.endsWith("Z") ? e._rawDate : e._rawDate + "Z")
          : new Date(NaN);
        matchesMonth = Number.isNaN(d.getTime()) ||
          (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
      }
      return matchesQuery && matchesCategory && matchesPayer && matchesMonth;
    });
  }, [categoryFilter, unifiedRows, monthFilter, paidByFilter, query]);

  useEffect(() => { setPage(1); }, [query, monthFilter, categoryFilter, paidByFilter]);

  // Fix: "Settled" now computed from real accepted settlement records, not an approximation
  const totals = useMemo(() => {
    const total = groupExpenses.reduce((s, e) => s + e.amount, 0);
    const currentRow = balances.find((b) => b.user_id === user?.id);
    const currentNet = currentRow?.net ?? currentRow?.balance ?? group?.balance ?? 0;
    const youOwe     = currentNet < 0 ? Math.abs(currentNet) : 0;
    const youAreOwed = currentNet > 0 ? currentNet : 0;
    const unsettled  = balances
      .filter((b) => (b.net ?? b.balance ?? 0) > 0)
      .reduce((sum, b) => sum + (b.net ?? b.balance ?? 0), 0);
    // Real settled: sum of accepted settlement amounts (previously was an approximation)
    const settled = settlementHistory
      .filter((h) => h.status === "accepted")
      .reduce((sum, h) => sum + h.amount, 0);
    return { total, youOwe, youAreOwed, unsettled, settled };
  }, [balances, group?.balance, groupExpenses, settlementHistory, user?.id]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged       = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const currentUserId = String(user?.id || "");
  const groupPayers   = Array.from(new Set(groupExpenses.map((e) => e.paidBy)));

  const settleUp = () => { if (group && !isDefaultPersonal) router.push(`/groups/${group.id}/settle`); };

  // ── Actions ──────────────────────────────────────────────────────────────────

  // Fix: remove Swal confirm — undo toast IS the confirmation (removes double-friction)
  const deleteExpense = async (expenseId: string, title: string) => {
    let undone = false;
    const doDelete = async () => {
      if (undone) return;
      try {
        await expensesApi.remove(expenseId);
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
            <strong>&ldquo;{title}&rdquo;</strong> will be deleted
          </span>
          <button
            onClick={() => {
              undone = true;
              clearTimeout(timer);
              closeToast?.();
              toast.info("Delete cancelled");
            }}
            style={{
              background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)",
              color: "#fff", borderRadius: 6, padding: "3px 10px",
              fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Undo
          </button>
        </div>
      ),
      { autoClose: 5000, closeOnClick: false },
    );
  };

  // Inline settlement accept — surfaces action without requiring modal open
  const acceptSettlementInline = async (id: string) => {
    setActingSettlementId(id);
    try {
      await settleApi.acceptSettlement(id);
      toast.success("Settlement accepted!");
      await fetchSideData();
    } catch {
      toast.error("Could not accept settlement");
    } finally {
      setActingSettlementId(null);
    }
  };

  // Inline settlement reject
  const rejectSettlementInline = async (id: string) => {
    const result = await Swal.fire({
      title: "Reject Settlement",
      input: "textarea",
      inputLabel: "Reason (optional)",
      inputPlaceholder: "Why are you rejecting this?",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Reject",
    });
    if (!result.isConfirmed) return;
    setActingSettlementId(id);
    try {
      await settleApi.rejectSettlement(id, result.value || undefined);
      toast.success("Settlement rejected");
      await fetchSideData();
    } catch {
      toast.error("Could not reject settlement");
    } finally {
      setActingSettlementId(null);
    }
  };

  // ── 404 state ────────────────────────────────────────────────────────────────
  if (!loading && !group) {
    return (
      // Fix: add role="alert" for ARIA — screen readers announce this immediately
      <div role="alert">
        <div className="page-head">
          <div>
            <h1>Group not found</h1>
            <p>That group doesn&apos;t exist or you don&apos;t have access.</p>
          </div>
        </div>
        <Link href="/groups" className="btn btn-primary" style={{ width: "fit-content" }}>
          ← Back to groups
        </Link>
      </div>
    );
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  // Settlement status pill
  const statusPill = (status: string) => {
    if (status === "accepted") return <span className="st-pill accepted">✅ Accepted</span>;
    if (status === "rejected") return <span className="st-pill rejected">❌ Rejected</span>;
    return <span className="st-pill pending">🕐 Pending</span>;
  };

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader title={group?.name || "Group"} subtitle={isDefaultPersonal ? `Your private expenses · ${currency}` : `${group?.memberIds.length || 0} members · ${currency}`}
        breadcrumbs={[{label: "Groups", href: "/groups"}, {label: group?.name || "Loading…"}]}
        actions={<button className="btn btn-primary" onClick={() => setShowAddExpense(true)}><Icon name="plus" size={16} />Add expense</button>} />
      <div className="ui-stat-grid cols-2">
        {loading ? <><SkeletonGroupStat /><SkeletonGroupStat /></> : isDefaultPersonal ? <>
          <StatCard icon="wallet" tone="neutral" label="Total expenses" value={totals.total} currency={currency} sub="Your personal spending" />
          <StatCard icon="receipt" tone="primary" label="Expenses" value={groupExpenses.length} sub="Only visible to you" />
        </> : <>
          <StatCard icon="download" tone="danger" label="You owe" value={totals.youOwe} currency={currency} sub="To the group" />
          <StatCard icon="upload" tone="success" label="You are owed" value={totals.youAreOwed} currency={currency} sub="From the group" />
        </>}
      </div>
      <p className="field-help">{groupExpenses.length} expenses · {fmt(totals.total, currency)} total{!isDefaultPersonal && <> · {fmt(totals.settled, currency)} in confirmed payments</>}</p>
      <PageTabs id="group-tabs" label="Group sections" value={isDefaultPersonal ? "expenses" : tab} onChange={setTab} items={isDefaultPersonal ? [{value: "expenses", label: "Expenses"}] : [
        {value: "expenses", label: "Expenses"}, {value: "balances", label: "Balances"},
        {value: "members", label: "Members"}, {value: "chat", label: "Chat"},
      ]} />
      <div role="tabpanel" id="group-tabs-panel-expenses" aria-labelledby="group-tabs-expenses" hidden={!isDefaultPersonal && tab !== "expenses"}>
      {/* ── Filters + table card ── */}
      <div className="card" style={{ padding: 18 }}>
        <FilterPanel count={[monthFilter, categoryFilter, paidByFilter].filter((v) => v !== "all").length}>
        <div className="filter-row">
          {/* Fix: active filter state — border + background when non-default */}
          <select
            className="dropdown"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={monthFilter !== "all" ? {
              borderColor: "var(--primary)", background: "var(--primary-soft)", color: "var(--primary)",
            } : undefined}
          >
            <option value="all">All Dates</option>
            <option value="this">This Month</option>
          </select>

          <select
            className="dropdown"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={categoryFilter !== "all" ? {
              borderColor: "var(--primary)", background: "var(--primary-soft)", color: "var(--primary)",
            } : undefined}
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>

          <select
            className="dropdown"
            value={paidByFilter}
            onChange={(e) => setPaidByFilter(e.target.value)}
            style={paidByFilter !== "all" ? {
              borderColor: "var(--primary)", background: "var(--primary-soft)", color: "var(--primary)",
            } : undefined}
          >
            <option value="all">All Paid By</option>
            {groupPayers.map((id) => <option key={id} value={id}>{personById(id).name}</option>)}
          </select>

          {/* Settlement toggle */}
          {!isDefaultPersonal && <button
            className="btn btn-secondary"
            onClick={() => setShowSettlements((v) => !v)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12.5, padding: "6px 12px",
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
                borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "1px 6px",
              }}>
                {settlementHistory.length}
              </span>
            )}
          </button>}

          <div className="filter-grow" />
          <div className="search" style={{ width: 280 }}>
            <Icon name="search" size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search expenses..."
            />
          </div>
        </div>

        </FilterPanel>
        {/* ── Desktop table ── */}
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
              // Fix: proper empty state with icon + CTA
              <tr>
                <td colSpan={8} style={{ padding: "56px 24px", textAlign: "center" }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: "var(--primary-soft)", color: "var(--primary)",
                    display: "grid", placeItems: "center", margin: "0 auto 14px",
                  }}>
                    <Icon name="receipt" size={22} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: "var(--ink)" }}>
                    {query || monthFilter !== "all" || categoryFilter !== "all" || paidByFilter !== "all"
                      ? "No results found"
                      : "No expenses yet"}
                  </div>
                  <div style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 18 }}>
                    {query || monthFilter !== "all" || categoryFilter !== "all" || paidByFilter !== "all"
                      ? "Try adjusting your filters or search query."
                      : "Add your first expense to start tracking splits."}
                  </div>
                  {(query || monthFilter !== "all" || categoryFilter !== "all" || paidByFilter !== "all") ? (
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setQuery(""); setMonthFilter("all"); setCategoryFilter("all"); setPaidByFilter("all"); }}
                    >
                      Clear filters
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => setShowAddExpense(true)}>
                      <Icon name="plus" size={14} /> Add Expense
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              paged.map((row) => {
                // ── Settlement row ──────────────────────────────────────────
                // Fix: single-colspan row — avoids column semantic mismatch.
                // No more "Your Share" column showing a status pill.
                if (row.kind === "settlement") {
                  const s       = row.data;
                  const isPayer = s.from_user_id === user?.id;
                  const canAct  = s.status === "pending" && s.to_user_id === user?.id;
                  const d       = s.created_at
                    ? new Date(s.created_at.endsWith("Z") ? s.created_at : s.created_at + "Z")
                    : null;
                  const dateStr = d ? fmtDate(d) : "—";
                  const timeStr = d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
                  const isActing = actingSettlementId === s.id;

                  return (
                    <tr key={`s-${s.id}`} style={{ borderLeft: "4px solid var(--teal)", background: "rgba(20,184,166,0.05)" }}>
                      <td colSpan={8} style={{ padding: "10px 12px" }}>
                        <div className="settle-inline-row">
                          {/* Icon */}
                          <div style={{
                            width: 34, height: 34, borderRadius: 9,
                            background: "rgba(20,184,166,0.14)", color: "var(--teal)",
                            display: "grid", placeItems: "center", flexShrink: 0,
                          }}>
                            <Icon name="settle" size={16} />
                          </div>

                          {/* From → To */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <Avatar id={String(s.from_user_id)} size="sm" />
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                                {s.from_username ?? `User ${s.from_user_id}`}
                              </span>
                            </div>
                            <Icon name="chevR" size={11} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <Avatar id={String(s.to_user_id)} size="sm" />
                              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-2)" }}>
                                {s.to_username ?? `User ${s.to_user_id}`}
                              </span>
                            </div>
                            <span style={{ fontSize: 11.5, color: "var(--ink-4)", marginLeft: 4 }}>
                              {isPayer ? "· You paid" : "· Paid you"}
                            </span>
                          </div>

                          {/* Amount */}
                          <span style={{ fontWeight: 700, color: "var(--teal)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                            {fmt(s.amount, currency)}
                          </span>

                          {/* Status pill */}
                          {statusPill(s.status)}

                          {/* Date */}
                          <span style={{ fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                            {dateStr}
                            {timeStr && <span style={{ color: "var(--ink-4)" }}> · {timeStr}</span>}
                          </span>

                          {/* Actions */}
                          <div className="tbl-actions">
                            {/* View details */}
                            <button className="tbl-act" aria-label="View settlement" onClick={() => setViewSettlement(s)}>
                              <Icon name="search" size={14} />
                            </button>
                            {/* Fix: inline Accept/Decline for pending settlements — no modal required for binary decision */}
                            {canAct && (
                              <>
                                <button
                                  className="tbl-act"
                                  aria-label="Accept settlement"
                                  disabled={isActing}
                                  title="Accept settlement"
                                  style={{ color: "var(--success)", borderColor: "var(--success-soft)" }}
                                  onClick={() => acceptSettlementInline(s.id)}
                                >
                                  <Icon name="check" size={14} />
                                </button>
                                <button
                                  className="tbl-act danger"
                                  aria-label="Reject settlement"
                                  disabled={isActing}
                                  title="Reject settlement"
                                  onClick={() => rejectSettlementInline(s.id)}
                                >
                                  <Icon name="x" size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // ── Expense row ─────────────────────────────────────────────
                const e = row.data;
                const cat          = categoryById(e.categoryId);
                const payer        = personById(e.paidBy);
                const yourShare    = e.amount / Math.max(1, e.splitIds.length || group?.memberIds.length || 1);
                const youArePayer  = e.paidBy === currentUserId;
                const youParticipate = e.splitIds.length === 0 || e.splitIds.includes(currentUserId);
                const notInvolved  = !youArePayer && !youParticipate;
                const onlyYou      = youArePayer && (e.splitIds.length === 0 || (e.splitIds.length === 1 && e.splitIds[0] === currentUserId));
                const shareLabel   = notInvolved ? "Not split" : onlyYou ? "Even" : youArePayer ? "You lent" : "You owe";
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
                    {/* Fix: use fmt with group currency instead of hardcoded MAD */}
                    <td className="num" style={{ fontWeight: 600, color: "var(--ink)" }}>
                      {fmt(e.amount, currency)}
                    </td>
                    <td>
                      {notInvolved ? (
                        <SharePill kind="neutral">—</SharePill>
                      ) : onlyYou ? (
                        <SharePill kind="neutral">Not Split {fmt(e.amount, currency)}</SharePill>
                      ) : (
                        <SharePill kind={youArePayer ? "lent" : "owe"}>
                          {shareLabel} {youArePayer ? fmt(e.amount - yourShare, currency) : fmt(yourShare, currency)}
                        </SharePill>
                      )}
                    </td>
                    <td>
                      <div className="exp-date">{fmtDate(e._rawDate || e.date) || "No date"}</div>
                      <div className="exp-time">{e.time || ""}</div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                        <button className="tbl-act" aria-label="View" onClick={() => setViewExpense(e.id)}>
                          <Icon name="search" size={14} />
                        </button>
                        <button className="tbl-act" aria-label="Edit" onClick={() => setEditExpenseId(e.id)}>
                          <Icon name="edit" size={14} />
                        </button>
                        <button className="tbl-act danger" aria-label="Delete" onClick={() => deleteExpense(e.id, e.title)}>
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* ── Mobile expense cards ── */}
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
              No activity found.
            </div>
          ) : (
            paged.map((row) => {
              // ── Settlement mobile card ──────────────────────────────────
              if (row.kind === "settlement") {
                const s       = row.data;
                const isPayer = s.from_user_id === user?.id;
                const canAct  = s.status === "pending" && s.to_user_id === user?.id;
                const statusLabel = s.status === "accepted" ? "✅ Accepted" : s.status === "rejected" ? "❌ Rejected" : "🕐 Pending";
                const d = s.created_at ? new Date(s.created_at.endsWith("Z") ? s.created_at : s.created_at + "Z") : null;
                const isActing = actingSettlementId === s.id;

                return (
                  <div key={`s-${s.id}`} className="gx-exp-card" style={{ borderLeft: "4px solid var(--teal)" }}>
                    <div className="gx-exp-card-top">
                      <div className="gx-exp-card-ic" style={{ background: "rgba(20,184,166,0.14)", color: "var(--teal)" }}>
                        <Icon name="settle" size={20} />
                      </div>
                      <div className="gx-exp-card-title">
                        <div className="nm" style={{ color: "var(--teal)", fontWeight: 700 }}>Settlement</div>
                        <div className="ds">{d ? fmtDate(d) : "—"}</div>
                      </div>
                      <div className="gx-exp-card-amount" style={{ color: "var(--teal)" }}>
                        {fmt(s.amount, currency)}
                      </div>
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
                      <button className="tbl-act" aria-label="View" onClick={() => setViewSettlement(s)}>
                        <Icon name="search" size={14} />
                      </button>
                      {/* Fix: inline Accept/Decline on mobile cards too */}
                      {canAct && (
                        <>
                          <button
                            className="tbl-act"
                            style={{ color: "var(--success)", borderColor: "var(--success-soft)" }}
                            disabled={isActing}
                            onClick={() => acceptSettlementInline(s.id)}
                          >
                            <Icon name="check" size={14} />
                          </button>
                          <button
                            className="tbl-act danger"
                            disabled={isActing}
                            onClick={() => rejectSettlementInline(s.id)}
                          >
                            <Icon name="x" size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              }

              // ── Expense mobile card ─────────────────────────────────────
              const e = row.data;
              const cat        = categoryById(e.categoryId);
              const payer      = personById(e.paidBy);
              const splitCount = e.splitIds.length || group?.memberIds.length || 1;
              const yourShare  = e.amount / Math.max(1, splitCount);
              const youArePayer  = e.paidBy === currentUserId;
              const youParticipate = e.splitIds.length === 0 || e.splitIds.includes(currentUserId);
              const notInvolved  = !youArePayer && !youParticipate;
              const onlyYou      = youArePayer && (e.splitIds.length === 0 || (e.splitIds.length === 1 && e.splitIds[0] === currentUserId));
              const shareLabel   = notInvolved ? "Not split" : onlyYou ? "Even" : youArePayer ? "You lent" : "You owe";
              const shareAmt = notInvolved ? "—" : onlyYou
                ? fmt(e.amount, currency)
                : youArePayer
                  ? fmt(e.amount - yourShare, currency)
                  : fmt(yourShare, currency);

              return (
                <div key={`e-${e.id}`} className="gx-exp-card">
                  <div className="gx-exp-card-top">
                    <div className="gx-exp-card-ic" style={{ background: cat.soft, color: cat.color }}>
                      <Icon name={cat.icon} size={20} />
                    </div>
                    <div className="gx-exp-card-title">
                      <div className="nm">{e.title}</div>
                      <div className="ds">{fmtDate(e._rawDate || e.date) || "No date"} · {e.time}</div>
                    </div>
                    <div className="gx-exp-card-amount">{fmt(e.amount, currency)}</div>
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
                      <span className="val">
                        {notInvolved ? (
                          <SharePill kind="neutral">Not split</SharePill>
                        ) : onlyYou ? (
                          <SharePill kind="neutral">Not Split {fmt(e.amount, currency)}</SharePill>
                        ) : (
                          <SharePill kind={youArePayer ? "lent" : "owe"}>{shareLabel} {shareAmt}</SharePill>
                        )}
                      </span>
                    </div>
                    <div className="gx-exp-card-field">
                      <span className="lbl">Participants</span>
                      <span className="val">
                        <AvatarStack ids={(e.splitIds.length > 0 ? e.splitIds : (group?.memberIds ?? [])).slice(0, 4)} max={3} />
                      </span>
                    </div>
                  </div>
                  <div className="gx-exp-card-actions">
                    <button className="tbl-act" aria-label="View" onClick={() => setViewExpense(e.id)}>
                      <Icon name="search" size={14} />
                    </button>
                    <button className="tbl-act" aria-label="Edit" onClick={() => setEditExpenseId(e.id)}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button className="tbl-act danger" aria-label="Delete" onClick={() => deleteExpense(e.id, e.title)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Pagination
          page={currentPage}
          totalPages={totalPages}
          onChange={setPage}
          summary={`Showing ${filtered.length ? (currentPage - 1) * pageSize + 1 : 0} to ${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} items`}
        />
      </div>

      </div>
      {!isDefaultPersonal && <><section role="tabpanel" id="group-tabs-panel-balances" aria-labelledby="group-tabs-balances" hidden={tab !== "balances"}>
        <div className="section-heading"><h2>Member balances</h2><button className="btn btn-primary" onClick={settleUp}>Record a payment</button></div>
        <div className="group-balances-list">{balances.map((entry) => {
          const net = entry.net ?? entry.balance ?? 0;
          return <div className="group-balance-row" key={entry.user_id}><span>{entry.username || personById(entry.user_id).name}</span>
            <strong className={net < 0 ? "neg" : net > 0 ? "pos" : ""}>{net < 0 ? "Owes " : net > 0 ? "Is owed " : "Settled "}{fmt(Math.abs(net), currency)}</strong></div>;
        })}</div>
        <h3>Payments</h3><p className="field-help">Review a recorded payment to confirm receipt or view its status.</p>
        {settlementHistory.length ? settlementHistory.map((payment) => <button className="group-balance-row" style={{width: "100%", textAlign: "left"}} key={payment.id} onClick={() => setViewSettlement(payment)}>
          <span>{payment.from_username || personById(payment.from_user_id).name} → {payment.to_username || personById(payment.to_user_id).name}<small style={{display: "block"}}>{payment.status === "pending" ? "Awaiting confirmation" : payment.status}</small></span>
          <strong>{fmt(payment.amount, currency)}</strong>
        </button>) : <p className="field-help">No payments recorded yet.</p>}
      </section>
      <section role="tabpanel" id="group-tabs-panel-members" aria-labelledby="group-tabs-members" hidden={tab !== "members"}>
        <div className="section-heading"><h2>{group?.memberIds.length || 0} members</h2><button className="btn btn-secondary" onClick={() => setShowMembers(true)}>Manage members</button></div>
        <div className="group-members-grid">{group?.memberIds.map((id) => <div className="group-member-row" key={id}><span>{personById(id).name}</span><span className="field-help">{id === group.ownerId ? "Owner" : "Member"}</span></div>)}</div>
      </section>
      <section role="tabpanel" id="group-tabs-panel-chat" aria-labelledby="group-tabs-chat" hidden={tab !== "chat"}>
        {tab === "chat" && group && <GroupChat groupId={group.id} groupName={group.name} embedded />}
      </section></>}

      {/* ── Modals ── */}
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

      {showMembers && group && !isDefaultPersonal && (
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
            // Fix: track that we came from view so edit cancel can restore it
            onEdit={() => {
              setEditFromView(true);
              setViewExpense(null);
              setEditExpenseId(exp.id);
            }}
          />
        ) : null;
      })()}

      {(() => {
        const exp = editExpenseId ? expenses.find((e) => e.id === editExpenseId) : null;
        return exp ? (
          <EditExpenseFullModal
            expense={exp}
            // Fix: if user cancels edit (not saves), restore ExpenseDetailModal so they don't lose their place
            onClose={() => {
              const prevId = editExpenseId;
              setEditExpenseId(null);
              if (editFromView && prevId) {
                setViewExpense(prevId);
              }
              setEditFromView(false);
            }}
            onSaved={async () => {
              setEditExpenseId(null);
              setEditFromView(false);
              await refetchSplitting();
            }}
            showToast={showToast}
          />
        ) : null;
      })()}

      {viewSettlement && user && !isDefaultPersonal && (
        <SettlementDetailModal
          settlement={viewSettlement}
          myId={user.id}
          currency={currency}
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

      {/* Floating group chat */}
      {group && !isDefaultPersonal && <GroupChat groupId={groupId} groupName={group.name} />}
    </>
  );
}
