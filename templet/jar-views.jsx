// jar-views.jsx — 4 visualization styles for the 6-jar allocation

const fmt = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => "$" + Math.round(n).toLocaleString("en-US");

// Colored background for jar icons — pastel tint version of accent color
const jarIconStyle = (color, soft) => ({
  background: soft, color: color,
});

// ── 1. CARDS (default, refined from screenshot) ─────────────────────────────
const CardsView = ({ jars, totals, onJarClick }) => (
  <div className="jar-grid">
    {jars.map((j) => {
      const totalForJar = (totals.income || 0) * (j.pct / 100);
      const used = j.spent + j.saved;
      const usedPct = totalForJar ? Math.min(100, (used / totalForJar) * 100) : 0;
      const left = totalForJar - used;
      const isComplete = j.kind === "save" && usedPct >= 99.5 && totalForJar > 0;
      return (
        <div key={j.id} className="jar-card" onClick={() => onJarClick?.(j)}>
          {isComplete && (
            <div className="goal-badge">
              <Icon name="check" size={10} /> Goal
            </div>
          )}
          <div className="jar-card-h">
            <div className="jar-icon" style={jarIconStyle(j.color, j.soft)}>
              <Icon name={j.icon} size={15} />
            </div>
            <div className="jar-pct">{j.pct}%</div>
          </div>
          <div>
            <div className="jar-name">{j.name}</div>
          </div>
          <div>
            <div className="jar-amount num">{fmt(totalForJar)}</div>
            <div className="jar-target num">of {fmt(totalForJar)}</div>
          </div>
          <div className="jar-bar-wrap">
            <span className="jar-progress-label num">{Math.round(usedPct)}%</span>
            <div className="jar-bar">
              <div className="jar-bar-fill" style={{ width: usedPct + "%", background: j.color }} />
            </div>
          </div>
          <div className="jar-foot">
            <div>
              <span className="lbl">{j.kind === "save" ? "Saved" : "Spent"}</span>
              <span className="val num">{fmt(used)}</span>
            </div>
            <div>
              <span className="lbl">Left</span>
              <span className="val num">{fmt(Math.max(0, left))}</span>
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

// ── 2. STACKED BAR ──────────────────────────────────────────────────────────
const StackedView = ({ jars, totals }) => {
  const totalIncome = totals.income || 0;
  return (
    <div className="card stacked-viz">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Distribution of</div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }} className="num">
            {fmt(totalIncome)}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-4)", alignSelf: "flex-end" }}>
          100% allocated · 6 jars
        </div>
      </div>
      <div className="stacked-bar">
        {jars.map((j) => (
          <div
            key={j.id}
            className="stacked-seg"
            style={{ width: j.pct + "%", background: j.color }}
            title={`${j.name}: ${j.pct}%`}
          >
            <div className="nm">{j.name}</div>
            <div className="pct num">{j.pct}%</div>
          </div>
        ))}
      </div>
      <div className="stacked-list">
        {jars.map((j) => {
          const tot = totalIncome * (j.pct / 100);
          const used = j.spent + j.saved;
          return (
            <div key={j.id} className="sl-row">
              <div className="jar-icon" style={jarIconStyle(j.color, j.soft)}>
                <Icon name={j.icon} size={17} />
              </div>
              <div className="body">
                <div className="nm">{j.name}</div>
                <div className="sub">{j.desc}</div>
              </div>
              <div>
                <div className="amt num">{fmt0(tot)}</div>
                <div className="left num">{fmt0(Math.max(0, tot - used))} left</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── 3. ILLUSTRATED JARS ─────────────────────────────────────────────────────
// SVG jar shape with animated liquid fill based on jar utilization
const IllustratedView = ({ jars, totals }) => {
  return (
    <div className="card">
      <div className="ill-grid">
        {jars.map((j) => {
          const tot = (totals.income || 0) * (j.pct / 100);
          const used = j.spent + j.saved;
          const fill = tot ? Math.min(1, used / tot) : 0;
          return (
            <div key={j.id} className="ill-cell">
              <JarSVG color={j.color} soft={j.soft} fill={fill} icon={j.icon} />
              <div className="ill-pct">{j.pct}%</div>
              <div className="ill-name">{j.name}</div>
              <div className="ill-amt num">{fmt0(tot)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const JarSVG = ({ color, soft, fill, icon }) => {
  // jar viewBox 100x120
  // body: x=12 y=28 → x=88 y=112, neck: x=24 y=14 → x=76 y=28
  const fillTop = 110 - 80 * fill; // top of liquid (y coord), bottom=110
  const clipId = "jclip-" + Math.random().toString(36).slice(2, 9);
  return (
    <svg viewBox="0 0 100 120" className="jar-svg">
      <defs>
        <clipPath id={clipId}>
          <path d="M 16 30 L 16 100 Q 16 112 28 112 L 72 112 Q 84 112 84 100 L 84 30 Z" />
        </clipPath>
        <linearGradient id={clipId + "-g"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.65" />
        </linearGradient>
      </defs>
      {/* lid */}
      <rect x="22" y="10" width="56" height="10" rx="3" fill={color} opacity="0.85" />
      <rect x="22" y="10" width="56" height="3" rx="1.5" fill="white" opacity="0.3" />
      {/* neck */}
      <path d="M 28 20 L 72 20 L 72 30 L 28 30 Z" fill={color} opacity="0.7" />
      {/* jar body outline */}
      <path
        d="M 16 30 L 16 100 Q 16 112 28 112 L 72 112 Q 84 112 84 100 L 84 30 Z"
        fill={soft}
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      {/* liquid */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          x="0"
          y={fillTop}
          width="100"
          height={120 - fillTop}
          fill={`url(#${clipId}-g)`}
          style={{ transition: "y .6s cubic-bezier(.2,.7,.2,1)" }}
        />
        {/* surface wave */}
        <ellipse cx="50" cy={fillTop} rx="34" ry="2" fill="white" opacity="0.35" />
      </g>
      {/* highlight */}
      <path d="M 22 38 L 22 90" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      {/* icon overlay at bottom */}
      <foreignObject x="36" y="76" width="28" height="28">
        <div style={{ width: 28, height: 28, display: "grid", placeItems: "center", color: "white", opacity: 0.9 }}>
          <Icon name={icon} size={16} />
        </div>
      </foreignObject>
    </svg>
  );
};

// ── 4. TREEMAP ──────────────────────────────────────────────────────────────
// Fixed layout: largest jar (55%) takes left half; remaining 5 fill the right grid
const TREEMAP_AREAS = ["a", "b", "c", "d", "e", "f"];
const TreemapView = ({ jars, totals }) => {
  const income = totals.income || 0;
  // Sort by pct so biggest gets area "a"
  const sorted = [...jars].sort((a, b) => b.pct - a.pct);
  return (
    <div className="card">
      <div className="treemap">
        {sorted.slice(0, 5).map((j, i) => {
          const tot = income * (j.pct / 100);
          const used = j.spent + j.saved;
          const left = Math.max(0, tot - used);
          const area = TREEMAP_AREAS[i];
          return (
            <div key={j.id} className="tm-cell" style={{ gridArea: area, background: j.color }}>
              <div className="top">
                <div className="nm">{j.name}</div>
                <div className="pct num">{j.pct}%</div>
              </div>
              <div>
                <div className="v num">{fmt0(tot)}</div>
                <div className="sub num">{fmt0(left)} left</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── dispatcher ──────────────────────────────────────────────────────────────
const JarsView = ({ style, ...rest }) => {
  if (style === "stacked") return <StackedView {...rest} />;
  if (style === "illustrated") return <IllustratedView {...rest} />;
  if (style === "treemap") return <TreemapView {...rest} />;
  return <CardsView {...rest} />;
};

Object.assign(window, { JarsView, CardsView, StackedView, IllustratedView, TreemapView, fmt, fmt0 });
