"use client";
// components/modals/AddJarExpenseModal.tsx — small jar-source expense modal

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { todayStr } from "@/lib/format";
import type { Jar } from "@/lib/types";

interface Props {
  jars: Jar[];
  onClose: () => void;
  onAdd: (args: { amount: number; label: string; jarId: string }) => void;
}

export default function AddJarExpenseModal({ jars, onClose, onAdd }: Props) {
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [jarId, setJarId] = useState(jars[0].id);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);
  const num = parseFloat(amount) || 0;
  const valid = num > 0 && label.trim();

  const submit = () => valid && onAdd({ amount: num, label: label.trim(), jarId });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <h2>Add Expense</h2>
            <p>Pull from one of your jars.</p>
          </div>
          <button className="modal-x" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-b">
          <div className="field">
            <label>Description</label>
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Grocery shopping"
            />
          </div>
          <div className="row-2">
            <div className="field">
              <label>Amount</label>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="field">
              <label>Date</label>
              <input type="text" value={todayStr()} readOnly />
            </div>
          </div>
          <div className="field">
            <label>From jar</label>
            <div className="jar-select">
              {jars.map((j) => (
                <button
                  key={j.id}
                  className={"jar-pick" + (jarId === j.id ? " active" : "")}
                  onClick={() => setJarId(j.id)}
                >
                  <div className="jar-icon" style={{ background: j.soft, color: j.color }}>
                    <Icon name={j.icon} size={13} />
                  </div>
                  <span className="nm">{j.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!valid}
            onClick={submit}
            style={{ opacity: valid ? 1 : 0.5 }}
          >
            <Icon name="check" size={14} /> Add expense
          </button>
        </div>
      </div>
    </div>
  );
}
