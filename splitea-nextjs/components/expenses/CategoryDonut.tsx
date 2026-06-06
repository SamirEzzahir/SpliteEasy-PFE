"use client";
// components/expenses/CategoryDonut.tsx

import { arc, fmt0 } from "@/lib/format";
import type { Category } from "@/lib/types";

interface DataItem extends Category { amount: number; }
interface Props { data: DataItem[]; total: number; }

const GAP_DEG = 3; // degrees of blank space between each segment

export default function CategoryDonut({ data, total }: Props) {
  const hasGap = data.length > 1;
  let acc = 0;

  return (
    <>
      <svg width="120" height="120" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f2f6" strokeWidth="13" />
        {data.map((c) => {
          const angle = total ? (c.amount / total) * 360 : 0;
          const start = acc;
          acc += angle;

          // skip tiny slivers that are smaller than the gap
          if (angle <= GAP_DEG * 2) return null;

          const drawStart = start + (hasGap ? GAP_DEG / 2 : 0);
          const drawEnd = start + angle - (hasGap ? GAP_DEG / 2 : 0);

          return (
            <path
              key={c.id}
              d={arc(50, 50, 38, drawStart, drawEnd)}
              fill="none"
              stroke={c.color}
              strokeWidth="13"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="donut-center">
        <div>
          <div className="v num">{fmt0(total)}</div>
          <div className="l">Total</div>
        </div>
      </div>
    </>
  );
}
