"use client";
// components/tweaks/TweaksPanel.tsx — floating tweaks panel (vanilla; no host protocol)

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

export interface Tweaks {
  vizStyle: "cards" | "stacked" | "illustrated" | "treemap";
  showDonut: boolean;
  accent: string;
  dark: boolean;
}

export function useTweaks<T extends object>(defaults: T) {
  const [values, setValues] = useState<T>(defaults);
  const setTweak = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);
  return [values, setTweak] as const;
}

interface PanelProps {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  onTriggerEmpty: () => void;
  onTriggerCelebrate: () => void;
  onReset: () => void;
}

const ACCENTS = ["#5b4ef0", "#10b981", "#f97316", "#ec4899", "#0ea5e9"];

const VIZ_OPTS: { value: Tweaks["vizStyle"]; label: string }[] = [
  { value: "cards", label: "Cards" },
  { value: "stacked", label: "Stacked" },
  { value: "illustrated", label: "Illustrated" },
  { value: "treemap", label: "Treemap" },
];

export default function TweaksPanel({
  tweaks, setTweak, onTriggerEmpty, onTriggerCelebrate, onReset,
}: PanelProps) {
  const [open, setOpen] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 16, y: 16 });

  return (
    <>
      {/* Toggle */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open tweaks"
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 2147483646,
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(11,15,26,.92)",
            color: "white",
            border: 0,
            boxShadow: "0 8px 24px rgba(0,0,0,.18)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <Icon name="sparkle" size={18} />
        </button>
      )}

      {open && (
        <div
          ref={dragRef}
          style={{
            position: "fixed",
            right: offsetRef.current.x,
            bottom: offsetRef.current.y,
            zIndex: 2147483646,
            width: 280,
            maxHeight: "calc(100vh - 32px)",
            display: "flex",
            flexDirection: "column",
            background: "rgba(250,249,247,.96)",
            color: "#29261b",
            backdropFilter: "blur(24px) saturate(160%)",
            WebkitBackdropFilter: "blur(24px) saturate(160%)",
            border: ".5px solid rgba(255,255,255,.6)",
            borderRadius: 14,
            boxShadow: "0 1px 0 rgba(255,255,255,.5) inset, 0 12px 40px rgba(0,0,0,.18)",
            fontSize: 11.5,
            lineHeight: 1.4,
            fontFamily: "ui-sans-serif,system-ui,-apple-system,sans-serif",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 8px 10px 14px",
            }}
          >
            <b style={{ fontSize: 12, fontWeight: 600 }}>Tweaks</b>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close tweaks"
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: "transparent",
                border: 0,
                color: "rgba(41,38,27,.55)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ padding: "2px 14px 14px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
            <Section>Jar visualization</Section>
            <Row label="Style">
              <select
                value={tweaks.vizStyle}
                onChange={(e) => setTweak("vizStyle", e.target.value as Tweaks["vizStyle"])}
                style={fieldStyle}
              >
                {VIZ_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Row>
            <Toggle
              label="Show donut chart"
              value={tweaks.showDonut}
              onChange={(v) => setTweak("showDonut", v)}
            />
            <Row label="Accent color">
              <div style={{ display: "flex", gap: 6 }}>
                {ACCENTS.map((c) => {
                  const on = c === tweaks.accent;
                  return (
                    <button
                      key={c}
                      onClick={() => setTweak("accent", c)}
                      aria-label={c}
                      style={{
                        flex: 1,
                        height: 26,
                        borderRadius: 6,
                        border: 0,
                        background: c,
                        cursor: "pointer",
                        boxShadow: on
                          ? "0 0 0 1.5px rgba(0,0,0,.85)"
                          : "0 0 0 .5px rgba(0,0,0,.12)",
                      }}
                    />
                  );
                })}
              </div>
            </Row>

            <Section>Demo states</Section>
            <PanelButton label="Empty jars state" onClick={onTriggerEmpty} />
            <PanelButton label="Celebrate goal 🎉" onClick={onTriggerCelebrate} />
            <PanelButton label="Reset data" onClick={onReset} secondary />
          </div>
        </div>
      )}
    </>
  );
}

const fieldStyle: React.CSSProperties = {
  appearance: "none",
  width: "100%",
  height: 26,
  padding: "0 8px",
  border: ".5px solid rgba(0,0,0,.1)",
  borderRadius: 7,
  background: "rgba(255,255,255,.6)",
  color: "inherit",
  font: "inherit",
  outline: "none",
};

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color: "rgba(41,38,27,.45)",
        padding: "10px 0 0",
      }}
    >
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ color: "rgba(41,38,27,.72)", fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div style={{ color: "rgba(41,38,27,.72)", fontWeight: 500 }}>{label}</div>
      <button
        onClick={() => onChange(!value)}
        aria-checked={value}
        role="switch"
        style={{
          position: "relative",
          width: 32,
          height: 18,
          borderRadius: 999,
          background: value ? "#34c759" : "rgba(0,0,0,.15)",
          border: 0,
          padding: 0,
          cursor: "pointer",
          transition: "background .15s",
        }}
      >
        <i
          style={{
            position: "absolute",
            top: 2,
            left: 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 2px rgba(0,0,0,.25)",
            transform: value ? "translateX(14px)" : "none",
            transition: "transform .15s",
          }}
        />
      </button>
    </div>
  );
}

function PanelButton({
  label,
  onClick,
  secondary,
}: {
  label: string;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 26,
        padding: "0 12px",
        border: 0,
        borderRadius: 7,
        background: secondary ? "rgba(0,0,0,.06)" : "rgba(0,0,0,.78)",
        color: secondary ? "inherit" : "#fff",
        font: "inherit",
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
