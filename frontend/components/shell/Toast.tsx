"use client";
// components/shell/Toast.tsx

import Icon from "@/components/Icon";

export default function Toast({ msg }: { msg: string }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--ink)",
        color: "white",
        padding: "10px 18px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 500,
        boxShadow: "0 8px 32px rgba(0,0,0,.18)",
        zIndex: 200,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        animation: "fade .18s ease",
      }}
    >
      <Icon name="check" size={14} style={{ color: "var(--success)" }} /> {msg}
    </div>
  );
}
