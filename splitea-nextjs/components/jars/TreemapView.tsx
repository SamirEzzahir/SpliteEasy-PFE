"use client";
// components/jars/TreemapView.tsx

import { fmt0 } from "@/lib/format";
import type { Jar } from "@/lib/types";

const AREAS = ["a", "b", "c", "d", "e", "f"];

interface Props { jars: Jar[]; totals: { income: number }; }

export default function TreemapView({ jars, totals }: Props) {
  const income = totals.income || 0;
  const sorted = [...jars].sort((a, b) => b.pct - a.pct);
  return (
    <div className="card">
      <div className="treemap">
        {sorted.slice(0, 5).map((j, i) => {
          const tot = income * (j.pct / 100);
          const used = j.spent + j.saved;
          const left = Math.max(0, tot - used);
          const area = AREAS[i];
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
}
