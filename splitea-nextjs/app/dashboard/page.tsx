"use client";
// app/dashboard/page.tsx — debt & settlement focused home (Splitwise-style)

import Link from "next/link";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp } from "@/lib/store";
import { categoryById, personById } from "@/lib/data";
import { fmt } from "@/lib/format";
import StatCard from "@/components/ui/StatCard";

function safeCategory(id: string) {
  return categoryById(id) || categoryById("other");
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { expenses, groups, friends } = useApp();

  // ── Relationship math (who owes who) — no wallet/savings concepts ────────────
  const youAreOwed = friends
    .filter((f) => f.balance > 0)
    .reduce((sum, f) => sum + f.balance, 0);
  const youOwe = Math.abs(
    friends.filter((f) => f.balance < 0).reduce((sum, f) => sum + f.balance, 0),
  );
  const net = youAreOwed - youOwe;
  const activeGroups = groups.length;
  const pendingSettlements = friends.filter(
    (f) => f.balance !== 0 && f.status === "friend",
  ).length;

  // People you owe / who owe you — the actionable per-person breakdown
  const owedToYou = friends
    .filter((f) => f.balance > 0 && f.status === "friend")
    .sort((a, b) => b.balance - a.balance);
  const youOweList = friends
    .filter((f) => f.balance < 0 && f.status === "friend")
    .sort((a, b) => a.balance - b.balance);

  // Recent activity — newest expenses across all groups
  const recentExpenses = [...expenses]
    .sort((a, b) => {
      const ta = a._rawDate ? new Date(a._rawDate).getTime() : 0;
      const tb = b._rawDate ? new Date(b._rawDate).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 5);

  const displayName = user?.full_name || user?.username || "there";
  const userCurrency = user?.preferred_currency || "MAD";
  const money = (value: number) => fmt(value, userCurrency);

  const quickActions = [
    { label: "Add Expense", icon: "plus", href: "/expenses" },
    { label: "Create Group", icon: "groups", href: "/groups" },
    { label: "Settle Up", icon: "settle", href: "/settlements" },
    { label: "View Balances", icon: "money", href: "/balances" },
  ];

  return (
    <div className="dashboard-page">
      {/* Mobile top bar */}
      <div className="dash-mobile-head">
        <button className="dash-mobile-icon" aria-label="Open menu">
          <Icon name="list" size={20} />
        </button>
        <div className="dash-mobile-logo">Split<span>Easy</span></div>
        <button className="dash-mobile-icon" aria-label="Notifications">
          <Icon name="bell" size={19} />
        </button>
      </div>

      {/* Header */}
      <div className="dash-head">
        <div>
          <h1>Dashboard</h1>
          <p>Hi {displayName.split(" ")[0]} — here&apos;s who owes what and what to settle next.</p>
        </div>
      </div>

      {/* Mobile hero — overall relationship position (not wealth) */}
      <section className="dash-mobile-hero">
        <div className="hero-copy">
          <span>{net >= 0 ? "You are owed overall" : "You owe overall"}</span>
          <strong>{money(Math.abs(net))}</strong>
          <small>{net >= 0 ? "More coming in than going out" : "Settle up to clear this"}</small>
        </div>
        <Icon name="settle" size={18} />
      </section>

      {/* Stat cards — relationship metrics only */}
      <section className="ui-stat-grid cols-4">
        <StatCard icon="upload" tone="success" label="You Are Owed"
          value={youAreOwed} currency={userCurrency}
          colorValue={youAreOwed > 0}
          sub={`${owedToYou.length} ${owedToYou.length === 1 ? "person owes" : "people owe"} you`} />
        <StatCard icon="download" tone="danger" label="You Owe"
          value={youOwe} currency={userCurrency}
          colorValue={youOwe > 0}
          sub={`${youOweList.length} ${youOweList.length === 1 ? "person" : "people"} to pay`} />
        <StatCard icon="activity" tone="primary" label="Pending Settlements"
          value={pendingSettlements} sub="Awaiting action" />
        <StatCard icon="groups" tone="info" label="Active Groups"
          value={activeGroups} sub="Sharing expenses" />
      </section>

      {/* Mobile summary chips */}
      <section className="dash-mobile-summary">
        {[
          ["Groups", activeGroups, "Active", "groups"],
          ["Friends", friends.filter((f) => f.status === "friend").length, "Total", "friends"],
          ["Owed", owedToYou.length, "To you", "upload"],
          ["Pending", pendingSettlements, "Settle", "settle"],
        ].map(([label, value, sub, icon]) => (
          <div key={String(label)} className="dash-quick-mini">
            <Icon name={String(icon)} size={18} />
            <strong>{String(value)}</strong>
            <span>{String(label)}</span>
            <small>{String(sub)}</small>
          </div>
        ))}
      </section>

      {/* Main grid — Who owes who + Recent activity */}
      <section className="dash-main-grid">
        {/* Who owes who — the actionable core */}
        <article className="dash-panel dash-overview-panel">
          <div className="dash-panel-head">
            <h2>Who Owes Who</h2>
            <Link href="/balances">View all</Link>
          </div>

          {owedToYou.length === 0 && youOweList.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-3)" }}>
              <Icon name="check" size={28} style={{ display: "block", margin: "0 auto 8px", color: "var(--success)" }} />
              You&apos;re all settled up! 🎉
            </div>
          ) : (
            <div className="dash-settle-list">
              {owedToYou.slice(0, 4).map((f) => {
                const p = personById(f.personId);
                return (
                  <Link key={`owed-${f.personId}`} href="/balances" className="dash-owe-row">
                    <span><Icon name="upload" size={15} /> {p.name} owes you</span>
                    <b className="pos">{money(f.balance)}</b>
                  </Link>
                );
              })}
              {youOweList.slice(0, 4).map((f) => {
                const p = personById(f.personId);
                return (
                  <Link key={`owe-${f.personId}`} href="/settlements" className="dash-owe-row">
                    <span><Icon name="download" size={15} /> You owe {p.name}</span>
                    <b className="neg">{money(Math.abs(f.balance))}</b>
                  </Link>
                );
              })}
            </div>
          )}
        </article>

        {/* Recent activity */}
        <article className="dash-panel dash-recent-panel">
          <div className="dash-panel-head">
            <h2>Recent Activity</h2>
            <Link href="/expenses">View all</Link>
          </div>
          {recentExpenses.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-3)" }}>
              No expenses yet.
            </div>
          ) : (
            <div className="dash-recent-list">
              {recentExpenses.map((expense) => {
                const category = safeCategory(expense.categoryId);
                const grp = groups.find((g) => g.id === expense.groupId);
                return (
                  <Link href="/expenses" key={expense.id} className="dash-recent-row">
                    <div className="dash-exp-icon" style={{ color: category.color, background: category.soft }}>
                      <Icon name={category.icon} size={19} />
                    </div>
                    <div>
                      <strong>{expense.title}</strong>
                      <span>{grp?.name || expense.subtitle || "Expense"}</span>
                    </div>
                    <div className="amount">
                      <b>{money(expense.amount)}</b>
                      <span>{expense.date}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </article>
      </section>

      {/* Quick actions */}
      <section className="dash-bottom-grid dash-bottom-grid--single">
        <article className="dash-panel">
          <div className="dash-panel-head"><h2>Quick Actions</h2></div>
          <div className="dash-actions-grid dash-actions-grid--4">
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href} className="dash-action">
                <Icon name={action.icon} size={22} />
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
