"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp } from "@/lib/store";
import { CATEGORIES, categoryById, personById } from "@/lib/data";
import { fmt } from "@/lib/format";

function safeCategory(id: string) {
  return CATEGORIES.find((category) => category.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

function Sparkline({ tone }: { tone: "violet" | "green" | "red" | "blue" }) {
  return (
    <svg className={"dash-spark " + tone} viewBox="0 0 180 52" aria-hidden="true">
      <path className="area" d="M0 42 C15 38 18 20 32 28 C45 36 50 18 65 30 C82 43 93 24 108 31 C126 40 132 5 148 13 C160 18 163 34 180 16 V52 H0 Z" />
      <path className="line" d="M0 42 C15 38 18 20 32 28 C45 36 50 18 65 30 C82 43 93 24 108 31 C126 40 132 5 148 13 C160 18 163 34 180 16" />
    </svg>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { expenses, groups, friends, income, showToast } = useApp();

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netBalance = income - totalExpenses;
  const totalSaved = Math.max(0, income * 0.2);
  const youLent = friends.filter((friend) => friend.balance > 0).reduce((sum, friend) => sum + friend.balance, 0);
  const youOwe = Math.abs(friends.filter((friend) => friend.balance < 0).reduce((sum, friend) => sum + friend.balance, 0));
  const pendingSettlements = friends.filter((friend) => friend.balance !== 0 && friend.status === "friend").length;

  const categoryTotals = CATEGORIES.map((category) => ({
    ...category,
    amount: expenses
      .filter((expense) => expense.categoryId === category.id)
      .reduce((sum, expense) => sum + expense.amount, 0),
  }))
    .filter((category) => category.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const visibleCategories = categoryTotals.length ? categoryTotals : [
    { ...categoryById("accom"), amount: 600 },
    { ...categoryById("food"), amount: 250.5 },
    { ...categoryById("transport"), amount: 120 },
  ];
  const chartTotal = visibleCategories.reduce((sum, category) => sum + category.amount, 0) || 1;
  let cursor = 0;
  const conicStops = visibleCategories.map((category) => {
    const start = cursor;
    cursor += (category.amount / chartTotal) * 100;
    return `${category.color} ${start}% ${cursor}%`;
  }).join(", ");

  const recentExpenses = expenses.slice(0, 5);
  const displayName = user?.full_name || user?.username || "Samir";
  const userCurrency = user?.preferred_currency || "USD";
  const money = (value: number) => fmt(value, userCurrency);

  const quickActions = [
    { label: "Add Expense", icon: "plus", href: "/expenses" },
    { label: "Create Group", icon: "groups", href: "/groups" },
    { label: "Record Settlement", icon: "settle", href: "/settlements" },
    { label: "Add Income", icon: "wallet", href: "/reports" },
    { label: "Import Expenses", icon: "download", href: "/expenses" },
    { label: "View Reports", icon: "reports", href: "/reports" },
  ];

  return (
    <div className="dashboard-page">
      <div className="dash-mobile-head">
        <button className="dash-mobile-icon" aria-label="Open menu">
          <Icon name="list" size={20} />
        </button>
        <div className="dash-mobile-logo">Split<span>Easy</span></div>
        <button className="dash-mobile-icon with-dot" aria-label="Notifications">
          <Icon name="bell" size={19} />
        </button>
      </div>

      <div className="dash-head">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {displayName.split(" ")[0]}! Here&apos;s what&apos;s happening with your finances today.</p>
        </div>
        <button className="dash-filter">
          <Icon name="calendar" size={15} /> This Month <Icon name="chev" size={14} />
        </button>
      </div>

      <section className="dash-mobile-hero">
        <div className="hero-copy">
          <span>Net Balance</span>
          <strong>{money(netBalance)}</strong>
          <small>Income - Expenses</small>
        </div>
        <Icon name="info" size={18} />
        <Sparkline tone="violet" />
      </section>

      <section className="dash-stats-grid">
        {[
          { label: "Net Balance", value: money(netBalance), meta: "Income - Expenses", icon: "info", tone: "violet" as const },
          { label: "Total Income", value: money(income), meta: "12.5% vs last month", icon: "wallet", tone: "green" as const },
          { label: "Total Expenses", value: money(totalExpenses), meta: "8.3% vs last month", icon: "settle", tone: "red" as const },
          { label: "Total Saved", value: money(totalSaved), meta: "15.2% vs last month", icon: "money", tone: "blue" as const },
        ].map((stat) => (
          <article key={stat.label} className={"dash-stat-card " + stat.tone}>
            <div className="dash-stat-top">
              <div>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.meta}</small>
              </div>
              <div className="dash-stat-icon"><Icon name={stat.icon} size={20} /></div>
            </div>
            <Sparkline tone={stat.tone} />
          </article>
        ))}
      </section>

      <section className="dash-mobile-summary">
        {[
          ["Groups", groups.length, "Active groups", "groups"],
          ["Friends", friends.filter((friend) => friend.status === "friend").length, "Total friends", "friends"],
          ["Expenses", expenses.length, "This month", "expense"],
          ["Settlements", pendingSettlements, "Pending", "settle"],
        ].map(([label, value, sub, icon]) => (
          <div key={String(label)} className="dash-quick-mini">
            <Icon name={String(icon)} size={18} />
            <strong>{String(value)}</strong>
            <span>{String(label)}</span>
            <small>{String(sub)}</small>
          </div>
        ))}
      </section>

      <section className="dash-main-grid">
        <article className="dash-panel dash-overview-panel">
          <div className="dash-panel-head">
            <h2>Expenses Overview</h2>
            <button>This Month <Icon name="chev" size={13} /></button>
          </div>
          <div className="dash-donut-wrap">
            <div className="dash-donut" style={{ background: `conic-gradient(${conicStops})` }}>
              <div><strong>{money(totalExpenses || chartTotal)}</strong><span>Total</span></div>
            </div>
            <div className="dash-category-list">
              {visibleCategories.slice(0, 5).map((category) => {
                const pct = Math.round((category.amount / chartTotal) * 100);
                return (
                  <div key={category.id} className="dash-category-row">
                    <i style={{ background: category.color }} />
                    <span>{category.name.replace(" & Drinks", "")}</span>
                    <b>{pct}%</b>
                    <em>{money(category.amount)}</em>
                  </div>
                );
              })}
            </div>
          </div>
        </article>

        <article className="dash-panel dash-recent-panel">
          <div className="dash-panel-head">
            <h2>Recent Expenses</h2>
            <Link href="/expenses">View all</Link>
          </div>
          <div className="dash-recent-list">
            {recentExpenses.map((expense) => {
              const category = safeCategory(expense.categoryId);
              return (
                <Link href="/expenses" key={expense.id} className="dash-recent-row">
                  <div className="dash-exp-icon" style={{ color: category.color, background: category.soft }}>
                    <Icon name={category.icon} size={19} />
                  </div>
                  <div>
                    <strong>{expense.title}</strong>
                    <span>{expense.subtitle || groups.find((group) => group.id === expense.groupId)?.name || "Expense"}</span>
                  </div>
                  <div className="amount">
                    <b>{money(expense.amount)}</b>
                    <span>{expense.date}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </article>
      </section>

      <section className="dash-bottom-grid">
        <article className="dash-panel">
          <div className="dash-panel-head">
            <h2>Top Spending Categories</h2>
            <button>This Month <Icon name="chev" size={13} /></button>
          </div>
          <div className="dash-bars">
            {visibleCategories.slice(0, 5).map((category) => {
              const pct = Math.round((category.amount / chartTotal) * 100);
              return (
                <div key={category.id} className="dash-bar-row">
                  <div><span>{category.name.replace(" & Drinks", "")}</span><b>{pct}%</b><em>{money(category.amount)}</em></div>
                  <div className="dash-bar-track"><i style={{ width: `${Math.max(pct, 8)}%`, background: category.color }} /></div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="dash-panel">
          <div className="dash-panel-head"><h2>Settlements Overview</h2></div>
          <div className="dash-settle-list">
            <div><span><Icon name="upload" size={15} /> You lent</span><b className="pos">{money(youLent)}</b></div>
            <div><span><Icon name="download" size={15} /> You owe</span><b className="neg">{money(youOwe)}</b></div>
            <div><span><Icon name="wallet" size={15} /> Net balance</span><b>{money(youLent - youOwe)}</b></div>
            <div><span><Icon name="activity" size={15} /> Pending settlements</span><b>{pendingSettlements}</b></div>
          </div>
          <Link href="/settlements" className="dash-link">View all settlements</Link>
        </article>

        <article className="dash-panel">
          <div className="dash-panel-head"><h2>Quick Actions</h2></div>
          <div className="dash-actions-grid">
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href} className="dash-action">
                <Icon name={action.icon} size={22} />
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="dash-reminder">
        <Icon name="bell" size={18} />
        <div><strong>Upcoming Reminders</strong><span>You have 3 upcoming reminders</span></div>
        <button onClick={() => showToast("Reminders coming next")}>View all</button>
      </section>

    </div>
  );
}
