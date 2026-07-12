"use client";
// components/modals/CelebrateOverlay.tsx

import { useMemo } from "react";
import Icon from "@/components/Icon";
import { fmt } from "@/lib/format";
import type { Jar } from "@/lib/types";

const COLORS = ["#5b4ef0", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9", "#ec4899"];

interface Props { jar: Jar; amount: number; onClose: () => void; }

export default function CelebrateOverlay({ jar, amount, onClose }: Props) {
  const confetti = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.6 + Math.random() * 1.2,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
      })),
    [],
  );

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
          <Icon name={jar.icon} size={42} />
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            background: "var(--success-soft)",
            color: "#065f46",
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          <Icon name="trophy" size={12} /> GOAL REACHED
        </div>
        <h2>{jar.name} is full!</h2>
        <p>You&apos;ve filled your {jar.name.toLowerCase()} jar to 100%.</p>
        <div className="celebrate-amt num">{fmt(amount)}</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 22 }}>
          saved this period
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button className="btn btn-secondary" onClick={onClose}>Keep going</button>
          <button className="btn btn-primary" onClick={onClose}>
            <Icon name="sparkle" size={14} /> Celebrate
          </button>
        </div>
      </div>
    </div>
  );
}
