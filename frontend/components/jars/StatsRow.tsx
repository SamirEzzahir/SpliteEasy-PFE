"use client";
// components/jars/StatsRow.tsx

import { useMemo } from "react";
import Icon from "@/components/Icon";
import HealthDonut from "./HealthDonut";
import { fmt } from "@/lib/format";
import type { Jar } from "@/lib/types";

interface Props {
  income: number;
  hasIncome: boolean;
  totalInJars: number;
  jars: Jar[];
  onOpenStrategy: () => void;
}

export default function StatsRow({ income, hasIncome, totalInJars, jars, onOpenStrategy }: Props) {
  const health = useMemo(() => {
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
          <span className="pill">
            <Icon name="chev" size={12} /> This Month
          </span>
        </div>
        <div className="v num">{fmt(income)}</div>
        <div className="stat-sub">
          <Icon name="info" size={13} /> Auto-distributed across 6 jars
        </div>
      </div>
      <div className="card stat">
        <div className="stat-h">
          <span>Overall Health</span>
          <span className="pill pill-success">
            {health >= 70 ? "Good" : health >= 40 ? "Fair" : "Watch"}
          </span>
        </div>
        <div className="health-wrap">
          <HealthDonut value={health} />
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
            <Icon name="sparkle" size={12} /> Strategy
          </span>
        </div>
        <div className="v num" style={{ color: "var(--primary)" }}>{fmt(totalInJars)}</div>
        <div className="stat-sub">
          <span style={{ color: "var(--success)", fontWeight: 600 }}>100%</span> distributed
        </div>
      </div>
    </div>
  );
}
