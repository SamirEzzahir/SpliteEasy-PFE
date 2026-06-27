"use client";
// app/expenses/page.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import Icon from "@/components/Icon";
import { Avatar, AvatarStack } from "@/components/Avatar";
import CategoryDonut from "@/components/expenses/CategoryDonut";
import AddExpenseFullModal from "@/components/modals/AddExpenseFullModal";
import EditExpenseFullModal from "@/components/modals/EditExpenseFullModal";
import ExpenseDetailModal from "@/components/modals/ExpenseDetailModal";
import { CATEGORIES, categoryById, personById } from "@/lib/data";
import { fmt } from "@/lib/format";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth/AuthContext";
import { expensesApi } from "@/lib/api/expenses";
import { SkeletonStatCard, SkeletonExpenseRow } from "@/components/Skeleton";
import StatCard from "@/components/ui/StatCard";
import FilterDropdown from "@/components/ui/FilterDropdown";
import Pagination from "@/components/ui/Pagination";
import SharePill from "@/components/ui/SharePill";
import type { Expense } from "@/lib/types";

const PER_PAGE = 7;

type SortCol = "date" | "amount" | "group";

// ── helpers ──────────────────────────────────────────────────────────────────

// e.date is a pre-formatted display string ("6 days ago"); date math must use the
// raw ISO timestamp in e._rawDate (same approach as the group detail page).
function rawTs(e: Expense): number {
  const iso = e._rawDate;
  if (!iso) return NaN;
  return new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime();
}

function isThisMonth(e: Expense): boolean {
  const t = rawTs(e);
  if (Number.isNaN(t)) return false;
  const d = new Date(t);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isLastMonth(e: Expense): boolean {
  const t = rawTs(e);
  if (Number.isNaN(t)) return false;
  const d = new Date(t);
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear();
}

// myId param replaces hardcoded ME constant — fixes data correctness for all users
function myShareInfo(e: Expense, myId: string) {
  const youArePayer = e.paidBy === myId;
  const inSplit = e.splitIds.includes(myId);
  if (!youArePayer && !inSplit) return null; // truly not involved → "—"
  // You paid and you're the only participant → "Not Split" (neutral, no lend/owe)
  const onlyYou = youArePayer && (e.splitIds.length === 0 || (e.splitIds.length === 1 && e.splitIds[0] === myId));
  if (onlyYou) return { label: `Not Split ${fmt(e.amount, e.currency)}`, type: "self" as const, amount: 0 };
  const share = e.amount / Math.max(1, e.splitIds.length);
  if (youArePayer) {
    const lent = e.amount - share;
    return { label: `Lent ${fmt(lent, e.currency)}`, type: "lent" as const, amount: lent };
  }
  return { label: `Owe ${fmt(share, e.currency)}`, type: "owe" as const, amount: share };
}


// ── SortTh — reusable sortable column header ──────────────────────────────────

function SortTh({
  col, label, sortCol, sortDir, onSort, style,
}: {
  col: SortCol;
  label: string;
  sortCol: SortCol;
  sortDir: "asc" | "desc";
  onSort: (col: SortCol) => void;
  style?: React.CSSProperties;
}) {
  const active = sortCol === col;
  return (
    <th
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", ...style }}
      onClick={() => onSort(col)}
      aria-sort={active ? (sortDir === "desc" ? "descending" : "ascending") : "none"}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        <Icon
          name="sortArrows"
          size={11}
          style={{
            verticalAlign: "middle",
            opacity: active ? 1 : 0.35,
            color: active ? "var(--primary)" : undefined,
            transform: active && sortDir === "asc" ? "scaleY(-1)" : "none",
            transition: "transform .15s",
          }}
        />
      </span>
    </th>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { expenses, addExpense, groups, showToast, loading, refetchSplitting } = useApp();
  const { user } = useAuth();

  // Fix: derive myId from authenticated user instead of hardcoded string
  const myId = String(user?.id ?? "");
  const userCurrency = user?.preferred_currency || "MAD";

  const [filter, setFilter] = useState<"all" | "personal" | "bygroup">("all");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [viewExpenseId, setViewExpenseId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [dateFilter, setDateFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => { setPage(1); }, [filter, query, dateFilter, groupFilter, categoryFilter, sortCol, sortDir]);
  // Reset collapse state when leaving By Group view
  useEffect(() => { if (filter !== "bygroup") setCollapsedGroups(new Set()); }, [filter]);

  const hasActiveFilters = dateFilter !== "all" || groupFilter !== "all" || categoryFilter !== "all" || query.trim() !== "";

  function clearFilters() {
    setQuery("");
    setDateFilter("all");
    setGroupFilter("all");
    setCategoryFilter("all");
  }

  // ── Sort toggle ──────────────────────────────────────────────────────────────
  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  // ── Filter / sort options ────────────────────────────────────────────────────
  const dateOptions = [
    { id: "all", label: "All Time" },
    { id: "thisMonth", label: "This Month" },
    { id: "lastMonth", label: "Last Month" },
  ];
  const groupOptions = [
    { id: "all", label: "All Groups" },
    ...groups.map((g) => ({ id: g.id, label: g.name })),
  ];
  const categoryOptions = [
    { id: "all", label: "All Categories" },
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.name })),
  ];

  // ── Tab counts (now use myId not ME) ────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    all: expenses.length,
    personal: expenses.filter((e) => e.paidBy === myId).length,
  }), [expenses, myId]);

  // ── Filtered + sorted list ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = expenses;
    if (filter === "personal") list = list.filter((e) => e.paidBy === myId);
    if (dateFilter === "thisMonth") list = list.filter((e) => isThisMonth(e));
    if (dateFilter === "lastMonth") list = list.filter((e) => isLastMonth(e));
    if (groupFilter !== "all") list = list.filter((e) => e.groupId === groupFilter);
    if (categoryFilter !== "all") list = list.filter((e) => e.categoryId === categoryFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      // Search by expense name AND by participant/payer names (same model as /groups)
      list = list.filter((e) => {
        if (e.title.toLowerCase().includes(q)) return true;
        const ids = [e.paidBy, ...e.splitIds];
        return ids.some((id) => personById(id).name.toLowerCase().includes(q));
      });
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "date") cmp = (rawTs(a) || 0) - (rawTs(b) || 0);
      if (sortCol === "amount") cmp = a.amount - b.amount;
      if (sortCol === "group") cmp = (a.groupId ?? "").localeCompare(b.groupId ?? "");
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [expenses, filter, query, dateFilter, groupFilter, categoryFilter, sortCol, sortDir, myId]);

  // ── By Group — true grouping structure ──────────────────────────────────────
  const groupedData = useMemo(() => {
    if (filter !== "bygroup") return null;
    const map = new Map<string, { groupName: string; groupColor: string; expenses: Expense[] }>();
    for (const e of filtered) {
      const key = e.groupId ?? "__personal__";
      const g = groups.find((x) => x.id === e.groupId);
      if (!map.has(key)) map.set(key, { groupName: g?.name ?? "Personal", groupColor: g?.color ?? "var(--primary)", expenses: [] });
      map.get(key)!.expenses.push(e);
    }
    return Array.from(map.entries())
      .map(([key, val]) => ({ key, ...val, subtotal: val.expenses.reduce((s, e) => s + e.amount, 0) }))
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [filter, filtered, groups]);

  // ── Pagination (flat view only) ──────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Stat calculations ────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const thisMonthExp = expenses.filter((e) => isThisMonth(e));
    const lastMonthExp = expenses.filter((e) => isLastMonth(e));
    const thisMonthTotal = thisMonthExp.reduce((s, e) => s + e.amount, 0);
    const lastMonthTotal = lastMonthExp.reduce((s, e) => s + e.amount, 0);
    const monthDelta = lastMonthTotal > 0
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
      : null;

    // iOwe: sum of "owe" shares across all expenses
    let iOwe = 0;
    // youAreOwed: sum of amounts others owe me (I paid, they're in split)
    let youAreOwed = 0;
    for (const e of expenses) {
      const info = myShareInfo(e, myId);
      if (!info) continue;
      if (info.type === "owe") iOwe += info.amount;
      if (info.type === "lent") youAreOwed += info.amount;
    }

    return { total, thisMonth: thisMonthTotal, thisMonthCount: thisMonthExp.length, monthDelta, iOwe, youAreOwed };
  }, [expenses, myId]);

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.forEach((e) => { m[e.categoryId] = (m[e.categoryId] || 0) + e.amount; });
    return CATEGORIES.map((c) => ({ ...c, amount: m[c.id] || 0 })).filter((c) => c.amount > 0);
  }, [expenses]);

  const byGroup = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.forEach((e) => { m[e.groupId] = (m[e.groupId] || 0) + e.amount; });
    return groups.map((g) => ({ ...g, amount: m[g.id] || 0 }))
      .filter((g) => g.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [expenses, groups]);

  function renderDelta(delta: number | null) {
    if (delta === null) return <span style={{ color: "var(--ink-4)", fontSize: 11 }}>No prior month data</span>;
    const pos = delta >= 0;
    return (
      <>
        <span className={`delta ${pos ? "neg" : "pos"}`}>{pos ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}%</span>
        {" "}vs last month
      </>
    );
  }

  // ── Delete — exact pattern from groups/[id]/page.tsx ────────────────────────
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
          <span style={{ fontSize: 14 }}><strong>"{title}"</strong> will be deleted</span>
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

  // ── CSV Export — client-side, respects active filters + sort ────────────────
  const exportCSV = () => {
    const headers = ["Title", "Group", "Paid By", "Amount", "Currency", "Your Share", "Date"];
    const rows = filtered.map((e) => {
      const g = groups.find((x) => x.id === e.groupId);
      const payer = personById(e.paidBy);
      const share = myShareInfo(e, myId);
      return [
        `"${e.title.replace(/"/g, '""')}"`,
        `"${(g?.name ?? "").replace(/"/g, '""')}"`,
        `"${payer.you ? "You" : payer.name}"`,
        e.amount.toFixed(2),
        e.currency ?? userCurrency,
        share ? `"${share.label}"` : "",
        e.date,
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Shared expense row renderer ──────────────────────────────────────────────
  function renderExpenseRow(e: Expense) {
    const cat = categoryById(e.categoryId);
    const payer = personById(e.paidBy);
    const g = groups.find((x) => x.id === e.groupId);
    const share = myShareInfo(e, myId);
    return (
      <tr key={e.id}>
        <td>
          <div className="exp-cell">
            <div className="ic" style={{ background: cat.soft, color: cat.color }}>
              <Icon name={cat.icon} size={18} />
            </div>
            <div className="body">
              <div className="nm">{e.title}</div>
              <div className="ds">{e.subtitle || cat.name}</div>
            </div>
          </div>
        </td>
        <td>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{g?.name || "—"}</span>
            {g && <AvatarStack ids={g.memberIds} max={3} />}
          </div>
        </td>
        <td>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar id={e.paidBy} size="sm" />
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
              {payer.you ? "You" : payer.name.split(" ")[0]}
            </span>
          </div>
        </td>
        <td>
          <div className="exp-amt num">{fmt(e.amount, e.currency)}</div>
        </td>
        <td>
          {share ? (
            <SharePill kind={share.type === "owe" ? "owe" : share.type === "lent" ? "lent" : "neutral"}>{share.label}</SharePill>
          ) : (
            <SharePill kind="neutral">—</SharePill>
          )}
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
          <div className="exp-date">{e.date || "No date"}</div>
          <div className="exp-time">{e.time}</div>
        </td>
        <td>
          <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
            <button className="tbl-act" aria-label="View" onClick={() => setViewExpenseId(e.id)}>
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
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Expenses</h1>
          <p>Track and manage all shared expenses.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Icon name="download" size={14} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={14} /> Add Expense
          </button>
        </div>
      </div>

      <div className="page-2col">
        <div>
          {/* ── Stat cards ── */}
          <div className="ui-stat-grid cols-4">
            {loading ? (
              <><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /></>
            ) : (
              <>
                <StatCard icon="wallet" tone="primary" label="Total Spent"
                  value={totals.total} currency={userCurrency}
                  sub={`${expenses.length} transactions · all time`} />
                <StatCard icon="receipt" tone="neutral" label="This Month"
                  value={fmt(totals.thisMonth, userCurrency)}
                  sub={renderDelta(totals.monthDelta)} />
                <StatCard icon="coin" tone="success" label="You Are Owed"
                  value={totals.youAreOwed} currency={userCurrency}
                  colorValue={totals.youAreOwed > 0} sub="others owe you" />
                <StatCard icon="wallet" tone="danger" label="You Owe"
                  value={totals.iOwe} currency={userCurrency}
                  colorValue={totals.iOwe > 0} sub="across all groups" />
              </>
            )}
          </div>

          {/* ── Table card ── */}
          <div className="card" style={{ padding: 18 }}>
            {/* Tabs */}
            <div className="tabs">
              {(["all", "personal", "bygroup"] as const).map((t) => (
                <button
                  key={t}
                  className={"tab" + (filter === t ? " active" : "")}
                  onClick={() => setFilter(t)}
                >
                  {t === "all" ? "All" : t === "personal" ? "Paid by Me" : "By Group"}
                  {t !== "bygroup" && (
                    <span className="tab-badge" style={filter !== t ? { background: "var(--line)", color: "var(--ink-3)" } : undefined}>
                      {t === "all" ? tabCounts.all : tabCounts.personal}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Filter row */}
            <div className="filter-row">
              <FilterDropdown icon="receipt" label="All Time"       options={dateOptions}     value={dateFilter}     onChange={setDateFilter} />
              <FilterDropdown icon="groups"  label="All Groups"     options={groupOptions}    value={groupFilter}    onChange={setGroupFilter} />
              <FilterDropdown icon="filter"  label="All Categories" options={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} />
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "7px 12px", borderRadius: 10, border: "1px solid var(--line)",
                    background: "none", fontSize: 12.5, color: "var(--ink-3)", cursor: "pointer", fontWeight: 500,
                  }}
                  aria-label="Clear all filters"
                >
                  <Icon name="close" size={12} /> Clear
                </button>
              )}
              <div className="filter-grow" />
              <div className="search" style={{ width: 220 }}>
                <Icon name="search" size={14} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search expenses…"
                  aria-label="Search expenses"
                />
              </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 ? (
              <div style={{ padding: "56px 24px", textAlign: "center" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, background: "#eeecff", color: "#5b4ef0",
                  display: "grid", placeItems: "center", margin: "0 auto 16px",
                }}>
                  <Icon name="receipt" size={24} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No expenses found</div>
                <div style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 18 }}>
                  {hasActiveFilters ? "Try adjusting your search or filters" : "Add your first expense to get started"}
                </div>
                {hasActiveFilters && (
                  <button className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>
                )}
              </div>
            ) : filter === "bygroup" && groupedData ? (
              /* ── By Group: true grouped view with collapsible headers ── */
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table className="exp-table" style={{ minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th>Expense</th>
                      <th>Paid by</th>
                      <th>Amount</th>
                      <th>Your Share</th>
                      <th>Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData.map(({ key, groupName, groupColor, expenses: groupExp, subtotal }) => {
                      const collapsed = collapsedGroups.has(key);
                      return [
                        /* Group header row */
                        <tr
                          key={`hd-${key}`}
                          style={{ cursor: "pointer", background: "var(--surface-2, #f8f9fa)" }}
                          onClick={() => setCollapsedGroups((prev) => {
                            const next = new Set(prev);
                            collapsed ? next.delete(key) : next.add(key);
                            return next;
                          })}
                        >
                          <td colSpan={4} style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Icon
                                name="chevR"
                                size={12}
                                style={{
                                  color: "var(--ink-3)",
                                  transform: collapsed ? "none" : "rotate(90deg)",
                                  transition: "transform .15s",
                                  flexShrink: 0,
                                }}
                              />
                              <div style={{
                                width: 10, height: 10, borderRadius: "50%",
                                background: groupColor, flexShrink: 0,
                              }} />
                              <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>
                                {groupName}
                              </span>
                              <span style={{
                                background: "var(--line)", color: "var(--ink-3)",
                                borderRadius: 999, fontSize: 11, fontWeight: 700,
                                padding: "1px 7px",
                              }}>
                                {groupExp.length}
                              </span>
                            </div>
                          </td>
                          <td colSpan={2} style={{ padding: "10px 12px", textAlign: "right" }}>
                            <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                              {fmt(subtotal, userCurrency)}
                            </span>
                          </td>
                        </tr>,
                        /* Expense rows — hidden when collapsed */
                        ...(collapsed ? [] : groupExp.map((e) => renderExpenseRow(e))),
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ── Flat view with pagination ── */
              <>
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table className="exp-table" style={{ minWidth: 640 }}>
                    <thead>
                      <tr>
                        <th>Expense</th>
                        <th>Group</th>
                        <th>Paid by</th>
                        <SortTh col="amount" label="Amount"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                        <th>Your Share</th>
                        <SortTh col="date"   label="Date"    sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {loading
                        ? Array.from({ length: 7 }).map((_, i) => <SkeletonExpenseRow key={i} />)
                        : paginated.map((e) => renderExpenseRow(e))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onChange={setPage}
                  summary={`${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, filtered.length)} of ${filtered.length} expenses`}
                />
              </>
            )}
          </div>
        </div>

        {/* ── Rail ── */}
        <div className="rail">
          <div className="rail-card">
            <div className="rail-head"><h3>Spending by Category</h3></div>
            <div className="rail-donut-wrap">
              <div className="rail-donut">
                <CategoryDonut data={byCategory} total={totals.total} />
              </div>
              <div className="rail-legend">
                {byCategory.slice(0, 6).map((c) => (
                  <div key={c.id} className="rail-legend-row">
                    <div className="dotc" style={{ background: c.color }} />
                    <span>{c.name}</span>
                    <div style={{ textAlign: "right" }}>
                      <b className="num" style={{ display: "block", fontSize: 12 }}>
                        {Math.round((c.amount / totals.total) * 100)}%
                      </b>
                      <span style={{ fontSize: 11, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
                        {fmt(c.amount, userCurrency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rail-card">
            <div className="rail-head">
              <h3>Top Spending Groups</h3>
            </div>
            <div className="spend-list">
              {byGroup.map((g) => {
                const pct = Math.round((g.amount / byGroup[0].amount) * 100);
                return (
                  <div key={g.id} className="spend-row">
                    <div className="spend-row-h">
                      <span className="nm">{g.name}</span>
                      <span className="amt num">{fmt(g.amount, g.currency)}</span>
                    </div>
                    <div className="spend-bar" title={`${pct}% of top group`}>
                      <div className="spend-bar-fill" style={{ width: pct + "%", background: g.color }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: -2 }}>{pct}% of highest</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {showAdd && (
        <AddExpenseFullModal
          onClose={() => setShowAdd(false)}
          onSubmit={(e) => { addExpense(e); setShowAdd(false); }}
        />
      )}

      {(() => {
        const exp = editExpenseId ? expenses.find((e) => e.id === editExpenseId) : null;
        return exp ? (
          <EditExpenseFullModal
            expense={exp}
            onClose={() => setEditExpenseId(null)}
            onSaved={async () => { setEditExpenseId(null); await refetchSplitting(); }}
            showToast={showToast}
          />
        ) : null;
      })()}

      {(() => {
        const exp = viewExpenseId ? expenses.find((e) => e.id === viewExpenseId) : null;
        const g = exp ? groups.find((x) => x.id === exp.groupId) : null;
        return exp && g ? (
          <ExpenseDetailModal
            expense={exp}
            group={g}
            onClose={() => setViewExpenseId(null)}
            onEdit={() => { setViewExpenseId(null); setEditExpenseId(exp.id); }}
          />
        ) : null;
      })()}
    </>
  );
}
