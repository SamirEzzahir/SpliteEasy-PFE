"use client";
// app/settlements/page.tsx — Global (cross-group) settlements.
// Nets what you owe / are owed across ALL shared groups with each friend, using
// the backend /settle/global/* endpoints, and lets you record → accept → reject
// → resend the whole request lifecycle.

import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { fmt } from "@/lib/format";
import { settleApi } from "@/lib/api/settle";
import { useAuth } from "@/lib/auth/AuthContext";
import RecordSettlementModal from "@/components/modals/RecordSettlementModal";
import type { ApiGlobalBalance, ApiSettlement } from "@/lib/api/types";

// ── Skeletons ─────────────────────────────────────────────────────────────────

function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "14px 12px" }}>
          <div className="sk-block" style={{ width: i === 0 ? "70%" : "50%", height: 14, borderRadius: 5 }} />
        </td>
      ))}
    </tr>
  );
}

function StatCardSkeleton() {
  return (
    <div className="card stat-c">
      <div className="sk-block" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="sk-block" style={{ width: "40%", height: 11, borderRadius: 4 }} />
        <div className="sk-block" style={{ width: "60%", height: 20, borderRadius: 5 }} />
        <div className="sk-block" style={{ width: "50%", height: 10, borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GlobalSettlementsPage() {
  const { user } = useAuth();

  const [balances, setBalances] = useState<ApiGlobalBalance[]>([]);
  const [suggested, setSuggested] = useState<ApiSettlement[]>([]);
  const [history, setHistory] = useState<ApiSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Set<number>>(new Set());
  const [showAllFriends, setShowAllFriends] = useState(false);

  const [settleModal, setSettleModal] = useState<{
    defaultToId?: number;
    defaultAmount?: number;
  } | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    // allSettled so a single endpoint failure doesn't blank the whole page.
    const [balRes, sugRes, histRes] = await Promise.allSettled([
      settleApi.globalBalances(),
      settleApi.globalSuggested(),
      settleApi.globalHistory(),
    ]);
    if (balRes.status === "fulfilled") setBalances(balRes.value);
    else toast.error("Could not load friend balances");
    if (sugRes.status === "fulfilled") setSuggested(sugRes.value);
    else toast.error("Could not load suggested settlements");
    if (histRes.status === "fulfilled") setHistory(histRes.value);
    else toast.error("Could not load settlement history");
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const myId = user?.id;
  const currency = user?.preferred_currency || "MAD";

  // net: positive = friend owes you, negative = you owe the friend.
  const netOf = (b: ApiGlobalBalance) => b.net ?? 0;
  const youLent = balances.reduce((s, b) => s + Math.max(netOf(b), 0), 0);
  const youOwe = balances.reduce((s, b) => s + Math.max(-netOf(b), 0), 0);
  const myNet = youLent - youOwe;
  const totalSettled = history.filter((h) => h.status === "accepted").reduce((s, h) => s + h.amount, 0);

  // People you should pay (from the simplified suggestions).
  const allRecipients = suggested
    .filter((s) => s.from_user_id === myId)
    .map((s) => ({
      id: s.to_user_id,
      username: s.to_username ?? `User ${s.to_user_id}`,
      amount: s.amount,
      label: `You owe ${fmt(s.amount, currency)}`,
    }));

  const myActionCount = suggested.filter((s) => s.from_user_id === myId).length;

  // ── Actions ───────────────────────────────────────────────────────────────────

  const setActingId = (id: number, on: boolean) =>
    setActing((prev) => { const s = new Set(prev); on ? s.add(id) : s.delete(id); return s; });

  const quickSettle = (fromId: number, toId: number, amount: number) => {
    if (fromId !== myId) {
      toast.warning("You can only settle your own debts", { position: "bottom-right" });
      return;
    }
    setSettleModal({ defaultToId: toId, defaultAmount: amount });
  };

  const handleConfirmSettle = async (toUserId: number, amount: number, message?: string) => {
    try {
      await settleApi.recordGlobal({ to_user_id: toUserId, amount, message });
      toast.success("Settlement recorded! Waiting for confirmation.");
      setSettleModal(null);
      await refetch();
    } catch {
      toast.error("Could not record settlement");
    }
  };

  const resendSettlement = async (id: number, amount: number, toUserId: number) => {
    const result = await Swal.fire({
      title: "Resend Settlement",
      input: "number",
      inputLabel: `Amount (${currency})`,
      inputValue: amount,
      showCancelButton: true,
      confirmButtonColor: "#5b4ef0",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Resend",
    });
    if (!result.isConfirmed) return;
    setActingId(id, true);
    try {
      await settleApi.resendGlobal(id, Number(result.value) || amount, toUserId);
      toast.success("Settlement resent!");
      await refetch();
    } catch {
      toast.error("Could not resend settlement");
    } finally {
      setActingId(id, false);
    }
  };

  const acceptSettlement = async (id: number) => {
    setActingId(id, true);
    try {
      await settleApi.acceptGlobal(id);
      toast.success("Settlement accepted!");
      await refetch();
    } catch {
      toast.error("Could not accept settlement");
    } finally {
      setActingId(id, false);
    }
  };

  const rejectSettlement = async (id: number) => {
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
    setActingId(id, true);
    try {
      await settleApi.rejectGlobal(id, result.value || undefined);
      toast.success("Settlement rejected");
      await refetch();
    } catch {
      toast.error("Could not reject settlement");
    } finally {
      setActingId(id, false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const statusPill = (status: string) => {
    if (status === "accepted") return <span className="st-pill accepted">✅ Accepted</span>;
    if (status === "rejected") return <span className="st-pill rejected">❌ Rejected</span>;
    return <span className="st-pill pending">🕐 Pending</span>;
  };

  const friendStatus = (net: number): { label: string; color: string; amount: number } => {
    if (net > 0.009) return { label: "Lent", color: "var(--success)", amount: net };
    if (net < -0.009) return { label: "Owe", color: "var(--rose)", amount: -net };
    return { label: "Settled", color: "var(--ink-3)", amount: 0 };
  };

  const relDate = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Guard: wait for auth to resolve before showing user-specific data.
  if (!myId) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--ink-3)" }}>
        <div className="sk-block" style={{ width: 200, height: 20, borderRadius: 8, margin: "0 auto" }} />
      </div>
    );
  }

  const activeFriends = balances.filter((b) => friendStatus(netOf(b)).label !== "Settled");
  const displayedFriends = showAllFriends ? balances : activeFriends;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <h1>Settlements</h1>
          <p>Settle up across <strong>all your groups</strong> with each friend</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              if (allRecipients.length === 0) {
                toast.info("You have no outstanding debts to settle.", { position: "bottom-right" });
                return;
              }
              setSettleModal({});
            }}
          >
            <Icon name="settle" size={14} /> New Settlement
          </button>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────────── */}
      <div className="settle-stat-grid">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <div className="card stat-c">
              <div className="ic" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                <Icon name="coin" size={22} />
              </div>
              <div>
                <div className="lbl">You Lent</div>
                <div className="v" style={{ color: "var(--success)" }}>{fmt(youLent, currency)}</div>
                <div className="sub">Others owe you</div>
              </div>
            </div>
            <div className="card stat-c">
              <div className="ic" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
                <Icon name="receipt" size={22} />
              </div>
              <div>
                <div className="lbl">You Owe</div>
                <div className="v" style={{ color: "var(--rose)" }}>{fmt(youOwe, currency)}</div>
                <div className="sub">Your outstanding debt</div>
              </div>
            </div>
            <div className="card stat-c">
              <div className="ic" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                <Icon name="settle" size={22} />
              </div>
              <div>
                <div className="lbl">Net Balance</div>
                <div className="v" style={{ color: myNet >= 0 ? "var(--success)" : "var(--rose)" }}>{fmt(myNet, currency)}</div>
                <div className="sub">{myNet > 0 ? "You are owed" : myNet < 0 ? "You owe overall" : "All settled!"}</div>
              </div>
            </div>
            <div className="card stat-c">
              <div className="ic" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                <Icon name="check" size={22} />
              </div>
              <div>
                <div className="lbl">Total Settled</div>
                <div className="v" style={{ color: "var(--success)" }}>{fmt(totalSettled, currency)}</div>
                <div className="sub">Accepted payments</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Friend Balances ───────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 18, marginBottom: 20, marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Friend Balances</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>
              Your combined balance with each friend across all shared groups
            </p>
          </div>
          {!loading && balances.length > activeFriends.length && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: "5px 11px", whiteSpace: "nowrap" }}
              onClick={() => setShowAllFriends((v) => !v)}
            >
              {showAllFriends ? "Hide settled" : `Show all (${balances.length})`}
            </button>
          )}
        </div>
        {loading ? (
          <div className="bal-cards-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="sk-block" style={{ height: 110, borderRadius: 14 }} />
            ))}
          </div>
        ) : displayedFriends.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-3)" }}>
            <Icon name="check" size={28} style={{ display: "block", margin: "0 auto 8px", color: "var(--success)" }} />
            {balances.length === 0 ? "No shared balances with friends yet." : "You are settled with everyone! 🎉"}
          </div>
        ) : (
          <div className="bal-cards-grid">
            {displayedFriends.map((entry) => {
              const status = friendStatus(netOf(entry));
              return (
                <div key={entry.user_id} className="bal-card">
                  <Avatar id={String(entry.user_id)} size="md" />
                  <div className="bal-card-name">{entry.username ?? `User ${entry.user_id}`}</div>
                  <div className="bal-card-amount" style={{ color: status.color }}>
                    {status.amount === 0 ? "—" : fmt(status.amount, currency)}
                  </div>
                  <span className="bal-card-pill" style={{
                    background: status.label === "Lent" ? "var(--success-soft)" : status.label === "Owe" ? "var(--rose-soft)" : "var(--line-2)",
                    color: status.color,
                  }}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Suggested Settlements ─────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div className="st-section-hd st-hd-orange">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>💡</span><span>Suggested Settlements</span>
          </div>
          <span className="st-badge st-badge-orange">
            {loading ? "…" : myActionCount > 0 ? `${myActionCount} require${myActionCount === 1 ? "s" : ""} your action` : `${suggested.length} suggestions`}
          </span>
        </div>

        {/* Desktop table */}
        <table className="exp-table st-desktop-table" style={{ margin: 0 }}>
          <thead>
            <tr><th>Payer</th><th>Receiving</th><th>Amount</th><th>Action</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={4} />)
            ) : suggested.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "36px 0", textAlign: "center", color: "var(--ink-3)" }}>
                <Icon name="check" size={28} style={{ display: "block", margin: "0 auto 8px", color: "var(--success)" }} />
                All balances are settled!
              </td></tr>
            ) : suggested.map((s) => (
              <tr key={`${s.from_user_id}-${s.to_user_id}`}>
                <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar id={String(s.from_user_id)} size="sm" /><span style={{ fontWeight: 600, fontSize: 13.5 }}>{s.from_username ?? `User ${s.from_user_id}`}</span></div></td>
                <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar id={String(s.to_user_id)} size="sm" /><span style={{ fontWeight: 600, fontSize: 13.5 }}>{s.to_username ?? `User ${s.to_user_id}`}</span></div></td>
                <td><span className="st-amount-pill">{fmt(s.amount, currency)}</span></td>
                <td>
                  {s.from_user_id === myId ? (
                    <button className="btn st-quick-btn" onClick={() => quickSettle(s.from_user_id, s.to_user_id, s.amount)}>
                      <Icon name="settle" size={13} /> Quick Settle
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--ink-4)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="st-mobile-cards">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="sk-block" style={{ height: 80, borderRadius: 12, margin: "10px 14px" }} />
            ))
          ) : suggested.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
              <Icon name="check" size={28} style={{ display: "block", margin: "0 auto 8px", color: "var(--success)" }} />
              All balances are settled!
            </div>
          ) : suggested.map((s) => (
            <div key={`${s.from_user_id}-${s.to_user_id}`} className="st-mob-card">
              <div className="st-mob-card-row">
                <div className="st-mob-user"><Avatar id={String(s.from_user_id)} size="sm" /><span>{s.from_username ?? `User ${s.from_user_id}`}</span></div>
                <Icon name="settle" size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
                <div className="st-mob-user"><Avatar id={String(s.to_user_id)} size="sm" /><span>{s.to_username ?? `User ${s.to_user_id}`}</span></div>
                <span className="st-amount-pill" style={{ marginLeft: "auto" }}>{fmt(s.amount, currency)}</span>
              </div>
              {s.from_user_id === myId && (
                <button className="btn st-quick-btn" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={() => quickSettle(s.from_user_id, s.to_user_id, s.amount)}>
                  <Icon name="settle" size={13} /> Quick Settle
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Settlement History ────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="st-section-hd st-hd-green">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>🕐</span><span>Settlement History</span>
          </div>
          <span className="st-badge st-badge-green">{loading ? "…" : `${history.length} records`}</span>
        </div>

        {/* Desktop table */}
        <table className="exp-table st-desktop-table" style={{ margin: 0 }}>
          <thead>
            <tr><th>Payer</th><th>Receiving</th><th>Amount</th><th>Status</th><th>Date</th><th style={{ textAlign: "right" }}>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
            ) : history.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "48px 0", textAlign: "center", color: "var(--ink-3)" }}>
                <Icon name="settle" size={28} style={{ display: "block", margin: "0 auto 8px", color: "var(--ink-4)" }} />
                No settlements recorded yet.
              </td></tr>
            ) : history.map((h) => {
              const canAct = h.status === "pending" && h.to_user_id === myId;
              const canResend = h.status === "rejected" && h.from_user_id === myId;
              return (
                <tr key={h.id}>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar id={String(h.from_user_id)} size="sm" /><span style={{ fontWeight: 600, fontSize: 13 }}>{h.from_username ?? `User ${h.from_user_id}`}</span></div></td>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar id={String(h.to_user_id)} size="sm" /><span style={{ fontWeight: 600, fontSize: 13 }}>{h.to_username ?? `User ${h.to_user_id}`}</span></div></td>
                  <td><span style={{ fontWeight: 700, color: "var(--success)", fontVariantNumeric: "tabular-nums", fontSize: 13.5 }}>{fmt(h.amount, currency)}</span></td>
                  <td>{statusPill(h.status)}</td>
                  <td style={{ color: "var(--ink-3)", fontSize: 12.5 }}>{relDate(h.created_at)}</td>
                  <td style={{ textAlign: "right" }}>
                    {canAct && (
                      <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                        <button className="btn btn-primary" style={{ padding: "5px 11px", fontSize: 12 }} disabled={acting.has(h.id)} onClick={() => acceptSettlement(h.id)}><Icon name="check" size={13} /> Accept</button>
                        <button className="btn btn-secondary" style={{ padding: "5px 11px", fontSize: 12, color: "var(--rose)", borderColor: "var(--rose-soft)" }} disabled={acting.has(h.id)} onClick={() => rejectSettlement(h.id)}><Icon name="x" size={13} /> Reject</button>
                      </div>
                    )}
                    {canResend && (
                      <button className="btn st-quick-btn" style={{ padding: "5px 12px", fontSize: 12 }} disabled={acting.has(h.id)} onClick={() => resendSettlement(h.id, h.amount, h.to_user_id)}>
                        <Icon name="settle" size={13} /> Resend
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="st-mobile-cards">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="sk-block" style={{ height: 100, borderRadius: 12, margin: "10px 14px" }} />
            ))
          ) : history.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
              <Icon name="settle" size={28} style={{ display: "block", margin: "0 auto 8px", color: "var(--ink-4)" }} />
              No settlements recorded yet.
            </div>
          ) : history.map((h) => {
            const canAct = h.status === "pending" && h.to_user_id === myId;
            const canResend = h.status === "rejected" && h.from_user_id === myId;
            return (
              <div key={h.id} className="st-mob-card">
                <div className="st-mob-card-row">
                  <div className="st-mob-user"><Avatar id={String(h.from_user_id)} size="sm" /><span>{h.from_username ?? `User ${h.from_user_id}`}</span></div>
                  <Icon name="settle" size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
                  <div className="st-mob-user"><Avatar id={String(h.to_user_id)} size="sm" /><span>{h.to_username ?? `User ${h.to_user_id}`}</span></div>
                </div>
                <div className="st-mob-card-meta">
                  <span style={{ fontWeight: 700, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>{fmt(h.amount, currency)}</span>
                  {statusPill(h.status)}
                  <span style={{ fontSize: 12, color: "var(--ink-3)", marginLeft: "auto" }}>{relDate(h.created_at)}</span>
                </div>
                {(canAct || canResend) && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {canAct && <>
                      <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: 12.5 }} disabled={acting.has(h.id)} onClick={() => acceptSettlement(h.id)}><Icon name="check" size={13} /> Accept</button>
                      <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", fontSize: 12.5, color: "var(--rose)", borderColor: "var(--rose-soft)" }} disabled={acting.has(h.id)} onClick={() => rejectSettlement(h.id)}><Icon name="x" size={13} /> Reject</button>
                    </>}
                    {canResend && (
                      <button className="btn st-quick-btn" style={{ flex: 1, justifyContent: "center", fontSize: 12.5 }} disabled={acting.has(h.id)} onClick={() => resendSettlement(h.id, h.amount, h.to_user_id)}>
                        <Icon name="settle" size={13} /> Resend
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Record Settlement Modal */}
      {settleModal && (
        <RecordSettlementModal
          currency={currency}
          myId={myId}
          myUsername={user?.username}
          currentBalance={-myNet}
          defaultRecipientId={settleModal.defaultToId}
          defaultAmount={settleModal.defaultAmount}
          recipients={allRecipients}
          onClose={() => setSettleModal(null)}
          onConfirm={handleConfirmSettle}
        />
      )}
    </>
  );
}
