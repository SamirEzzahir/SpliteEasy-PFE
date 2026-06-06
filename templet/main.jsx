// main.jsx — SplitEasy app entry (multi-page)

const { useState: aUseState, useMemo: aUseMemo, useEffect: aUseEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "vizStyle": "cards",
  "showDonut": true,
  "accent": "#5b4ef0",
  "dark": false
}/*EDITMODE-END*/;

// ── DATA ────────────────────────────────────────────────────────────────────
const INITIAL_JARS = [
  { id: "necessities", name: "Necessities", desc: "Rent, food, bills, transport",
    icon: "home",    color: "#f97316", soft: "#fff1e6", pct: 55, kind: "spend",
    spent: 5248.09, saved: 0 },
  { id: "financial", name: "Financial Freedom", desc: "Investments, passive income",
    icon: "coin",    color: "#10b981", soft: "#dcfce7", pct: 10, kind: "save",
    spent: 0, saved: 1254.07, _celebrated: true },
  { id: "savings", name: "Long-term Savings", desc: "Big purchases, emergencies",
    icon: "target",  color: "#f43f5e", soft: "#ffe4e6", pct: 10, kind: "save",
    spent: 0, saved: 1125.50, _celebrated: true },
  { id: "education", name: "Education", desc: "Books, courses, growth",
    icon: "book",    color: "#0ea5e9", soft: "#e0f2fe", pct: 10, kind: "spend",
    spent: 203.83, saved: 0 },
  { id: "play", name: "Play", desc: "Fun, entertainment, dining",
    icon: "party",   color: "#ec4899", soft: "#fce7f3", pct: 10, kind: "spend",
    spent: 408.68, saved: 0 },
  { id: "give", name: "Give", desc: "Charity, gifts, donations",
    icon: "gift",    color: "#8b5cf6", soft: "#ede9fe", pct: 5,  kind: "spend",
    spent: 258.92, saved: 0 },
];

const INITIAL_TX = [
  { id: 1, date: "May 16, 2026", desc: "Grocery Shopping", jarId: "necessities", type: "expense", amount: 76.80 },
  { id: 2, date: "May 15, 2026", desc: "Stock Investment", jarId: "financial",   type: "expense", amount: 500.00 },
  { id: 3, date: "May 14, 2026", desc: "Online Course",    jarId: "education",   type: "expense", amount: 120.00 },
  { id: 4, date: "May 13, 2026", desc: "Movie Night",      jarId: "play",        type: "expense", amount: 45.00 },
  { id: 5, date: "May 12, 2026", desc: "Charity Donation", jarId: "give",        type: "expense", amount: 30.00 },
  { id: 6, date: "May 1, 2026",  desc: "Salary May 2026",  jarId: null,          type: "income",  amount: 8420.00 },
];
const INITIAL_INCOME = 8420.00;

const buildDonutSegments = (jars) => {
  let acc = 0;
  return jars.map((j) => {
    const angle = (j.pct / 100) * 360;
    const start = acc;
    acc += angle;
    return { ...j, start, angle };
  });
};
const arc = (cx, cy, r, startDeg, endDeg) => {
  const toRad = (d) => (d - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};
window.arc = arc; // pages.jsx CategoryDonut uses it

// ── SIDEBAR ─────────────────────────────────────────────────────────────────
const Sidebar = ({ active, onNav, dark, onToggleDark }) => {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "groups", label: "Groups", icon: "groups" },
    { id: "expenses", label: "Expenses", icon: "expense" },
    { id: "settlements", label: "Settlements", icon: "settle" },
    { id: "balances", label: "Balances", icon: "money" },
    { id: "friends", label: "Friends", icon: "friends" },
    { id: "wallets", label: "Wallets", icon: "wallet" },
    { id: "jars", label: "Econome (Jars)", icon: "jars" },
    { id: "debts", label: "Debts & Loans", icon: "debt" },
    { id: "reports", label: "Reports", icon: "reports" },
    { id: "activity", label: "Activity", icon: "activity" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">$</div>
        <div className="brand-name">Split<em>Easy</em></div>
      </div>
      <nav className="nav">
        {items.map((it) => (
          <div key={it.id}
               className={"nav-item" + (active === it.id ? " active" : "")}
               onClick={() => onNav?.(it.id)}>
            <Icon name={it.icon} size={17}/>
            <span>{it.label}</span>
          </div>
        ))}
      </nav>

      <div className="sb-bottom">
        <div className="sb-profile">
          <div className="sb-profile-img">SA</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="nm">Samir Ali</div>
            <div className="sub">View profile</div>
          </div>
          <Icon name="chev" size={14} className="chev"/>
        </div>
        <div className="sb-wallet">
          <div className="sb-wallet-head">
            <span className="sb-wallet-lbl">Wallet Balance</span>
            <span className="sb-wallet-cur">USD <Icon name="chev" size={10}/></span>
          </div>
          <div className="sb-wallet-v num">$ 1,280.50</div>
          <div className="sb-wallet-trend">↑ 12.5% <span style={{ color: "#9ea4b2", fontWeight: 400, marginLeft: 2 }}>vs last month</span></div>
        </div>
        <div className="sb-toggle">
          <span className="sb-toggle-nm">
            <Icon name={dark ? "sun" : "moon"} size={15}/>
            Dark mode
          </span>
          <button className={"switch" + (dark ? " on" : "")} onClick={onToggleDark} aria-label="Toggle dark mode"/>
        </div>
      </div>
    </aside>
  );
};

const Topbar = ({ placeholder = "Search anything..." }) => (
  <header className="topbar">
    <button className="icon-btn" style={{ border: "0", background: "transparent" }} aria-label="Menu">
      <Icon name="filter" size={18} style={{ transform: "rotate(0deg)" }}/>
    </button>
    <div className="search" style={{ maxWidth: 520 }}>
      <Icon name="search" size={15}/>
      <input placeholder={placeholder}/>
    </div>
    <div className="topbar-spacer"/>
    <button className="icon-btn"><Icon name="bell" size={16}/><span className="dot"/></button>
    <button className="icon-btn"><Icon name="chat" size={16}/><span className="dot" style={{ background: "var(--primary)" }}/></button>
    <div className="profile">
      <div className="avatar">SA</div>
      <span className="profile-name">Samir Ali</span>
      <Icon name="chev" size={14}/>
    </div>
  </header>
);

// ── DONUT CHART ─────────────────────────────────────────────────────────────
const DistributionDonut = ({ jars, total }) => {
  const segments = buildDonutSegments(jars);
  return (
    <div className="card donut-card">
      <h3>Jars Distribution</h3>
      <div className="donut-wrap">
        <div className="donut">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f2f6" strokeWidth="14"/>
            {segments.map((s) => (
              <path key={s.id} d={arc(50, 50, 38, s.start, s.start + s.angle)}
                fill="none" stroke={s.color} strokeWidth="14"/>
            ))}
          </svg>
          <div className="donut-center">
            <div>
              <div className="v num">{fmt0(total)}</div>
              <div className="l">Total in Jars</div>
            </div>
          </div>
        </div>
        <div className="legend">
          {jars.map((j) => (
            <div key={j.id} className="legend-row">
              <div className="dotc" style={{ background: j.color }}/>
              <span className="legend-name">{j.name} <span style={{color: "var(--ink-4)"}}>({j.pct}%)</span></span>
              <span className="legend-amt num">{fmt0(total * j.pct / 100)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="donut-foot">100% of your income is distributed</div>
    </div>
  );
};

const HealthDonut = ({ value }) => {
  const r = 23, c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="health-donut">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#eef0f4" strokeWidth="6"/>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--success)" strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .5s ease" }}/>
      </svg>
      <div className="health-num">{value}%</div>
    </div>
  );
};

const StatsRow = ({ income, hasIncome, totalInJars, jars, onOpenStrategy }) => {
  const health = aUseMemo(() => {
    if (!hasIncome) return 0;
    let score = 0;
    jars.forEach((j) => {
      const tot = income * (j.pct / 100);
      const used = j.spent + j.saved;
      const usage = tot ? used / tot : 0;
      if (j.kind === "save") score += Math.min(1, usage);
      else score += 1 - Math.max(0, usage - 1);
    });
    return Math.round((score / jars.length) * 100);
  }, [jars, income, hasIncome]);

  return (
    <div className="stat-grid">
      <div className="card stat">
        <div className="stat-h">
          <span>Monthly Income</span>
          <span className="pill"><Icon name="chev" size={12}/> This Month</span>
        </div>
        <div className="v num">{fmt(income)}</div>
        <div className="stat-sub">
          <Icon name="info" size={13}/> Auto-distributed across 6 jars
        </div>
      </div>
      <div className="card stat">
        <div className="stat-h">
          <span>Overall Health</span>
          <span className="pill pill-success">{health >= 70 ? "Good" : health >= 40 ? "Fair" : "Watch"}</span>
        </div>
        <div className="health-wrap">
          <HealthDonut value={health}/>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
              {health >= 70 ? "You're on track! Keep going" : health >= 40 ? "Almost balanced" : "Time to adjust"}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
              {health >= 70 ? "Your jars are well balanced." : "Some jars need attention."}
            </div>
          </div>
        </div>
      </div>
      <div className="card stat">
        <div className="stat-h">
          <span>Total in Jars</span>
          <span className="pill" onClick={onOpenStrategy} style={{ cursor: "pointer" }}>
            <Icon name="sparkle" size={12}/> Strategy
          </span>
        </div>
        <div className="v num" style={{ color: "var(--primary)" }}>{fmt(totalInJars)}</div>
        <div className="stat-sub">
          <span style={{ color: "var(--success)", fontWeight: 600 }}>100%</span> distributed
        </div>
      </div>
    </div>
  );
};

const TransactionsTable = ({ tx, jars, onAddExpense }) => {
  const jarById = aUseMemo(() => Object.fromEntries(jars.map((j) => [j.id, j])), [jars]);
  return (
    <div className="card tx-card">
      <div className="tx-head">
        <h3>Recent Transactions</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={onAddExpense}>
            <Icon name="plus" size={12}/> Add expense
          </button>
          <button className="tx-link">View All</button>
        </div>
      </div>
      {tx.length === 0 ? (
        <div className="tx-empty">
          <Icon name="receipt" size={28}/>
          <div>No transactions yet</div>
        </div>
      ) : (
        <table className="tx">
          <thead><tr><th>Date</th><th>Description</th><th>Jar</th><th>Type</th><th>Amount</th></tr></thead>
          <tbody>
            {tx.slice(0, 7).map((t) => {
              const j = t.jarId ? jarById[t.jarId] : null;
              return (
                <tr key={t.id}>
                  <td style={{ color: "var(--ink-3)" }}>{t.date}</td>
                  <td style={{ color: "var(--ink)", fontWeight: 500 }}>{t.desc}</td>
                  <td>
                    {j ? (
                      <span className="tx-jar">
                        <span className="dotc" style={{ background: j.color }}/> {j.name}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-3)" }}>All Jars</span>
                    )}
                  </td>
                  <td>
                    <span className={"tx-type " + t.type}>{t.type === "expense" ? "Expense" : "Income"}</span>
                  </td>
                  <td className={"tx-amount num " + (t.type === "expense" ? "neg" : "pos")}>
                    {t.type === "expense" ? "−" : "+"}{fmt(t.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

const EmptyState = ({ onLogIncome }) => (
  <div className="empty-state">
    <div className="empty-illustration">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <path d="M14 18h36l-3 6v28a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4V24l-3-6z"
          fill="#dcdaff" stroke="#5b4ef0" strokeWidth="2"/>
        <path d="M22 18v-3a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3" stroke="#5b4ef0" strokeWidth="2" fill="none"/>
        <path d="M17 36h30" stroke="#5b4ef0" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="26" cy="44" r="2.5" fill="#5b4ef0"/>
        <circle cx="38" cy="44" r="2.5" fill="#5b4ef0" opacity=".6"/>
        <path d="M32 6v4M28 8l4 4 4-4" stroke="#5b4ef0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
    <h3>Your jars are empty</h3>
    <p>Log your first income to start distributing across your six jars. We'll handle the math.</p>
    <button className="btn btn-primary" onClick={onLogIncome} style={{ padding: "11px 18px", fontSize: 14 }}>
      <Icon name="plus" size={14}/> Log Income
    </button>
  </div>
);

const TipBanner = ({ onDismiss }) => (
  <div className="tip">
    <div className="tip-i"><Icon name="shield" size={18}/></div>
    <div className="tip-text">
      <b>Tip:</b> Log your income regularly to keep your jars balanced and stay on track with your goals.
    </div>
    <div className="tip-actions">
      <button className="btn btn-secondary" style={{ padding: "7px 14px", fontSize: 12.5 }}>Learn More</button>
      <button className="tip-x" onClick={onDismiss}><Icon name="x" size={14}/></button>
    </div>
  </div>
);

// ── JARS PAGE ───────────────────────────────────────────────────────────────
const JarsPage = (props) => {
  const {
    jars, tx, income, strategy, hasIncome, totalInJars,
    tweak, setTweak, tipDismissed, setTipDismissed,
    onOpenLogIncome, onOpenStrategy, onOpenAddJarExp,
  } = props;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Econome (Jars)</h1>
          <p>Manage your money using the 6-jar system.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={onOpenLogIncome}>
            <Icon name="plus" size={14}/> Log Income
          </button>
          <button className="btn btn-secondary" onClick={onOpenStrategy}>
            <Icon name="edit" size={14}/> Manage Strategy
          </button>
        </div>
      </div>

      {!hasIncome ? (
        <EmptyState onLogIncome={onOpenLogIncome}/>
      ) : (
        <React.Fragment>
          <StatsRow income={income} hasIncome={hasIncome} totalInJars={totalInJars} jars={jars} onOpenStrategy={onOpenStrategy}/>

          <div className="section">
            <div className="section-head">
              <h2>Your Jars</h2>
              <div className="meta">
                Strategy: <b>{PRESETS.find((p) => p.id === strategy)?.name || "Custom"}</b> · 6 Jars
              </div>
            </div>
            <JarsView style={tweak.vizStyle} jars={jars} totals={{ income }} onJarClick={() => {}}/>
          </div>

          <div className="lower">
            <TransactionsTable tx={tx} jars={jars} onAddExpense={onOpenAddJarExp}/>
            {tweak.showDonut && <DistributionDonut jars={jars} total={totalInJars}/>}
          </div>

          {!tipDismissed && <TipBanner onDismiss={() => setTipDismissed(true)}/>}
        </React.Fragment>
      )}
    </>
  );
};

// ── MAIN APP ────────────────────────────────────────────────────────────────
function App() {
  const [tweak, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Jars state
  const [jars, setJars] = aUseState(INITIAL_JARS);
  const [tx, setTx] = aUseState(INITIAL_TX);
  const [income, setIncome] = aUseState(INITIAL_INCOME);
  const [strategy, setStrategy] = aUseState("default");
  const [empty, setEmpty] = aUseState(false);

  // Expense, group, friend state
  const [expenses, setExpenses] = aUseState(EXPENSES);
  const [groups, setGroups] = aUseState(GROUPS);
  const [friends, setFriends] = aUseState(FRIENDS_INIT);

  // Modals
  const [showLogIncome, setShowLogIncome] = aUseState(false);
  const [showStrategy, setShowStrategy] = aUseState(false);
  const [showAddJarExp, setShowAddJarExp] = aUseState(false);
  const [celebrate, setCelebrate] = aUseState(null);

  const [showAddExp, setShowAddExp] = aUseState(false);
  const [showCreateGroup, setShowCreateGroup] = aUseState(false);
  const [showAddFriend, setShowAddFriend] = aUseState(false);

  // UI
  const [tipDismissed, setTipDismissed] = aUseState(false);
  const [navActive, setNavActive] = aUseState("expenses");
  const [toast, setToast] = aUseState(null);

  const hasIncome = !empty && income > 0;
  const totalInJars = hasIncome ? income : 0;

  // Toast helper
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  // ─── jar handlers ─────
  const handleLogIncome = (amount, label) => {
    setJars((js) =>
      js.map((j) => {
        const share = amount * (j.pct / 100);
        if (j.kind === "save") return { ...j, saved: j.saved + share };
        return j;
      })
    );
    setIncome((i) => i + amount);
    setTx((prev) => [
      { id: Date.now(), date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        desc: label || "Income", jarId: null, type: "income", amount },
      ...prev,
    ]);
    setEmpty(false);
    setShowLogIncome(false);
    showToast("Income logged · " + fmt(amount));
  };

  const handleSaveStrategy = (pcts, presetId) => {
    setJars((js) => js.map((j) => ({ ...j, pct: pcts[j.id] })));
    setStrategy(presetId);
    setShowStrategy(false);
    showToast("Strategy saved");
  };

  const handleAddJarExpense = ({ amount, label, jarId }) => {
    setJars((js) =>
      js.map((j) =>
        j.id === jarId
          ? j.kind === "save"
            ? { ...j, saved: Math.max(0, j.saved - amount) }
            : { ...j, spent: j.spent + amount }
          : j
      )
    );
    setTx((prev) => [
      { id: Date.now(), date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        desc: label, jarId, type: "expense", amount },
      ...prev,
    ]);
    setShowAddJarExp(false);
  };

  aUseEffect(() => {
    for (const j of jars) {
      const tot = income * (j.pct / 100);
      const used = j.spent + j.saved;
      const usage = tot ? used / tot : 0;
      if (j.kind === "save" && usage >= 1 && !j._celebrated && tot > 0) {
        setCelebrate({ jar: j, amount: used });
        setJars((js) => js.map((x) => (x.id === j.id ? { ...x, _celebrated: true } : x)));
        break;
      }
    }
  }, [jars, income]);

  // ─── full-app handlers ──
  const handleAddExpense = (exp) => {
    setExpenses((s) => [exp, ...s]);
    // bump group total
    setGroups((gs) => gs.map((g) => g.id === exp.groupId ? { ...g, total: g.total + exp.amount, updated: "just now" } : g));
    setShowAddExp(false);
    showToast("Expense added · " + fmt(exp.amount));
  };

  const handleCreateGroup = (group) => {
    setGroups((s) => [group, ...s]);
    setShowCreateGroup(false);
    showToast("Group created · " + group.name);
  };

  const handleAddFriends = (ids) => {
    if (ids.length) {
      setFriends((s) => [
        ...ids.map((pid) => ({ personId: pid, status: "sent", balance: 0, mutuals: 5, requestAt: "just now" })),
        ...s,
      ]);
      showToast(ids.length + " friend request" + (ids.length > 1 ? "s" : "") + " sent");
    }
    setShowAddFriend(false);
  };

  const handleSettle = (personId) => {
    setFriends((s) => s.map((f) => f.personId === personId ? { ...f, balance: 0 } : f));
    showToast("Settled up with " + personById(personId).name);
  };

  // ─── tweaks: demo actions ──
  const triggerEmpty = () => {
    setEmpty(true);
    setJars(INITIAL_JARS.map((j) => ({ ...j, spent: 0, saved: 0, _celebrated: false })));
    setTx([]);
    setIncome(0);
    setNavActive("jars");
  };
  const triggerCelebrate = () => {
    setNavActive("jars");
    setJars((js) =>
      js.map((j) =>
        j.id === "savings" ? { ...j, saved: income * (j.pct / 100), _celebrated: false } : j
      )
    );
  };
  const reset = () => {
    setJars(INITIAL_JARS);
    setTx(INITIAL_TX);
    setIncome(INITIAL_INCOME);
    setStrategy("default");
    setEmpty(false);
    setCelebrate(null);
    setTipDismissed(false);
    setExpenses(EXPENSES);
    setGroups(GROUPS);
    setFriends(FRIENDS_INIT);
  };

  // ─── routing ──
  const renderPage = () => {
    switch (navActive) {
      case "jars":
        return <JarsPage
          jars={jars} tx={tx} income={income} strategy={strategy}
          hasIncome={hasIncome} totalInJars={totalInJars}
          tweak={tweak} setTweak={setTweak}
          tipDismissed={tipDismissed} setTipDismissed={setTipDismissed}
          onOpenLogIncome={() => setShowLogIncome(true)}
          onOpenStrategy={() => setShowStrategy(true)}
          onOpenAddJarExp={() => setShowAddJarExp(true)}
        />;
      case "expenses":
        return <ExpensesPage expenses={expenses} onAddExpense={() => setShowAddExp(true)}/>;
      case "groups":
        return <GroupsPage groups={groups} onCreateGroup={() => setShowCreateGroup(true)}/>;
      case "friends":
        return <FriendsPage friends={friends} onAddFriend={() => setShowAddFriend(true)} onSettle={handleSettle}/>;
      default:
        return <ComingSoon title={navActive[0].toUpperCase() + navActive.slice(1)}/>;
    }
  };

  return (
    <div className="app" style={{ "--primary": tweak.accent }}>
      <Sidebar active={navActive} onNav={setNavActive} dark={tweak.dark} onToggleDark={() => setTweak("dark", !tweak.dark)}/>
      <div className="main">
        <Topbar placeholder={
          navActive === "groups" ? "Search groups, members..." :
          navActive === "friends" ? "Search friends by name or email..." :
          "Search anything..."
        }/>
        <div className="page">{renderPage()}</div>
      </div>

      {/* Modals */}
      {showLogIncome && (
        <LogIncomeModal jars={jars} onClose={() => setShowLogIncome(false)} onLog={handleLogIncome}/>
      )}
      {showStrategy && (
        <ManageStrategyModal jars={jars} income={income || INITIAL_INCOME}
          currentStrategy={strategy} onClose={() => setShowStrategy(false)} onSave={handleSaveStrategy}/>
      )}
      {showAddJarExp && (
        <AddExpenseModal jars={jars} onClose={() => setShowAddJarExp(false)} onAdd={handleAddJarExpense}/>
      )}
      {celebrate && (
        <CelebrateOverlay jar={celebrate.jar} amount={celebrate.amount} onClose={() => setCelebrate(null)}/>
      )}
      {showAddExp && (
        <AddExpenseFullModal onClose={() => setShowAddExp(false)} onSubmit={handleAddExpense}/>
      )}
      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} onSubmit={handleCreateGroup}/>
      )}
      {showAddFriend && (
        <AddFriendModal existingFriends={friends} onClose={() => setShowAddFriend(false)} onAdd={handleAddFriends}/>
      )}

      {/* Toast */}
      {toast && <Toast msg={toast}/>}

      <TweaksPanel>
        <TweakSection label="Jar Visualization"/>
        <TweakSelect
          label="Style"
          value={tweak.vizStyle}
          options={[
            { value: "cards", label: "Cards (default)" },
            { value: "stacked", label: "Stacked bar" },
            { value: "illustrated", label: "Illustrated jars" },
            { value: "treemap", label: "Treemap" },
          ]}
          onChange={(v) => setTweak("vizStyle", v)}
        />
        <TweakToggle label="Show donut chart" value={tweak.showDonut} onChange={(v) => setTweak("showDonut", v)}/>
        <TweakColor
          label="Accent color"
          value={tweak.accent}
          options={["#5b4ef0", "#10b981", "#f97316", "#ec4899", "#0ea5e9"]}
          onChange={(v) => setTweak("accent", v)}
        />
        <TweakSection label="Demo states"/>
        <TweakButton label="Empty jars state" onClick={triggerEmpty}/>
        <TweakButton label="Celebrate goal 🎉" onClick={triggerCelebrate}/>
        <TweakButton label="Reset data" onClick={reset}/>
      </TweaksPanel>
    </div>
  );
}

const Toast = ({ msg }) => (
  <div style={{
    position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
    background: "var(--ink)", color: "white", padding: "10px 18px", borderRadius: 999,
    fontSize: 13, fontWeight: 500, boxShadow: "0 8px 32px rgba(0,0,0,.18)", zIndex: 200,
    display: "inline-flex", alignItems: "center", gap: 8, animation: "fade .18s ease",
  }}>
    <Icon name="check" size={14} style={{ color: "var(--success)" }}/> {msg}
  </div>
);

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
