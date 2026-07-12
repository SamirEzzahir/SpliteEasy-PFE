"use client";
// components/jars/DistributionDonut.tsx

import { arc, fmt0 } from "@/lib/format";
import { buildDonutSegments } from "@/lib/jars";
import type { Jar } from "@/lib/types";

interface Props { jars: Jar[]; total: number; }

export default function DistributionDonut({ jars, total }: Props) {
  const segments = buildDonutSegments(jars);
  return (
    <div className="card donut-card">
      <h3>Jars Distribution</h3>
      <div className="donut-wrap">
        <div className="donut">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f2f6" strokeWidth="14" />
            {segments.map((s) => (
              <path
                key={s.id}
                d={arc(50, 50, 38, s.start, s.start + s.angle)}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
              />
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
              <div className="dotc" style={{ background: j.color }} />
              <span className="legend-name">
                {j.name} <span style={{ color: "var(--ink-4)" }}>({j.pct}%)</span>
              </span>
              <span className="legend-amt num">{fmt0((total * j.pct) / 100)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="donut-foot">100% of your income is distributed</div>
    </div>
  );
}
