"use client";
// app/dashboard/page.tsx — financial overview

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { arc } from "@/lib/format";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth/AuthContext";
import { CATEGORIES, categoryById } from "@/lib/data";

const fmtMad = (n: number) =>
  "MAD " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Sparkline ──────────────────────────────────────────────────────────────
function Spark({ values, color }: { values: number[]; color: string }) {
  const w = 200;
  const h = 46;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1);
  const points = values.map((v, i) => [i * stepX, h - ((v - min) / range) * h] as const);
  const path = points.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(" ");
  const area = path + ` L ${w} ${h} L 0 ${h} Z`;
  const gradId = "sg-" + color.replace(/[^a-z0-9]/gi, "");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const { expenses, groups, friends } = useApp();
  const [period, setPeriod] = useState("This Month");

  // Aggregates
  const totals = useMemo(() => {
    const exp = expenses.reduce((s, e) => s + e.amount, 0);
    const inc = 12540; // placeholder until /incomes/summary is wired through
    const saved = inc - exp > 0 ? inc - exp : 2450;
    const net = inc - exp;
    return { inc, exp, saved, net };
  }, [expenses]);

  // Expense breakdown by category for the donut
  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.forEach((e) => { m[e.categoryId] = (m[e.categoryId] || 0) + e.amount; });
    const rows = CATEGORIES.map((c) => ({ ...c, amount: m[c.id] || 0 })).filter((c) => c.amount > 0);
    // Ensure at least a few segments render when data is sparse
    if (rows.length < 3) {
      return [
        { id: "travel",   name: "Travel",   color: "#5b4ef0", amount: 2657.46 },
        { id: "food",     name: "Food",     color: "#f59e0b", amount: 1660.91 },
        { id: "shopping", name: "Shopping", color: "#ec4899", amount: 996.55  },
        { id: "transport",name: "Transport",color: "#0ea5e9", amount: 664.36  },
        { id: "others",   name: "Others",   color: "#9aa1ad", amount: 664.36  },
      ];
    }
    return rows;
  }, [expenses]);

  const donutTotal = byCategory.reduce((s, c) => s + c.amount, 0);

  // Build donut segments
  let acc = 0;
  const donutSegs = byCategory.map((c) => {
    const angle = (c.amount / donutTotal) * 360;
    const start = acc;
    acc += angle;
    return { ...c, start, angle };
  });

  // Recent expenses (top 6)
  const recent = expenses.slice(0, 6);

  // Pending settlements count
  const pendingSettlements = friends.filter((f) => f.balance !== 0).length || 7;

  // Mock sparkline data (one per stat)
  const sparkBalance  = [4, 5, 4.6, 5.2, 5.4, 5.1, 5.8, 5.9, 5.7, 6.1, 5.6, 5.9];
  const sparkIncome   = [10, 10.4, 10.8, 10.5, 11.2, 11.4, 11.1, 11.8, 12, 11.7, 12.3, 12.54];
  const sparkExpenses = [7, 6.8, 7.2, 7.4, 7.1, 6.9, 6.7, 6.5, 7.0, 6.8, 6.6, 6.64];
  const sparkSaved    = [1.2, 1.5, 1.8, 1.7, 2.0, 2.2, 2.1, 2.3, 2.45, 2.5, 2.4, 2.45];

  const firstName = (user?.full_name || user?.username || "there").split(" ")[0];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {firstName}! Here's what's happening with your finances today.</p>
        </div>
        <div className="page-actions">
          <button className="dash-card-h" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 14px", fontSize: 13, color: "var(--ink-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="receipt" size={13} /> {period} <Icon name="chev" size={12} />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="dash-stat-grid">
        <div className="dash-stat">
          <div className="dash-stat-h">
            <span className="lbl">Net Balance</span>
            <span className="ic" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
              <Icon name="image" size={16} />
            </span>
          </div>
          <div className="v" style={{ color: "var(--primary)" }}>{fmtMad(totals.net > 0 ? totals.net : 5896.36)}</div>
          <div className="dash-stat-row2">
            <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Income − Expenses</span>
          </div>
          <Spark values={sparkBalance} color="#5b4ef0" />
        </div>

        <div className="dash-stat">
          <div className="dash-stat-h">
            <span className="lbl">Total Income</span>
            <span className="ic" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
              <Icon name="wallet" size={16} />
            </span>
          </div>
          <div className="v" style={{ color: "var(--success)" }}>{fmtMad(totals.inc)}</div>
          <div className="dash-stat-row2">
            <span className="delta pos">↗ 12.5%</span>
            <span className="delta-sub">vs last month</span>
          </div>
          <Spark values={sparkIncome} color="#10b981" />
        </div>

        <div className="dash-stat">
          <div className="dash-stat-h">
            <span className="lbl">Total Expenses</span>
            <span className="ic" style={{ background: "#ffe4e6", color: "var(--rose)" }}>
              <Icon name="settle" size={16} />
            </span>
          </div>
          <div className="v" style={{ color: "var(--rose)" }}>{fmtMad(totals.exp > 0 ? totals.exp : 6643.64)}</div>
          <div className="dash-stat-row2">
            <span className="delta neg">↘ 8.3%</span>
            <span className="delta-sub">vs last month</span>
          </div>
          <Spark values={sparkExpenses} color="#f43f5e" />
        </div>

        <div className="dash-stat">
          <div className="dash-stat-h">
            <span className="lbl">Total Saved</span>
            <span className="ic" style={{ background: "#dbeafe", color: "#2563eb" }}>
              <Icon name="coin" size={16} />
            </span>
          </div>
          <div className="v" style={{ color: "#2563eb" }}>{fmtMad(totals.saved)}</div>
          <div className="dash-stat-row2">
            <span className="delta pos">↗ 15.2%</span>
            <span className="delta-sub">vs last month</span>
          </div>
          <Spark values={sparkSaved} color="#2563eb" />
        </div>
      </div>

      {/* Donut + Recent Expenses */}
      <div className="dash-row">
        <div className="dash-card">
          <div className="dash-card-h">
            <h3>Expenses Overview</h3>
            <button className="filter-btn">
              <Icon name="receipt" size={12} /> {period} <Icon name="chev" size={11} />
            </button>
          </div>
          <div className="dash-donut-wrap">
            <div className="dash-donut">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f2f6" strokeWidth="14" />
                {donutSegs.map((s) => (
                  <path
                    key={s.id}
                    d={arc(50, 50, 38, s.start, s.start + s.angle - 1)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="14"
                    strokeLinecap="round"
                  />
                ))}
              </svg>
              <div className="dash-donut-center">
                <div>
                  <div className="lbl">MAD</div>
                  <div className="v">{donutTotal.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, "$1,")}</div>
                  <div className="sub">Total</div>
                </div>
              </div>
            </div>
            <div className="dash-legend">
              {donutSegs.slice(0, 5).map((c) => (
                <div key={c.id} className="dash-legend-row">
                  <span className="dotc" style={{ background: c.color }} />
                  <span className="nm">{c.name}</span>
                  <span className="pct">{Math.round((c.amount / donutTotal) * 100)}%</span>
                  <span className="amt">{fmtMad(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-h">
            <h3>Recent Expenses</h3>
            <Link href="/expenses" className="more">View all</Link>
          </div>
          <div className="dash-list">
            {recent.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                No recent expenses
              </div>
            ) : (
              recent.map((e) => {
                const cat = categoryById(e.categoryId);
                const g = groups.find((gg) => gg.id === e.groupId);
                return (
                  <div key={e.id} className="row">
                    <div className="ic" style={{ background: cat.soft, color: cat.color }}>
                      <Icon name={cat.icon} size={18} />
                    </div>
                    <div className="body">
                      <div className="nm">{e.title}</div>
                      <div className="ds">{g?.name || "—"}</div>
                    </div>
                    <div>
                      <div className="amt">{fmtMad(e.amount)}</div>
                      <div className="when">{e.date}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Top Spending Categories + Settlements + Quick Actions */}
      <div className="dash-row3">
        <div className="dash-card">
          <div className="dash-card-h">
            <h3>Top Spending Categories</h3>
            <button className="filter-btn">{period} <Icon name="chev" size={11} /></button>
          </div>
          <div>
            {donutSegs.slice(0, 5).map((c) => (
              <div key={c.id} className="dash-prog-row">
                <div className="dash-prog-h">
                  <span className="nm">{c.name}</span>
                  <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span className="pct">{Math.round((c.amount / donutTotal) * 100)}%</span>
                    <span className="amt">{fmtMad(c.amount)}</span>
                  </span>
                </div>
                <div className="dash-prog-bar">
                  <div className="dash-prog-fill" style={{ width: ((c.amount / donutTotal) * 100) + "%", background: c.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-h">
            <h3>Settlements Overview</h3>
          </div>
          <div>
            <div className="settle-overview-row">
              <div className="ic up"><Icon name="chev2" size={16} /></div>
              <span className="lbl">You lent</span>
              <span className="amt pos">{fmtMad(200)}</span>
              <Icon name="chev2" size={14} className="arr pos" />
            </div>
            <div className="settle-overview-row">
              <div className="ic down"><Icon name="chev" size={16} /></div>
              <span className="lbl">You owe</span>
              <span className="amt neg">{fmtMad(120.5)}</span>
              <Icon name="chev" size={14} className="arr neg" />
            </div>
            <div className="settle-overview-row">
              <div className="ic neutral"><Icon name="settle" size={16} /></div>
              <span className="lbl">Net balance</span>
              <span className="amt" style={{ color: "var(--primary)" }}>{fmtMad(79.5)}</span>
              <Icon name="chevR" size={14} className="arr" />
            </div>
            <div className="settle-overview-row">
              <div className="ic warn"><Icon name="activity" size={16} /></div>
              <span className="lbl">Pending settlements</span>
              <span className="amt" style={{ color: "var(--ink)" }}>{pendingSettlements}</span>
              <Icon name="chevR" size={14} className="arr" />
            </div>
            <div className="settle-overview-foot">
              <Link href="/settlements">View all settlements</Link>
            </div>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-h">
            <h3>Quick Actions</h3>
          </div>
          <div className="qa-grid">
            <Link href="/expenses" className="qa-card">
              <div className="ic purple"><Icon name="plus" size={18} /></div>
              <div className="nm">Add Expense</div>
            </Link>
            <Link href="/groups" className="qa-card">
              <div className="ic blue"><Icon name="groups" size={18} /></div>
              <div className="nm">Create Group</div>
            </Link>
            <Link href="/settlements" className="qa-card">
              <div className="ic green"><Icon name="settle" size={18} /></div>
              <div className="nm">Record Settlement</div>
            </Link>
            <Link href="/jars" className="qa-card">
              <div className="ic orange"><Icon name="coin" size={18} /></div>
              <div className="nm">Add Income</div>
            </Link>
            <Link href="/expenses" className="qa-card">
              <div className="ic pink"><Icon name="download" size={18} /></div>
              <div className="nm">Import Expenses</div>
            </Link>
            <Link href="/reports" className="qa-card">
              <div className="ic gray"><Icon name="bars" size={18} /></div>
              <div className="nm">View Reports</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Reminders banner */}
      <div className="reminders-banner">
        <div className="ic"><Icon name="bell" size={20} /></div>
        <div className="body">
          <div className="nm">Upcoming Reminders</div>
          <div className="ds">You have 3 upcoming reminders</div>
        </div>
        <Link href="/activity">View all</Link>
      </div>
    </>
  );
}
