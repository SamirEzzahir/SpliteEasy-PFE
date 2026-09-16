"use client";
import { usePreferences } from "@/hooks/usePreferences";
// app/dashboard/page.tsx — debt & settlement focused home (Splitwise-style)

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import PendingSettlements from "@/components/dashboard/PendingSettlements";
import AddExpenseFullModal from "@/components/modals/AddExpenseFullModal";
import Link from "next/link";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp } from "@/lib/store";
import { categoryById, personById } from "@/lib/data";
import { fmt, fmtDate } from "@/lib/format";
import StatCard from "@/components/ui/StatCard";
import OnboardingGuide from "@/components/onboarding/OnboardingGuide";
import OnboardingHelpButton from "@/components/onboarding/OnboardingHelpButton";

function safeCategory(id: string) {
  return categoryById(id) || categoryById("other");
}

export default function DashboardPage() {
  usePreferences();
  const { user } = useAuth();
  const { expenses, groups, friends, addExpense, loading } = useApp();
  const [showAdd, setShowAdd] = useState(false);

  // ── Relationship math (who owes who) — no wallet/savings concepts ────────────
  const youAreOwed = friends
    .filter((f) => f.balance > 0)
    .reduce((sum, f) => sum + f.balance, 0);
  const youOwe = Math.abs(
    friends.filter((f) => f.balance < 0).reduce((sum, f) => sum + f.balance, 0),
  );


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
    { label: "Add Friends", icon: "friends", href: "/friends" },
    { label: "Add Expense", icon: "plus", href: "/expenses" },
    { label: "Create Group", icon: "groups", href: "/groups" },
    { label: "Settle Up", icon: "settle", href: "/settlements" },
    { label: "View Balances", icon: "money", href: "/balances" },
  ];

  return (
    <div className="dashboard-page">
      <PageHeader title="Dashboard" subtitle={`Hi ${displayName.split(" ")[0]}, see who owes what and what needs your attention.`}
        actions={<><span data-tour="help"><OnboardingHelpButton /></span><button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={16} />Add expense</button></>} />
      {/* First-time onboarding (welcome modal + getting-started checklist) */}
      <OnboardingGuide />

      <section className="ui-stat-grid cols-2" data-tour="stats" aria-busy={loading}>
        {loading ? <><div className="sk-block" style={{height:112}} /><div className="sk-block" style={{height:112}} /></> : <>
          <StatCard icon="download" tone="danger" label="You owe" value={youOwe} currency={userCurrency} sub={`${youOweList.length} people to pay`} />
          <StatCard icon="upload" tone="success" label="You are owed" value={youAreOwed} currency={userCurrency} sub={`${owedToYou.length} people owe you`} />
        </>}
      </section>
      <PendingSettlements />
      {/* Main grid — Who owes who + Recent activity */}
      <section className="dash-main-grid">
        {/* Who owes who — the actionable core */}
        <article className="dash-panel dash-overview-panel" data-tour="owes">
          <div className="dash-panel-head">
            <h2>Who Owes Who</h2>
            <Link href="/balances">View all</Link>
          </div>

          {loading ? <div className="sk-block" style={{ height: 120 }} /> : owedToYou.length === 0 && youOweList.length === 0 ? (
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
          {loading ? <div className="sk-block" style={{ height: 120 }} /> : recentExpenses.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-3)" }}>
              No expenses yet. <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Add your first expense</button>
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
                      <b>{fmt(expense.amount, expense.currency || grp?.currency || "MAD")}</b>
                      <span>{fmtDate(expense._rawDate || expense.date)}</span>
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
        <article className="dash-panel" data-tour="actions">
          <div className="dash-panel-head"><h2>Quick Actions</h2></div>
          <div className="dash-actions-grid dash-actions-grid--5">
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href} className="dash-action">
                <Icon name={action.icon} size={22} />
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </article>
      </section>
      {showAdd && <AddExpenseFullModal onClose={() => setShowAdd(false)} onSubmit={addExpense} />}
    </div>
  );
}
