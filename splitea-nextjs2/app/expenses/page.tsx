"use client";
// app/expenses/page.tsx

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { Avatar, AvatarStack } from "@/components/Avatar";
import CategoryDonut from "@/components/expenses/CategoryDonut";
import AddExpenseFullModal from "@/components/modals/AddExpenseFullModal";
import { CATEGORIES, SETTLEMENTS, categoryById, personById } from "@/lib/data";
import { fmt } from "@/lib/format";
import { useApp } from "@/lib/store";

export default function ExpensesPage() {
  const { expenses, addExpense, groups } = useApp();
  const [filter, setFilter] = useState<"all" | "personal" | "bygroup">("all");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    let list = expenses;
    if (filter === "personal") list = list.filter((e) => e.paidBy === "samir");
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q));
    }
    return list;
  }, [expenses, filter, query]);

  const totals = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const thisMonth = expenses.slice(0, 4).reduce((s, e) => s + e.amount, 0);
    const avg = total / Math.max(1, expenses.length);
    return { total, thisMonth, avg, count: expenses.length };
  }, [expenses]);

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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Expenses</h1>
          <p>Track and manage all expenses in your groups.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="download" size={14} /> Export</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={14} /> Add Expense
          </button>
        </div>
      </div>

      <div className="page-2col">
        <div>
          <div className="stat-grid-4">
            <div className="card stat-c">
              <div className="ic" style={{ background: "#eeecff", color: "#5b4ef0" }}><Icon name="wallet" size={22} /></div>
              <div>
                <div className="lbl">Total Expenses</div>
                <div className="v num">{fmt(totals.total)}</div>
                <div className="sub"><span className="delta neg">↓ 8.2%</span> vs last month</div>
              </div>
            </div>
            <div className="card stat-c">
              <div className="ic" style={{ background: "#fce7f3", color: "#ec4899" }}><Icon name="receipt" size={22} /></div>
              <div>
                <div className="lbl">This Month</div>
                <div className="v num">{fmt(totals.thisMonth)}</div>
                <div className="sub"><span className="delta pos">↑ 15.3%</span> vs last month</div>
              </div>
            </div>
            <div className="card stat-c">
              <div className="ic" style={{ background: "#fff1e6", color: "#f97316" }}><Icon name="coin" size={22} /></div>
              <div>
                <div className="lbl">Average Expense</div>
                <div className="v num">{fmt(totals.avg)}</div>
                <div className="sub">This month</div>
              </div>
            </div>
            <div className="card stat-c">
              <div className="ic" style={{ background: "#e0f2fe", color: "#0ea5e9" }}><Icon name="sparkle" size={22} /></div>
              <div>
                <div className="lbl">Transactions</div>
                <div className="v num">{totals.count}</div>
                <div className="sub">This month</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="tabs">
              <button className={"tab" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>All</button>
              <button className={"tab" + (filter === "personal" ? " active" : "")} onClick={() => setFilter("personal")}>Personal</button>
              <button className={"tab" + (filter === "bygroup" ? " active" : "")} onClick={() => setFilter("bygroup")}>By Group</button>
            </div>

            <div className="filter-row">
              <button className="dropdown"><Icon name="receipt" size={14} className="ic" />This Month <Icon name="chev" size={12} className="chev" /></button>
              <button className="dropdown"><Icon name="groups" size={14} className="ic" />All Groups <Icon name="chev" size={12} className="chev" /></button>
              <button className="dropdown"><Icon name="filter" size={14} className="ic" />All Categories <Icon name="chev" size={12} className="chev" /></button>
              <div className="filter-grow" />
              <div className="search" style={{ width: 240 }}>
                <Icon name="search" size={14} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search expenses..." />
              </div>
            </div>

            <table className="exp-table">
              <thead>
                <tr>
                  <th>Expense</th><th>Group</th><th>Paid by</th><th>Amount</th>
                  <th>Date <Icon name="sortArrows" size={11} style={{ verticalAlign: "middle", opacity: 0.4 }} /></th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 7).map((e) => {
                  const cat = categoryById(e.categoryId);
                  const g = groups.find((x) => x.id === e.groupId);
                  const payer = personById(e.paidBy);
                  return (
                    <tr key={e.id}>
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
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{g?.name || "—"}</span>
                          {g && <AvatarStack ids={g.memberIds} max={3} />}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar id={e.paidBy} size="sm" />
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                            {payer.you ? "You" : payer.name.split(" ")[0] + " " + payer.name.split(" ")[1][0] + "."}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="exp-amt num">{fmt(e.amount)}</div>
                        <span className="cat-pill" style={{ background: cat.pillBg, color: cat.pillFg }}>{cat.name}</span>
                      </td>
                      <td>
                        <div className="exp-date">{e.date}</div>
                        <div className="exp-time">{e.time}</div>
                      </td>
                      <td>
                        <button className="btn-more-i"><Icon name="dots" size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="pag">
              <span>Showing 1 to {Math.min(7, filtered.length)} of {filtered.length} expenses</span>
              <div className="pag-pages">
                <button className="pag-btn"><Icon name="chevR" size={12} style={{ transform: "rotate(180deg)" }} /></button>
                <button className="pag-btn active">1</button>
                <button className="pag-btn">2</button>
                <button className="pag-btn">3</button>
                <button className="pag-btn">4</button>
                <button className="pag-btn">5</button>
                <button className="pag-btn"><Icon name="chevR" size={12} /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="rail">
          <div className="rail-card">
            <div className="rail-head"><h3>Summary by Category</h3></div>
            <div className="rail-donut-wrap">
              <div className="rail-donut">
                <CategoryDonut data={byCategory} total={totals.total} />
              </div>
              <div className="rail-legend">
                {byCategory.slice(0, 6).map((c) => (
                  <div key={c.id} className="rail-legend-row">
                    <div className="dotc" style={{ background: c.color }} />
                    <span>{c.name}</span>
                    <b className="num">{Math.round((c.amount / totals.total) * 100)}%</b>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rail-card">
            <div className="rail-head"><h3>Top Spending Groups</h3><button className="rail-link">View all</button></div>
            <div className="spend-list">
              {byGroup.map((g) => (
                <div key={g.id} className="spend-row">
                  <div className="spend-row-h">
                    <span className="nm">{g.name}</span>
                    <span className="amt num">{fmt(g.amount)}</span>
                  </div>
                  <div className="spend-bar">
                    <div
                      className="spend-bar-fill"
                      style={{ width: (g.amount / byGroup[0].amount) * 100 + "%", background: g.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rail-card">
            <div className="rail-head"><h3>Recent Settlements</h3><button className="rail-link">View all</button></div>
            <div>
              {SETTLEMENTS.map((s, i) => (
                <div key={i} className="settle-row">
                  <Avatar id={s.from === "samir" ? s.to : s.from} size="md" />
                  <div className="body">
                    <div className="nm">
                      {s.from === "samir" ? (
                        <>You paid <b>{personById(s.to).name.split(" ")[0]} {personById(s.to).name.split(" ")[1][0]}.</b></>
                      ) : (
                        <><b>{personById(s.from).name.split(" ")[0]} {personById(s.from).name.split(" ")[1][0]}.</b> paid you</>
                      )}
                    </div>
                    <div className="ds">{s.label}</div>
                  </div>
                  <div>
                    <div className="amt num">{fmt(s.amount)}</div>
                    <div className="settle-status">Settled</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showAdd && (
        <AddExpenseFullModal
          onClose={() => setShowAdd(false)}
          onSubmit={(e) => {
            addExpense(e);
            setShowAdd(false);
          }}
        />
      )}
    </>
  );
}
