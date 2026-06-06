// modals.jsx — Log Income, Manage Strategy, Goal Completed

const { useState, useEffect, useMemo, useRef } = React;

// ── STRATEGY PRESETS ─────────────────────────────────────────────────────────
const PRESETS = [
  { id: "default", name: "6-Jar Default", desc: "T. Harv Eker's classic",
    pcts: { necessities: 55, financial: 10, savings: 10, education: 10, play: 10, give: 5 } },
  { id: "503020", name: "50/30/20", desc: "Needs · Wants · Save",
    pcts: { necessities: 50, financial: 10, savings: 10, education: 5, play: 20, give: 5 } },
  { id: "aggressive", name: "Aggressive Save", desc: "Heavy into FI",
    pcts: { necessities: 40, financial: 25, savings: 20, education: 5, play: 5, give: 5 } },
  { id: "balanced", name: "Balanced Growth", desc: "Education-forward",
    pcts: { necessities: 45, financial: 15, savings: 10, education: 15, play: 10, give: 5 } },
];

// ─────────────────────────────────────────────────────────────────────────────
// LOG INCOME
// ─────────────────────────────────────────────────────────────────────────────
const LogIncomeModal = ({ jars, onClose, onLog }) => {
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("Salary " + new Date().toLocaleString("en-US", { month: "long", year: "numeric" }));
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const num = parseFloat(amount) || 0;
  const valid = num > 0;

  const submit = () => {
    if (!valid) return;
    onLog(num, label);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <h2>Log Income</h2>
            <p>Auto-distribute across your 6 jars.</p>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close"><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-b">
          <div className="li-amount">
            <span className="li-currency">$</span>
            <input
              ref={inputRef}
              className="li-input num"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div className="li-quick">
            {[1000, 2500, 5000, 7500].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))}>${v.toLocaleString()}</button>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="field">
              <label>Description</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. May Paycheck" />
            </div>
          </div>

          {valid && (
            <div className="li-preview">
              <h4>Will distribute to</h4>
              {jars.map((j) => (
                <div className="li-prev-row" key={j.id}>
                  <div className="jar-icon" style={{ background: j.soft, color: j.color }}>
                    <Icon name={j.icon} size={12} />
                  </div>
                  <span className="nm">{j.name}</span>
                  <span className="pct num">{j.pct}%</span>
                  <span className="amt num">+{fmt(num * j.pct / 100)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!valid} onClick={submit} style={{ opacity: valid ? 1 : 0.5 }}>
            <Icon name="check" size={14}/> Log {valid ? fmt(num) : "income"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MANAGE STRATEGY
// ─────────────────────────────────────────────────────────────────────────────
const ManageStrategyModal = ({ jars, income, currentStrategy, onClose, onSave }) => {
  // local mutable pcts keyed by jar id
  const [pcts, setPcts] = useState(() => Object.fromEntries(jars.map((j) => [j.id, j.pct])));
  const [activePreset, setActivePreset] = useState(currentStrategy);

  const total = useMemo(() => Object.values(pcts).reduce((a, b) => a + b, 0), [pcts]);
  const valid = total === 100;

  const setPct = (id, v) => {
    const next = Math.max(0, Math.min(100, Math.round(v)));
    setPcts((p) => ({ ...p, [id]: next }));
    setActivePreset("custom");
  };

  const applyPreset = (preset) => {
    setPcts({ ...preset.pcts });
    setActivePreset(preset.id);
  };

  const resetDefault = () => applyPreset(PRESETS[0]);

  const save = () => {
    if (!valid) return;
    onSave(pcts, activePreset);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <h2>Manage Strategy</h2>
            <p>Customize your 6-jar money distribution.</p>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close"><Icon name="x" size={16}/></button>
        </div>

        <div className="modal-b">
          {/* Presets */}
          <div style={{ marginBottom: 8, fontSize: 12, color: "var(--ink-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Presets
          </div>
          <div className="preset-row">
            {PRESETS.map((p) => (
              <button key={p.id} className={"preset" + (activePreset === p.id ? " active" : "")} onClick={() => applyPreset(p)}>
                <Icon name="sparkle" size={12}/> {p.name}
                <span style={{ opacity: .6, fontWeight: 500, marginLeft: 4 }}>· {p.desc}</span>
              </button>
            ))}
          </div>

          {/* Total allocation banner */}
          <div className={"alloc-banner" + (valid ? "" : " bad")}>
            <div className="alloc-row">
              <span className="lbl">Total Allocation</span>
              <span className={"alloc-pct" + (valid ? "" : " bad")}>{total}%</span>
            </div>
            <div className="alloc-bar">
              <div className={"alloc-bar-fill" + (valid ? "" : " bad")} style={{ width: Math.min(100, total) + "%" }} />
            </div>
            {!valid && (
              <div style={{ fontSize: 12, color: "var(--rose)", marginTop: 8, fontWeight: 500 }}>
                {total < 100 ? `Add ${100 - total}% more to allocate fully` : `Reduce by ${total - 100}% to balance`}
              </div>
            )}
          </div>

          <table className="strat-table">
            <thead>
              <tr>
                <th>Jar</th>
                <th>Percentage</th>
                <th style={{ width: "30%" }}></th>
                <th>Amount (of {fmt(income)})</th>
              </tr>
            </thead>
            <tbody>
              {jars.map((j) => {
                const pct = pcts[j.id];
                const amt = (income * pct) / 100;
                return (
                  <tr key={j.id}>
                    <td>
                      <div className="strat-jar">
                        <div className="jar-icon" style={{ background: j.soft, color: j.color }}>
                          <Icon name={j.icon} size={16}/>
                        </div>
                        <div>
                          <div className="nm">{j.name}</div>
                          <div className="ds">{j.desc}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="stepper">
                        <button onClick={() => setPct(j.id, pct - 1)} disabled={pct <= 0} aria-label="Decrease">
                          <Icon name="minus" size={12}/>
                        </button>
                        <input
                          type="number"
                          value={pct}
                          onChange={(e) => setPct(j.id, parseInt(e.target.value || "0", 10))}
                          aria-label={j.name + " percent"}
                        />
                        <button onClick={() => setPct(j.id, pct + 1)} disabled={pct >= 100} aria-label="Increase">
                          <Icon name="plus" size={12}/>
                        </button>
                      </div>
                      <span style={{ marginLeft: 6, fontSize: 13, color: "var(--ink-3)" }}>%</span>
                    </td>
                    <td>
                      <input
                        type="range"
                        className="slider"
                        min={0}
                        max={100}
                        value={pct}
                        onChange={(e) => setPct(j.id, parseInt(e.target.value, 10))}
                      />
                    </td>
                    <td>
                      <span className="strat-amt num">{fmt(amt)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="strat-note">
            <Icon name="info" size={14}/>
            Changes apply to future income. Existing balances stay as they are.
          </div>
        </div>

        <div className="modal-f">
          <button className="btn btn-secondary" onClick={resetDefault}>
            Reset to Default
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!valid} onClick={save} style={{ opacity: valid ? 1 : 0.5 }}>
              Save Strategy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD EXPENSE
// ─────────────────────────────────────────────────────────────────────────────
const AddExpenseModal = ({ jars, onClose, onAdd }) => {
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [jarId, setJarId] = useState(jars[0].id);
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);
  const num = parseFloat(amount) || 0;
  const valid = num > 0 && label.trim();

  const submit = () => {
    if (!valid) return;
    onAdd({ amount: num, label: label.trim(), jarId });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <h2>Add Expense</h2>
            <p>Pull from one of your jars.</p>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-b">
          <div className="field">
            <label>Description</label>
            <input ref={inputRef} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Grocery shopping" />
          </div>
          <div className="row-2">
            <div className="field">
              <label>Amount</label>
              <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="field">
              <label>Date</label>
              <input type="text" value={new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} readOnly />
            </div>
          </div>
          <div className="field">
            <label>From jar</label>
            <div className="jar-select">
              {jars.map((j) => (
                <button key={j.id} className={"jar-pick" + (jarId === j.id ? " active" : "")} onClick={() => setJarId(j.id)}>
                  <div className="jar-icon" style={{ background: j.soft, color: j.color }}>
                    <Icon name={j.icon} size={13}/>
                  </div>
                  <span className="nm">{j.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!valid} onClick={submit} style={{ opacity: valid ? 1 : 0.5 }}>
            <Icon name="check" size={14}/> Add expense
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GOAL COMPLETED CELEBRATION
// ─────────────────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ["#5b4ef0", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9", "#ec4899"];

const CelebrateOverlay = ({ jar, amount, onClose }) => {
  const confetti = useMemo(() => {
    return Array.from({ length: 36 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.6 + Math.random() * 1.2,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.random() * 360,
    }));
  }, []);

  return (
    <div className="celebrate" onClick={onClose}>
      <div className="celebrate-card" onClick={(e) => e.stopPropagation()}>
        {confetti.map((c, i) => (
          <div
            key={i}
            className="confetti"
            style={{
              left: c.left + "%",
              background: c.color,
              transform: `rotate(${c.rotate}deg)`,
              animation: `confetti ${c.duration}s ${c.delay}s linear forwards`,
            }}
          />
        ))}
        <div className="celebrate-jar" style={{ background: jar.soft, color: jar.color }}>
          <Icon name={jar.icon} size={42}/>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--success-soft)", color: "#065f46", borderRadius: 99, fontSize: 11, fontWeight: 600, marginBottom: 10 }}>
          <Icon name="trophy" size={12}/> GOAL REACHED
        </div>
        <h2>{jar.name} is full!</h2>
        <p>You've filled your {jar.name.toLowerCase()} jar to 100%.</p>
        <div className="celebrate-amt num">{fmt(amount)}</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 22 }}>saved this period</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button className="btn btn-secondary" onClick={onClose}>Keep going</button>
          <button className="btn btn-primary" onClick={onClose}><Icon name="sparkle" size={14}/> Celebrate</button>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { LogIncomeModal, ManageStrategyModal, AddExpenseModal, CelebrateOverlay, PRESETS });
