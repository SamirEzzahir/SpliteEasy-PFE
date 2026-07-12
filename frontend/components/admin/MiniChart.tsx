"use client";
// components/admin/MiniChart.tsx — dependency-free inline-SVG bar chart for the
// admin dashboard. Mirrors the approach of components/expenses/CategoryDonut.tsx
// (hand-drawn SVG) so we don't pull in a charting library.

interface Point { label: string; value: number; }

interface Props {
  data: Point[];
  color?: string;
  height?: number;
}

export default function MiniChart({ data, color = "var(--primary)", height = 120 }: Props) {
  const W = 100; // viewBox units (scales to container width)
  const H = 40;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length || 1;
  const gap = 1.2;
  const barW = (W - gap * (n - 1)) / n;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height }} role="img" aria-label="Trend chart">
        {data.map((d, i) => {
          const h = (d.value / max) * (H - 2);
          const x = i * (barW + gap);
          const y = H - h;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 0.4)}
              rx={0.6}
              fill={color}
              opacity={d.value === 0 ? 0.18 : 0.85}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10.5, color: "var(--ink-4)" }}>
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(n / 2)]?.label}</span>
        <span>{data[n - 1]?.label}</span>
      </div>
    </div>
  );
}
