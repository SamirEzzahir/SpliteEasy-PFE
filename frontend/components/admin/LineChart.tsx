"use client";
// components/admin/LineChart.tsx — dependency-free inline-SVG line chart with a
// soft area fill. Same hand-drawn approach as MiniChart / CategoryDonut.

interface Point { label: string; value: number; }

interface Props {
  data: Point[];
  color?: string;
  height?: number;
}

export default function LineChart({ data, color = "var(--primary)", height = 180 }: Props) {
  const W = 100;
  const H = 50;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.value));

  if (n === 0) {
    return <div style={{ height, display: "grid", placeItems: "center", color: "var(--ink-4)", fontSize: 12 }}>No data</div>;
  }

  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / max) * (H - 4) - 2;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(d.value).toFixed(2)}`).join(" ");
  const area = `${line} L ${x(n - 1).toFixed(2)} ${H} L ${x(0).toFixed(2)} ${H} Z`;
  const gid = `lc-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height }} role="img" aria-label="Line chart">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={0.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10.5, color: "var(--ink-4)" }}>
        <span>{data[0]?.label}</span>
        {n > 2 && <span>{data[Math.floor(n / 2)]?.label}</span>}
        <span>{data[n - 1]?.label}</span>
      </div>
    </div>
  );
}
