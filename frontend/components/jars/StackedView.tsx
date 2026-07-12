"use client";
// components/jars/StackedView.tsx

import Icon from "@/components/Icon";
import { fmt, fmt0 } from "@/lib/format";
import type { Jar } from "@/lib/types";

interface Props { jars: Jar[]; totals: { income: number }; }

export default function StackedView({ jars, totals }: Props) {
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
              <div className="jar-icon" style={{ background: j.soft, color: j.color }}>
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
}
