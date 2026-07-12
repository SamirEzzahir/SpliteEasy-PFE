"use client";
// components/Avatar.tsx — avatar with gradient by person id + stack helper

import { personById } from "@/lib/data";

interface AvatarProps {
  id: string;
  size?: "sm" | "md" | "lg" | "xl";
  style?: React.CSSProperties;
}

export function Avatar({ id, size = "md", style }: AvatarProps) {
  const p = personById(id);
  if (!p) return <div className={`av av-${size}`} style={style} />;
  const initials = p.name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
  return (
    <div
      className={`av av-${size}`}
      style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color2})`, ...style }}
    >
      {initials}
    </div>
  );
}

interface AvatarStackProps {
  ids: string[];
  max?: number;
  size?: "sm" | "md" | "lg" | "xl";
}

export function AvatarStack({ ids, max = 4, size = "sm" }: AvatarStackProps) {
  const shown = ids.slice(0, max);
  const extra = Math.max(0, ids.length - max);
  return (
    <div className="av-stack">
      {shown.map((id) => (
        <Avatar key={id} id={id} size={size} />
      ))}
      {extra > 0 && <div className="av-more">+{extra}</div>}
    </div>
  );
}
