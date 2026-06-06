"use client";
// components/modals/LogIncomeModal.tsx

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { fmt } from "@/lib/format";
import type { Jar } from "@/lib/types";

interface Props {
  jars: Jar[];
  onClose: () => void;
  onLog: (amount: number, label: string) => void;
}

export default function LogIncomeModal({ jars, onClose, onLog }: Props) {
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState(
    "Salary " + new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const num = parseFloat(amount) || 0;
  const valid = num > 0;
  const submit = () => valid && onLog(num, label);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <h2>Log Income</h2>
            <p>Auto-distribute across your 6 jars.</p>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-b">
          <div className="li-amount">
            <span className="li-currency">$</span>
            <input
              ref={inputRef}
              className="li-input num"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div className="li-quick">
            {[1000, 2500, 5000, 7500].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))}>
                ${v.toLocaleString()}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="field">
              <label>Description</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. May Paycheck" />
            </div>
          </div>

          {valid && (
            <div className="li-preview">
              <h4>Will distribute to</h4>
              {jars.map((j) => (
                <div className="li-prev-row" key={j.id}>
                  <div className="jar-icon" style={{ background: j.soft, color: j.color }}>
                    <Icon name={j.icon} size={12} />
                  </div>
                  <span className="nm">{j.name}</span>
                  <span className="pct num">{j.pct}%</span>
                  <span className="amt num">+{fmt((num * j.pct) / 100)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!valid}
            onClick={submit}
            style={{ opacity: valid ? 1 : 0.5 }}
          >
            <Icon name="check" size={14} /> Log {valid ? fmt(num) : "income"}
          </button>
        </div>
      </div>
    </div>
  );
}
