"use client";
// components/jars/HealthDonut.tsx

export default function HealthDonut({ value }: { value: number }) {
  const r = 23;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="health-donut">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#eef0f4" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--success)"
          strokeWidth="6"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <div className="health-num">{value}%</div>
    </div>
  );
}
