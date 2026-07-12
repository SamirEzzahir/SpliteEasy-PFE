"use client";
// components/jars/IllustratedView.tsx — SVG jar with liquid fill

import { useId } from "react";
import Icon from "@/components/Icon";
import { fmt0 } from "@/lib/format";
import type { Jar } from "@/lib/types";

interface JarSVGProps { color: string; soft: string; fill: number; icon: string; }

function JarSVG({ color, soft, fill, icon }: JarSVGProps) {
  const id = useId().replace(/[:]/g, "");
  const clipId = "jclip-" + id;
  const fillTop = 110 - 80 * fill;
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
      <rect x="22" y="10" width="56" height="10" rx="3" fill={color} opacity="0.85" />
      <rect x="22" y="10" width="56" height="3" rx="1.5" fill="white" opacity="0.3" />
      <path d="M 28 20 L 72 20 L 72 30 L 28 30 Z" fill={color} opacity="0.7" />
      <path
        d="M 16 30 L 16 100 Q 16 112 28 112 L 72 112 Q 84 112 84 100 L 84 30 Z"
        fill={soft}
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <g clipPath={`url(#${clipId})`}>
        <rect
          x="0"
          y={fillTop}
          width="100"
          height={120 - fillTop}
          fill={`url(#${clipId}-g)`}
          style={{ transition: "y .6s cubic-bezier(.2,.7,.2,1)" }}
        />
        <ellipse cx="50" cy={fillTop} rx="34" ry="2" fill="white" opacity="0.35" />
      </g>
      <path d="M 22 38 L 22 90" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      <foreignObject x="36" y="76" width="28" height="28">
        <div style={{ width: 28, height: 28, display: "grid", placeItems: "center", color: "white", opacity: 0.9 }}>
          <Icon name={icon} size={16} />
        </div>
      </foreignObject>
    </svg>
  );
}

interface Props { jars: Jar[]; totals: { income: number }; }

export default function IllustratedView({ jars, totals }: Props) {
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
}
