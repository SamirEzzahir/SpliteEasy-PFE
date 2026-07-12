"use client";
// app/balances/page.tsx — Read-focused overview of who owes what.
// Complements /settlements (the action flow) by breaking balances down two ways:
// By Friend (netted across all groups, from the store) and By Group (per-group
// member balances, fetched lazily from /settle/{group}/balances).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { fmt } from "@/lib/format";
import { personById } from "@/lib/data";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth/AuthContext";
import { settleApi } from "@/lib/api/settle";
import type { ApiBalanceEntry } from "@/lib/api/types";

type View = "friend" | "group";

// net > 0 → you are owed, net < 0 → you owe, 0 → settled (convention used app-wide)
function status(net: number): { label: string; color: string; soft: string; amount: number } {
  if (net > 0.009) return { label: "Owes you", color: "var(--success)", soft: "var(--success-soft)", amount: net };
  if (net < -0.009) return { label: "You owe", color: "var(--rose)", soft: "var(--rose-soft)", amount: -net };
  return { label: "Settled", color: "var(--ink-3)", soft: "var(--line-2)", amount: 0 };
}

export default function BalancesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { friends, groups, loading } = useApp();
  const currency = user?.preferred_currency || "MAD";
  const myId = user?.id;

  const [view, setView] = useState<View>("friend");
  const [showSettled, setShowSettled] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // By-group balances are fetched lazily the first time the tab is opened.
  const [groupBal, setGroupBal] = useState<Record<string, ApiBalanceEntry[]>>({});
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupFetched, setGroupFetched] = useState(false);

  useEffect(() => {
    if (view !== "group" || groupFetched || groups.length === 0) return;
    let cancelled = false;
    setGroupLoading(true);
    Promise.all(
      groups.map((g) =>
        settleApi.groupBalances(Number(g.id))
          .then((entries) => [g.id, entries] as const)
          .catch(() => [g.id, [] as ApiBalanceEntry[]] as const),
      ),
    )
      .then((pairs) => {
        if (cancelled) return;
        setGroupBal(Object.fromEntries(pairs));
        setGroupFetched(true);
      })
      .finally(() => { if (!cancelled) setGroupLoading(false); });
    return () => { cancelled = true; };
  }, [view, groupFetched, groups]);

  // ── Overall stats (from netted friend balances) ─────────────────────────────
  const accepted = useMemo(() => friends.filter((f) => f.status === "friend"), [friends]);
  const youAreOwed = accepted.reduce((s, f) => s + Math.max(f.balance, 0), 0);
  const youOwe = accepted.reduce((s, f) => s + Math.max(-f.balance, 0), 0);
  const net = youAreOwed - youOwe;

  const activeFriends = accepted.filter((f) => Math.abs(f.balance) > 0.009);
  const shownFriends = showSettled ? accepted : activeFriends;

  const entryNet = (e: ApiBalanceEntry) => e.net ?? e.balance ?? 0;
  const myNetInGroup = (gid: string) =>
    entryNet((groupBal[gid] ?? []).find((e) => e.user_id === myId) ?? ({} as ApiBalanceEntry));

  const toggleGroup = (id: string) =>
    setExpanded((prev) => {
      const nextSet = new Set(prev);
      nextSet.has(id) ? nextSet.delete(id) : nextSet.add(id);
      return nextSet;
    });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Balances</h1>
          <p>See who owes what across your groups and friends.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => router.push("/settlements")}>
            <Icon name="settle" size={14} /> Settle up
          </button>
        </div>
      </div>

      {/* ── Overall stats ── */}
      <div className="settle-stat-grid">
        <div className="card stat-c">
          <div className="ic" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
            <Icon name="coin" size={22} />
          </div>
          <div>
            <div className="lbl">You are owed</div>
            <div className="v" style={{ color: "var(--success)" }}>{fmt(youAreOwed, currency)}</div>
            <div className="sub">Others owe you</div>
          </div>
        </div>
        <div className="card stat-c">
          <div className="ic" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
            <Icon name="receipt" size={22} />
          </div>
          <div>
            <div className="lbl">You owe</div>
            <div className="v" style={{ color: "var(--rose)" }}>{fmt(youOwe, currency)}</div>
            <div className="sub">Your outstanding debt</div>
          </div>
        </div>
        <div className="card stat-c">
          <div className="ic" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            <Icon name="settle" size={22} />
          </div>
          <div>
            <div className="lbl">Net balance</div>
            <div className="v" style={{ color: net >= 0 ? "var(--success)" : "var(--rose)" }}>{fmt(net, currency)}</div>
            <div className="sub">{net > 0.009 ? "You're owed overall" : net < -0.009 ? "You owe overall" : "All settled!"}</div>
          </div>
        </div>
      </div>

      {/* ── Breakdown ── */}
      <div className="card" style={{ padding: 18 }}>
        <div className="tabs">
          <button className={"tab" + (view === "friend" ? " active" : "")} onClick={() => setView("friend")}>
            <Icon name="groups" size={14} /> By Friend
            {activeFriends.length > 0 && (
              <span className="tab-badge" style={view !== "friend" ? { background: "var(--line)", color: "var(--ink-3)" } : undefined}>
                {activeFriends.length}
              </span>
            )}
          </button>
          <button className={"tab" + (view === "group" ? " active" : "")} onClick={() => setView("group")}>
            <Icon name="groups" size={14} /> By Group
            {groups.length > 0 && (
              <span className="tab-badge" style={view !== "group" ? { background: "var(--line)", color: "var(--ink-3)" } : undefined}>
                {groups.length}
              </span>
            )}
          </button>
        </div>

        {view === "friend" ? (
          loading ? (
            <div className="bal-cards-grid">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="sk-block" style={{ height: 120, borderRadius: 14 }} />
              ))}
            </div>
          ) : shownFriends.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-3)" }}>
              <Icon name="check" size={28} style={{ display: "block", margin: "0 auto 8px", color: "var(--success)" }} />
              {accepted.length === 0 ? "No friends with shared expenses yet." : "You're settled with everyone! 🎉"}
            </div>
          ) : (
            <>
              {accepted.length > activeFriends.length && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: "5px 11px" }}
                    onClick={() => setShowSettled((v) => !v)}
                  >
                    {showSettled ? "Hide settled" : `Show all (${accepted.length})`}
                  </button>
                </div>
              )}
              <div className="bal-cards-grid">
                {shownFriends.map((f) => {
                  const st = status(f.balance);
                  const name = f.displayName || personById(f.personId).name;
                  return (
                    <div key={f.personId} className="bal-card">
                      <Avatar id={f.personId} size="md" />
                      <div className="bal-card-name">{name}</div>
                      <div className="bal-card-amount" style={{ color: st.color }}>
                        {st.amount === 0 ? "—" : fmt(st.amount, currency)}
                      </div>
                      <span className="bal-card-pill" style={{ background: st.soft, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : /* view === "group" */ (
          groupLoading || (loading && !groupFetched) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="sk-block" style={{ height: 64, borderRadius: 14 }} />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-3)" }}>
              <Icon name="groups" size={28} style={{ display: "block", margin: "0 auto 8px", opacity: 0.5 }} />
              You&apos;re not in any groups yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {groups.map((g) => {
                const gnet = myNetInGroup(g.id);
                const st = status(gnet);
                const isOpen = expanded.has(g.id);
                const members = (groupBal[g.id] ?? []).filter((e) => e.user_id !== myId);
                return (
                  <div key={g.id} style={{ border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
                    <button
                      onClick={() => toggleGroup(g.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, width: "100%",
                        padding: "14px 16px", background: "none", border: 0, cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{g.memberIds.length} members · {fmt(g.total, g.currency || currency)} spent</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div className="num" style={{ fontWeight: 700, fontSize: 14.5, color: st.color, fontVariantNumeric: "tabular-nums" }}>
                          {st.amount === 0 ? "—" : fmt(st.amount, g.currency || currency)}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{st.label}</div>
                      </div>
                      <Icon name="chevR" size={14} style={{ color: "var(--ink-3)", flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                    </button>

                    {isOpen && (
                      <div style={{ borderTop: "1px solid var(--line-2)", padding: "6px 16px 10px" }}>
                        {members.length === 0 ? (
                          <div style={{ padding: "12px 0", fontSize: 12.5, color: "var(--ink-3)" }}>No other member balances.</div>
                        ) : (
                          members.map((e) => {
                            const mst = status(entryNet(e));
                            return (
                              <div key={e.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
                                <Avatar id={String(e.user_id)} size="sm" />
                                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {e.username || personById(String(e.user_id)).name}
                                </span>
                                <span className="num" style={{ fontSize: 13, fontWeight: 700, color: mst.color, fontVariantNumeric: "tabular-nums" }}>
                                  {mst.amount === 0 ? "—" : fmt(mst.amount, g.currency || currency)}
                                </span>
                                <span style={{ fontSize: 11, color: "var(--ink-3)", width: 64, textAlign: "right" }}>{mst.label}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </>
  );
}
