"use client";
// app/groups/page.tsx

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import CreateGroupModal from "@/components/modals/CreateGroupModal";
import { EXPENSES, categoryById, personById } from "@/lib/data";
import { fmt } from "@/lib/format";
import { useApp } from "@/lib/store";

export default function GroupsPage() {
  const { groups, createGroup, expenses } = useApp();
  const [selectedId, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showCreate, setShowCreate] = useState(false);

  // First real group becomes the default once data loads.
  useEffect(() => {
    if (!selectedId && groups.length > 0) setSelected(groups[0].id);
  }, [groups, selectedId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, query]);

  const selected = groups.find((g) => g.id === selectedId) || groups[0];
  const selectedExpenses = (
    selected ? expenses.filter((e) => e.groupId === selected.id) : []
  ).slice(0, 3);

  const memberBalances = useMemo(() => {
    if (!selected) return [];
    // The store currently surfaces global friend balances, not per-group ones.
    // Until the group-balances endpoint is wired through here, default to 0.
    return selected.memberIds.map((id) => ({ personId: id, balance: 0 }));
  }, [selected]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Groups</h1>
          <p>Create and manage your expense groups.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={14} /> Create Group
          </button>
        </div>
      </div>

      <div className="page-2col">
        <div>
          <div className="filter-row">
            <div className="search" style={{ maxWidth: 280 }}>
              <Icon name="search" size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search groups..." />
            </div>
            <button className="dropdown">All Types <Icon name="chev" size={12} className="chev" /></button>
            <button className="dropdown">Sort by: Recently Updated <Icon name="chev" size={12} className="chev" /></button>
            <div className="filter-grow" />
            <div className="view-toggle">
              <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>
                <Icon name="grid" size={14} />
              </button>
              <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
                <Icon name="list" size={14} />
              </button>
            </div>
          </div>

          <div className="group-grid">
            {filtered.map((g) => {
              const isSel = selected ? g.id === selected.id : false;
              const owedClass = g.balance > 0 ? "owed" : g.balance < 0 ? "you-owe" : "settled";
              const owedText =
                g.balance > 0
                  ? `You are owed ${fmt(g.balance)}`
                  : g.balance < 0
                  ? `You owe ${fmt(Math.abs(g.balance))}`
                  : "Settled";
              return (
                <div
                  key={g.id}
                  className={"group-card" + (isSel ? " selected" : "")}
                  onClick={() => setSelected(g.id)}
                >
                  <div
                    className="group-hero"
                    style={{ ["--ha" as never]: g.heroA, ["--hb" as never]: g.heroB }}
                  >
                    <div className="group-hero-actions">
                      <button onClick={(e) => e.stopPropagation()}>
                        <Icon name="dots" size={14} />
                      </button>
                    </div>
                    <div className="group-hero-ic" style={{ color: g.color }}>
                      <Icon name={g.icon} size={26} />
                    </div>
                  </div>
                  <div className="group-body">
                    <div className="group-name">{g.name}</div>
                    <div className="group-mems">{g.memberIds.length} members</div>
                    <div className="group-row">
                      <span className="group-amt num">{fmt(g.total)}</span>
                      <span className={"group-balance " + owedClass}>{owedText}</span>
                    </div>
                    <div className="group-prog">
                      <div
                        className="group-prog-fill"
                        style={{ width: Math.min(100, (g.total / 250) * 100) + "%", background: g.color }}
                      />
                    </div>
                    <div className="group-updated">Updated {g.updated}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pag">
            <span>Showing 1 to {filtered.length} of {filtered.length} groups</span>
            <div className="pag-pages">
              <button className="pag-btn"><Icon name="chevR" size={12} style={{ transform: "rotate(180deg)" }} /></button>
              <button className="pag-btn active">1</button>
              <button className="pag-btn">2</button>
              <button className="pag-btn"><Icon name="chevR" size={12} /></button>
            </div>
          </div>
        </div>

        <div className="rail">
          {selected && (
            <>
            <div className="gd-hero-card">
            <div
              className="gd-hero-img"
              style={{ ["--ha" as never]: selected.heroA, ["--hb" as never]: selected.heroB }}
            >
              <div className="gd-hero-actions">
                <button><Icon name="dots" size={14} /></button>
              </div>
            </div>
            <div className="gd-content">
              <div className="gd-icon-large" style={{ color: selected.color }}>
                <Icon name={selected.icon} size={26} />
              </div>
              <div className="gd-name">
                {selected.name}
                <button><Icon name="edit" size={13} /></button>
              </div>
              <div className="gd-sub">{selected.memberIds.length} members · Created by Samir Ali</div>

              <div className="gd-stats">
                <div className="gd-stat">
                  <div className="lbl">Total</div>
                  <div className="v num">{fmt(selected.total)}</div>
                </div>
                <div className="gd-stat">
                  <div className="lbl">{selected.balance < 0 ? "You owe" : "You're owed"}</div>
                  <div className={"v num" + (selected.balance < 0 ? " neg" : "")}>
                    {fmt(Math.abs(selected.balance))}
                  </div>
                </div>
                <div className="gd-stat">
                  <div className="lbl">Settled</div>
                  <div className="v">2 of {selected.memberIds.length}</div>
                </div>
              </div>

              <div className="gd-actions">
                <Link href={"/groups/" + selected.id} className="btn btn-primary">
                  <Icon name="plus" size={13} /> View Expenses
                </Link>
                <button className="btn btn-secondary">Settle Up</button>
                <button className="btn btn-secondary btn-icon"><Icon name="dots" size={14} /></button>
              </div>

              <div className="gd-members">
                <div className="rail-head" style={{ marginBottom: 6 }}>
                  <h3 style={{ fontSize: 13 }}>Members</h3>
                  <button className="rail-link">View all</button>
                </div>
                {selected.memberIds.slice(0, 6).map((id) => {
                  const p = personById(id);
                  const b = memberBalances.find((m) => m.personId === id)?.balance || 0;
                  return (
                    <div key={id} className="gd-mem">
                      <Avatar id={id} size="md" />
                      <div>
                        <div className="nm">{p.you ? p.name + " (You)" : p.name}</div>
                        <div className="role">{p.you ? "Admin" : "Member"}</div>
                      </div>
                      <div className={"bal " + (b >= 0 ? "pos" : "neg")}>
                        {b >= 0 ? "+" : "−"}
                        {fmt(Math.abs(b))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rail-card">
            <div className="rail-head"><h3>Recent Expenses</h3><button className="rail-link">View all</button></div>
            {selectedExpenses.map((e) => {
              const cat = categoryById(e.categoryId);
              return (
                <div key={e.id} className="settle-row">
                  <div className="av av-md" style={{ background: cat.soft, color: cat.color }}>
                    <Icon name={cat.icon} size={14} />
                  </div>
                  <div className="body">
                    <div className="nm">{e.title}</div>
                    <div className="ds">{e.date}</div>
                  </div>
                  <div className="amt num">{fmt(e.amount)}</div>
                </div>
              );
            })}
            {selectedExpenses.length === 0 && (
              <div style={{ padding: "12px 0", fontSize: 12, color: "var(--ink-3)" }}>No expenses yet.</div>
            )}
          </div>
          </>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onSubmit={(g) => {
            createGroup(g);
            setShowCreate(false);
          }}
        />
      )}
    </>
  );
}
