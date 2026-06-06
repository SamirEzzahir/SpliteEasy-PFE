"use client";
// app/groups/[id]/page.tsx — Group Expenses (one group view)

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Icon from "@/components/Icon";
import { Avatar, AvatarStack } from "@/components/Avatar";
import { categoryById, personById } from "@/lib/data";
import { useApp } from "@/lib/store";

const fmtMad = (n: number) =>
  "MAD " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const { groups, expenses } = useApp();

  const group = groups.find((g) => g.id === params.id) || groups[0];

  const [query, setQuery] = useState("");

  const groupExpenses = useMemo(
    () => expenses.filter((e) => !group || e.groupId === group.id),
    [expenses, group],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return groupExpenses;
    const q = query.toLowerCase();
    return groupExpenses.filter((e) => e.title.toLowerCase().includes(q));
  }, [groupExpenses, query]);

  // Totals shown in the 5 stat cards
  const totals = useMemo(() => {
    const total = groupExpenses.reduce((s, e) => s + e.amount, 0);
    // Demo numbers — wire to /settle/{group_id}/balances when available
    const youOwe = 120.5;
    const youAreOwed = 85.0;
    const unsettled = 455.25;
    const settled = total - unsettled > 0 ? total - unsettled : 795.5;
    return { total: total || 1250.75, youOwe, youAreOwed, unsettled, settled };
  }, [groupExpenses]);

  if (!group) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Group not found</h1>
            <p>That group doesn't exist or you don't have access.</p>
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
        <span className="cur">{group.name}</span>
      </div>

      <div className="page-head">
        <div>
          <h1>Expenses</h1>
          <p>Track and manage all group expenses in one place.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="download" size={14} /> Export Excel</button>
          <button className="btn btn-secondary"><Icon name="upload" size={14} /> Import Excel</button>
          <button className="btn btn-primary"><Icon name="plus" size={14} /> Add Expense</button>
          <button className="btn btn-secondary btn-icon" style={{ padding: 9 }}><Icon name="dots" size={14} /></button>
        </div>
      </div>

      {/* 5 stat cards */}
      <div className="stat-grid-5">
        <div className="gx-stat">
          <span className="lbl">Total Expenses</span>
          <span className="v" style={{ color: "var(--primary)" }}>{fmtMad(totals.total)}</span>
          <span className="sub">Across {groupExpenses.length || 15} expenses</span>
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
          <span className="sub">In 7 expenses</span>
        </div>
        <div className="gx-stat">
          <span className="lbl">Settled</span>
          <span className="v" style={{ color: "var(--success)" }}>{fmtMad(totals.settled)}</span>
          <span className="sub">In 8 expenses</span>
        </div>
      </div>

      {/* Filters + table */}
      <div className="card" style={{ padding: 18 }}>
        <div className="filter-row">
          <button className="dropdown"><Icon name="receipt" size={14} className="ic"/>This Month <Icon name="chev" size={12} className="chev" /></button>
          <button className="dropdown"><Icon name="filter" size={14} className="ic"/>All Categories <Icon name="chev" size={12} className="chev" /></button>
          <button className="dropdown"><Icon name="account" size={14} className="ic"/>All Paid By <Icon name="chev" size={12} className="chev" /></button>
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "48px 0", textAlign: "center", color: "var(--ink-3)" }}>
                  No expenses in this group yet.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 7).map((e) => {
                const cat = categoryById(e.categoryId);
                const payer = personById(e.paidBy);
                // Demo: your share is a fraction; alternate "lent / owed / not involved"
                const yourShare = e.amount / Math.max(1, group.memberIds.length);
                const youArePayer = e.paidBy === "samir";
                const participants = group.memberIds.slice(0, 4);
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
                      <div style={{ fontSize: 12, color: youArePayer ? "var(--success)" : "var(--rose)", fontWeight: 600 }}>
                        {youArePayer ? "You lent" : "You owe"}
                      </div>
                      <div className="num" style={{ fontWeight: 600, color: youArePayer ? "var(--success)" : "var(--rose)" }}>
                        {fmtMad(yourShare)}
                      </div>
                    </td>
                    <td>
                      <div className="exp-date">{e.date}</div>
                      <div className="exp-time">{e.time}</div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                        <button className="tbl-act" aria-label="View"><Icon name="search" size={14}/></button>
                        <button className="tbl-act" aria-label="Edit"><Icon name="edit" size={14}/></button>
                        <button className="tbl-act danger" aria-label="Delete"><Icon name="x" size={14}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="pag">
          <span>Showing 1 to {Math.min(7, filtered.length)} of {filtered.length || 15} expenses</span>
          <div className="pag-pages">
            <button className="pag-btn"><Icon name="chevR" size={12} style={{ transform: "rotate(180deg)" }} /></button>
            <button className="pag-btn active">1</button>
            <button className="pag-btn">2</button>
            <button className="pag-btn">3</button>
            <button className="pag-btn"><Icon name="chevR" size={12} /></button>
          </div>
        </div>
      </div>
    </>
  );
}
