// pages.jsx — Expenses, Groups, Friends pages + shared components

const { useState: pUseState, useMemo: pUseMemo } = React;

// ── AVATAR ─────────────────────────────────────────────────────────────────
const Avatar = ({ id, size = "md", style }) => {
  const p = personById(id);
  if (!p) return <div className={"av av-" + size} style={style}/>;
  const initials = p.name.split(" ").slice(0, 2).map((s) => s[0]).join("");
  return (
    <div className={"av av-" + size}
      style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color2})`, ...style }}>
      {initials}
    </div>
  );
};

const AvatarStack = ({ ids, max = 4, size = "sm" }) => {
  const shown = ids.slice(0, max);
  const extra = Math.max(0, ids.length - max);
  return (
    <div className="av-stack">
      {shown.map((id) => <Avatar key={id} id={id} size={size}/>)}
      {extra > 0 && <div className="av-more">+{extra}</div>}
    </div>
  );
};

// ── EXPENSES PAGE ──────────────────────────────────────────────────────────
const ExpensesPage = ({ expenses, onAddExpense }) => {
  const [filter, setFilter] = pUseState("all"); // all/personal/by-group
  const [query, setQuery] = pUseState("");

  const filtered = pUseMemo(() => {
    let list = expenses;
    if (filter === "personal") list = list.filter((e) => e.paidBy === "samir");
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q));
    }
    return list;
  }, [expenses, filter, query]);

  const totals = pUseMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const thisMonth = expenses.slice(0, 4).reduce((s, e) => s + e.amount, 0);
    const avg = total / Math.max(1, expenses.length);
    return { total, thisMonth, avg, count: expenses.length };
  }, [expenses]);

  // Category breakdown for rail donut
  const byCategory = pUseMemo(() => {
    const m = {};
    expenses.forEach((e) => { m[e.categoryId] = (m[e.categoryId] || 0) + e.amount; });
    return CATEGORIES.map((c) => ({ ...c, amount: m[c.id] || 0 })).filter((c) => c.amount > 0);
  }, [expenses]);

  const byGroup = pUseMemo(() => {
    const m = {};
    expenses.forEach((e) => { m[e.groupId] = (m[e.groupId] || 0) + e.amount; });
    return GROUPS.map((g) => ({ ...g, amount: m[g.id] || 0 })).filter((g) => g.amount > 0)
      .sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [expenses]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Expenses</h1>
          <p>Track and manage all expenses in your groups.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="download" size={14}/> Export</button>
          <button className="btn btn-primary" onClick={onAddExpense}><Icon name="plus" size={14}/> Add Expense</button>
        </div>
      </div>

      <div className="page-2col">
        <div>
          {/* Stats */}
          <div className="stat-grid-4">
            <div className="card stat-c">
              <div className="ic" style={{ background: "#eeecff", color: "#5b4ef0" }}><Icon name="wallet" size={22}/></div>
              <div>
                <div className="lbl">Total Expenses</div>
                <div className="v num">{fmt(totals.total)}</div>
                <div className="sub"><span className="delta neg">↓ 8.2%</span> vs last month</div>
              </div>
            </div>
            <div className="card stat-c">
              <div className="ic" style={{ background: "#fce7f3", color: "#ec4899" }}><Icon name="receipt" size={22}/></div>
              <div>
                <div className="lbl">This Month</div>
                <div className="v num">{fmt(totals.thisMonth)}</div>
                <div className="sub"><span className="delta pos">↑ 15.3%</span> vs last month</div>
              </div>
            </div>
            <div className="card stat-c">
              <div className="ic" style={{ background: "#fff1e6", color: "#f97316" }}><Icon name="coin" size={22}/></div>
              <div>
                <div className="lbl">Average Expense</div>
                <div className="v num">{fmt(totals.avg)}</div>
                <div className="sub">This month</div>
              </div>
            </div>
            <div className="card stat-c">
              <div className="ic" style={{ background: "#e0f2fe", color: "#0ea5e9" }}><Icon name="sparkle" size={22}/></div>
              <div>
                <div className="lbl">Transactions</div>
                <div className="v num">{totals.count}</div>
                <div className="sub">This month</div>
              </div>
            </div>
          </div>

          {/* Expenses Table card */}
          <div className="card" style={{ padding: 18 }}>
            <div className="tabs">
              <button className={"tab" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>All</button>
              <button className={"tab" + (filter === "personal" ? " active" : "")} onClick={() => setFilter("personal")}>Personal</button>
              <button className={"tab" + (filter === "bygroup" ? " active" : "")} onClick={() => setFilter("bygroup")}>By Group</button>
            </div>

            <div className="filter-row">
              <button className="dropdown"><Icon name="receipt" size={14} className="ic"/>This Month <Icon name="chev" size={12} className="chev"/></button>
              <button className="dropdown"><Icon name="groups" size={14} className="ic"/>All Groups <Icon name="chev" size={12} className="chev"/></button>
              <button className="dropdown"><Icon name="filter" size={14} className="ic"/>All Categories <Icon name="chev" size={12} className="chev"/></button>
              <div className="filter-grow"/>
              <div className="search" style={{ width: 240 }}>
                <Icon name="search" size={14}/>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search expenses..."/>
              </div>
            </div>

            <table className="exp-table">
              <thead>
                <tr>
                  <th>Expense</th><th>Group</th><th>Paid by</th><th>Amount</th><th>Date <Icon name="sortArrows" size={11} style={{verticalAlign:"middle",opacity:.4}}/></th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 7).map((e) => {
                  const cat = categoryById(e.categoryId);
                  const g = groupById(e.groupId);
                  const payer = personById(e.paidBy);
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="exp-cell">
                          <div className="ic" style={{ background: cat.soft, color: cat.color }}>
                            <Icon name={cat.icon} size={18}/>
                          </div>
                          <div className="body">
                            <div className="nm">{e.title}</div>
                            <div className="ds">{e.subtitle}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{g.name}</span>
                          <AvatarStack ids={g.memberIds} max={3}/>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar id={e.paidBy} size="sm"/>
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
                        <button className="btn-more-i"><Icon name="dots" size={16}/></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="pag">
              <span>Showing 1 to {Math.min(7, filtered.length)} of {filtered.length} expenses</span>
              <div className="pag-pages">
                <button className="pag-btn"><Icon name="chevR" size={12} style={{transform:"rotate(180deg)"}}/></button>
                <button className="pag-btn active">1</button>
                <button className="pag-btn">2</button>
                <button className="pag-btn">3</button>
                <button className="pag-btn">4</button>
                <button className="pag-btn">5</button>
                <button className="pag-btn"><Icon name="chevR" size={12}/></button>
              </div>
            </div>
          </div>
        </div>

        {/* RAIL */}
        <div className="rail">
          {/* Summary by Category */}
          <div className="rail-card">
            <div className="rail-head"><h3>Summary by Category</h3></div>
            <div className="rail-donut-wrap">
              <div className="rail-donut">
                <CategoryDonut data={byCategory} total={totals.total}/>
              </div>
              <div className="rail-legend">
                {byCategory.slice(0, 6).map((c) => (
                  <div key={c.id} className="rail-legend-row">
                    <div className="dotc" style={{ background: c.color }}/>
                    <span>{c.name}</span>
                    <b className="num">{Math.round(c.amount / totals.total * 100)}%</b>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Spending Groups */}
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
                    <div className="spend-bar-fill" style={{ width: (g.amount / byGroup[0].amount * 100) + "%", background: g.color }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Settlements */}
          <div className="rail-card">
            <div className="rail-head"><h3>Recent Settlements</h3><button className="rail-link">View all</button></div>
            <div>
              {SETTLEMENTS.map((s, i) => (
                <div key={i} className="settle-row">
                  <Avatar id={s.from === "samir" ? s.to : s.from} size="md"/>
                  <div className="body">
                    <div className="nm">
                      {s.from === "samir" ? <>You paid <b>{personById(s.to).name.split(" ")[0]} {personById(s.to).name.split(" ")[1][0]}.</b></>
                        : <><b>{personById(s.from).name.split(" ")[0]} {personById(s.from).name.split(" ")[1][0]}.</b> paid you</>}
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
    </>
  );
};

// Small donut for category breakdown
const CategoryDonut = ({ data, total }) => {
  let acc = 0;
  return (
    <>
      <svg width="120" height="120" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f2f6" strokeWidth="13"/>
        {data.map((c) => {
          const angle = c.amount / total * 360;
          const start = acc;
          acc += angle;
          return <path key={c.id} d={arc(50, 50, 38, start, start + angle)}
            fill="none" stroke={c.color} strokeWidth="13"/>;
        })}
      </svg>
      <div className="donut-center">
        <div>
          <div className="v num">{fmt0(total)}</div>
          <div className="l">Total</div>
        </div>
      </div>
    </>
  );
};

// ── GROUPS PAGE ────────────────────────────────────────────────────────────
const GroupsPage = ({ groups, onCreateGroup }) => {
  const [selectedId, setSelected] = pUseState("istanbul");
  const [query, setQuery] = pUseState("");
  const [view, setView] = pUseState("grid");

  const filtered = pUseMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, query]);
  const selected = groupById(selectedId) || groups[0];
  const selectedExpenses = EXPENSES.filter((e) => e.groupId === selected.id).slice(0, 3);
  const memberBalances = pUseMemo(() => {
    // mock balances per member
    const seeds = { samir: -120.40, ahmed: 60.20, youssef: -40.10, sara: 70.30, omar: -30.00, lina: 60.00 };
    return selected.memberIds.map((id) => ({
      personId: id,
      balance: seeds[id] !== undefined ? seeds[id] : (Math.random() * 100 - 50),
    }));
  }, [selected.id]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Groups</h1>
          <p>Create and manage your expense groups.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={onCreateGroup}><Icon name="plus" size={14}/> Create Group</button>
        </div>
      </div>

      <div className="page-2col">
        <div>
          <div className="filter-row">
            <div className="search" style={{ maxWidth: 280 }}>
              <Icon name="search" size={14}/>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search groups..."/>
            </div>
            <button className="dropdown">All Types <Icon name="chev" size={12} className="chev"/></button>
            <button className="dropdown">Sort by: Recently Updated <Icon name="chev" size={12} className="chev"/></button>
            <div className="filter-grow"/>
            <div className="view-toggle">
              <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}><Icon name="grid" size={14}/></button>
              <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><Icon name="list" size={14}/></button>
            </div>
          </div>

          <div className="group-grid">
            {filtered.map((g) => {
              const isSel = g.id === selected.id;
              const owedClass = g.balance > 0 ? "owed" : g.balance < 0 ? "you-owe" : "settled";
              const owedText = g.balance > 0 ? `You are owed ${fmt(g.balance)}`
                : g.balance < 0 ? `You owe ${fmt(Math.abs(g.balance))}` : "Settled";
              return (
                <div key={g.id} className={"group-card" + (isSel ? " selected" : "")} onClick={() => setSelected(g.id)}>
                  <div className="group-hero" style={{ "--ha": g.heroA, "--hb": g.heroB }}>
                    <div className="group-hero-actions">
                      <button onClick={(e) => e.stopPropagation()}><Icon name="dots" size={14}/></button>
                    </div>
                    <div className="group-hero-ic" style={{ color: g.color }}>
                      <Icon name={g.icon} size={26}/>
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
                      <div className="group-prog-fill" style={{ width: Math.min(100, g.total / 250 * 100) + "%", background: g.color }}/>
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
              <button className="pag-btn"><Icon name="chevR" size={12} style={{transform:"rotate(180deg)"}}/></button>
              <button className="pag-btn active">1</button>
              <button className="pag-btn">2</button>
              <button className="pag-btn"><Icon name="chevR" size={12}/></button>
            </div>
          </div>
        </div>

        {/* RAIL — selected group detail */}
        <div className="rail">
          <div className="gd-hero-card">
            <div className="gd-hero-img" style={{ "--ha": selected.heroA, "--hb": selected.heroB }}>
              <div className="gd-hero-actions">
                <button><Icon name="dots" size={14}/></button>
              </div>
            </div>
            <div className="gd-content">
              <div className="gd-icon-large" style={{ color: selected.color }}>
                <Icon name={selected.icon} size={26}/>
              </div>
              <div className="gd-name">
                {selected.name}
                <button><Icon name="edit" size={13}/></button>
              </div>
              <div className="gd-sub">{selected.memberIds.length} members · Created by Samir Ali</div>

              <div className="gd-stats">
                <div className="gd-stat">
                  <div className="lbl">Total</div>
                  <div className="v num">{fmt(selected.total)}</div>
                </div>
                <div className="gd-stat">
                  <div className="lbl">{selected.balance < 0 ? "You owe" : "You're owed"}</div>
                  <div className={"v num" + (selected.balance < 0 ? " neg" : "")}>{fmt(Math.abs(selected.balance))}</div>
                </div>
                <div className="gd-stat">
                  <div className="lbl">Settled</div>
                  <div className="v">2 of {selected.memberIds.length}</div>
                </div>
              </div>

              <div className="gd-actions">
                <button className="btn btn-primary"><Icon name="plus" size={13}/> Add Expense</button>
                <button className="btn btn-secondary">Settle Up</button>
                <button className="btn btn-secondary btn-icon"><Icon name="dots" size={14}/></button>
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
                      <Avatar id={id} size="md"/>
                      <div>
                        <div className="nm">{p.you ? p.name + " (You)" : p.name}</div>
                        <div className="role">{p.you ? "Admin" : "Member"}</div>
                      </div>
                      <div className={"bal " + (b >= 0 ? "pos" : "neg")}>
                        {b >= 0 ? "+" : "−"}{fmt(Math.abs(b))}
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
                    <Icon name={cat.icon} size={14}/>
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
        </div>
      </div>
    </>
  );
};

// ── FRIENDS PAGE ───────────────────────────────────────────────────────────
const FriendsPage = ({ friends, onAddFriend, onSettle }) => {
  const [tab, setTab] = pUseState("friend"); // friend/received/sent
  const [query, setQuery] = pUseState("");

  const counts = {
    friend: friends.filter((f) => f.status === "friend").length,
    received: friends.filter((f) => f.status === "received").length,
    sent: friends.filter((f) => f.status === "sent").length,
  };

  const visible = pUseMemo(() => {
    let list = friends.filter((f) => f.status === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((f) => personById(f.personId).name.toLowerCase().includes(q));
    }
    return list;
  }, [friends, tab, query]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Friends</h1>
          <p>Manage your friends, requests and connections.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={onAddFriend}><Icon name="userPlus" size={14}/> Add Friend</button>
        </div>
      </div>

      <div className="page-2col">
        <div>
          <div className="tabs">
            <button className={"tab" + (tab === "friend" ? " active" : "")} onClick={() => setTab("friend")}>
              <Icon name="groups" size={14}/> My Friends
            </button>
            <button className={"tab" + (tab === "received" ? " active" : "")} onClick={() => setTab("received")}>
              <Icon name="userPlus" size={14}/> Received Requests
              {counts.received > 0 && <span className="tab-badge">{counts.received}</span>}
            </button>
            <button className={"tab" + (tab === "sent" ? " active" : "")} onClick={() => setTab("sent")}>
              <Icon name="userPlus" size={14}/> Sent Requests
            </button>
          </div>

          <div className="friend-list">
            <div className="friend-list-head">
              <div className="search">
                <Icon name="search" size={14}/>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your friends..."/>
              </div>
              <button className="dropdown">Sort by: Name (A-Z) <Icon name="chev" size={12} className="chev"/></button>
            </div>

            {visible.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-3)" }}>
                <Icon name="groups" size={32} style={{ opacity: .4, marginBottom: 8 }}/>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>No {tab === "received" ? "requests" : tab === "sent" ? "pending" : "friends"} yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {tab === "friend" ? "Add a friend to get started" : "Check back later"}
                </div>
              </div>
            ) : visible.map((f) => {
              const p = personById(f.personId);
              return (
                <div key={f.personId} className="friend-row">
                  <Avatar id={f.personId} size="lg"/>
                  <div>
                    <div className="nm">{p.name}</div>
                    <div className="sub">
                      <Icon name="groups" size={12}/> {f.mutuals} mutual friends
                    </div>
                  </div>
                  {tab === "friend" ? (
                    <>
                      {f.balance === 0 ? (
                        <div className="friend-bal settled">
                          <div className="v num">{fmt(0)}</div>
                        </div>
                      ) : (
                        <div className={"friend-bal " + (f.balance > 0 ? "owed" : "youowe")}>
                          <div className="lbl">{f.balance > 0 ? "You are owed" : "You owe"}</div>
                          <div className="v num">{fmt(Math.abs(f.balance))}</div>
                        </div>
                      )}
                      {f.balance !== 0 ? (
                        <button className="btn-settle" onClick={() => onSettle(f.personId)}>Settle up</button>
                      ) : <div/>}
                      <button className="btn-chat"><Icon name="chat" size={15}/></button>
                      <button className="btn-more-i"><Icon name="dots" size={15}/></button>
                    </>
                  ) : tab === "received" ? (
                    <>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Sent {f.requestAt}</div>
                      <div className="req-actions">
                        <button className="btn-decline">Decline</button>
                        <button className="btn-accept">Accept</button>
                      </div>
                      <div/>
                      <button className="btn-more-i"><Icon name="dots" size={15}/></button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Sent {f.requestAt}</div>
                      <span className="status-badge pending">Pending</span>
                      <div/>
                      <button className="btn-more-i"><Icon name="dots" size={15}/></button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RAIL */}
        <div className="rail">
          <div className="rail-card">
            <div className="rail-head"><h3>People you may know</h3><button className="rail-link">View all</button></div>
            {SUGGESTIONS.map((s) => {
              const p = personById(s.personId);
              return (
                <div key={s.personId} className="pymk-row">
                  <Avatar id={s.personId} size="md"/>
                  <div>
                    <div className="nm">{p.name}</div>
                    <div className="sub">{s.mutuals} mutual friends</div>
                  </div>
                  <button className="btn-add-sm"><Icon name="plus" size={11}/> Add</button>
                </div>
              );
            })}
          </div>

          <div className="rail-card">
            <div className="rail-head"><h3>Friend activity</h3><button className="rail-link">View all</button></div>
            {FRIEND_ACTIVITY.map((a, i) => {
              const p = personById(a.who);
              return (
                <div key={i} className="act-row">
                  <div className="ic" style={{ background: a.soft, color: a.color }}>
                    <Icon name={a.icon} size={15}/>
                  </div>
                  <div className="body">
                    <div className="nm"><b>{p.name}</b> {a.action}</div>
                    <div className="ds">{a.detail}</div>
                  </div>
                  <div className="when">{a.when}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

// ── Coming Soon placeholder ────────────────────────────────────────────────
const ComingSoon = ({ title }) => (
  <>
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>Coming soon.</p>
      </div>
    </div>
    <div className="coming-soon">
      <div className="ic"><Icon name="sparkle" size={36}/></div>
      <h3>This page is on the way</h3>
      <p>We're building this section. In the meantime, head to Jars, Expenses, Groups, or Friends.</p>
    </div>
  </>
);

Object.assign(window, { Avatar, AvatarStack, ExpensesPage, GroupsPage, FriendsPage, ComingSoon });
