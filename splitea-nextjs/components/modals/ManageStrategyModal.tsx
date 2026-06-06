"use client";
// components/modals/ManageStrategyModal.tsx

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { fmt } from "@/lib/format";
import { PRESETS } from "@/lib/jars";
import type { Jar, Preset } from "@/lib/types";

interface Props {
  jars: Jar[];
  income: number;
  currentStrategy: string;
  onClose: () => void;
  onSave: (pcts: Record<string, number>, presetId: string) => void;
}

export default function ManageStrategyModal({ jars, income, currentStrategy, onClose, onSave }: Props) {
  const [pcts, setPcts] = useState<Record<string, number>>(() =>
    Object.fromEntries(jars.map((j) => [j.id, j.pct])),
  );
  const [activePreset, setActivePreset] = useState(currentStrategy);

  const total = useMemo(() => Object.values(pcts).reduce((a, b) => a + b, 0), [pcts]);
  const valid = total === 100;

  const setPct = (id: string, v: number) => {
    const next = Math.max(0, Math.min(100, Math.round(v)));
    setPcts((p) => ({ ...p, [id]: next }));
    setActivePreset("custom");
  };

  const applyPreset = (preset: Preset) => {
    setPcts({ ...preset.pcts });
    setActivePreset(preset.id);
  };

  const save = () => valid && onSave(pcts, activePreset);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <h2>Manage Strategy</h2>
            <p>Customize your 6-jar money distribution.</p>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="modal-b">
          <div
            style={{
              marginBottom: 8,
              fontSize: 12,
              color: "var(--ink-3)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: ".05em",
            }}
          >
            Presets
          </div>
          <div className="preset-row">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                className={"preset" + (activePreset === p.id ? " active" : "")}
                onClick={() => applyPreset(p)}
              >
                <Icon name="sparkle" size={12} /> {p.name}
                <span style={{ opacity: 0.6, fontWeight: 500, marginLeft: 4 }}>· {p.desc}</span>
              </button>
            ))}
          </div>

          <div className={"alloc-banner" + (valid ? "" : " bad")}>
            <div className="alloc-row">
              <span className="lbl">Total Allocation</span>
              <span className={"alloc-pct" + (valid ? "" : " bad")}>{total}%</span>
            </div>
            <div className="alloc-bar">
              <div
                className={"alloc-bar-fill" + (valid ? "" : " bad")}
                style={{ width: Math.min(100, total) + "%" }}
              />
            </div>
            {!valid && (
              <div style={{ fontSize: 12, color: "var(--rose)", marginTop: 8, fontWeight: 500 }}>
                {total < 100
                  ? `Add ${100 - total}% more to allocate fully`
                  : `Reduce by ${total - 100}% to balance`}
              </div>
            )}
          </div>

          <table className="strat-table">
            <thead>
              <tr>
                <th>Jar</th>
                <th>Percentage</th>
                <th style={{ width: "30%" }} />
                <th>Amount (of {fmt(income)})</th>
              </tr>
            </thead>
            <tbody>
              {jars.map((j) => {
                const pct = pcts[j.id];
                const amt = (income * pct) / 100;
                return (
                  <tr key={j.id}>
                    <td>
                      <div className="strat-jar">
                        <div className="jar-icon" style={{ background: j.soft, color: j.color }}>
                          <Icon name={j.icon} size={16} />
                        </div>
                        <div>
                          <div className="nm">{j.name}</div>
                          <div className="ds">{j.desc}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="stepper">
                        <button
                          onClick={() => setPct(j.id, pct - 1)}
                          disabled={pct <= 0}
                          aria-label="Decrease"
                        >
                          <Icon name="minus" size={12} />
                        </button>
                        <input
                          type="number"
                          value={pct}
                          onChange={(e) => setPct(j.id, parseInt(e.target.value || "0", 10))}
                          aria-label={j.name + " percent"}
                        />
                        <button
                          onClick={() => setPct(j.id, pct + 1)}
                          disabled={pct >= 100}
                          aria-label="Increase"
                        >
                          <Icon name="plus" size={12} />
                        </button>
                      </div>
                      <span style={{ marginLeft: 6, fontSize: 13, color: "var(--ink-3)" }}>%</span>
                    </td>
                    <td>
                      <input
                        type="range"
                        className="slider"
                        min={0}
                        max={100}
                        value={pct}
                        onChange={(e) => setPct(j.id, parseInt(e.target.value, 10))}
                      />
                    </td>
                    <td>
                      <span className="strat-amt num">{fmt(amt)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="strat-note">
            <Icon name="info" size={14} />
            Changes apply to future income. Existing balances stay as they are.
          </div>
        </div>

        <div className="modal-f">
          <button className="btn btn-secondary" onClick={() => applyPreset(PRESETS[0])}>
            Reset to Default
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!valid}
              onClick={save}
              style={{ opacity: valid ? 1 : 0.5 }}
            >
              Save Strategy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
