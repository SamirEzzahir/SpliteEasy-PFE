"use client";
// components/jars/CardsView.tsx — default jar grid

import Icon from "@/components/Icon";
import { fmt } from "@/lib/format";
import type { Jar } from "@/lib/types";

interface Props {
  jars: Jar[];
  totals: { income: number };
  onJarClick?: (jar: Jar) => void;
}

export default function CardsView({ jars, totals, onJarClick }: Props) {
  return (
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
              <div className="jar-icon" style={{ background: j.soft, color: j.color }}>
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
                <div
                  className="jar-bar-fill"
                  style={{ width: usedPct + "%", background: j.color }}
                />
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
}
