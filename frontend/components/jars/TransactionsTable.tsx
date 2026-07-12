"use client";
// components/jars/TransactionsTable.tsx

import { useMemo } from "react";
import Icon from "@/components/Icon";
import { fmt } from "@/lib/format";
import type { Jar, Tx } from "@/lib/types";

interface Props {
  tx: Tx[];
  jars: Jar[];
  onAddExpense: () => void;
}

export default function TransactionsTable({ tx, jars, onAddExpense }: Props) {
  const jarById = useMemo(() => Object.fromEntries(jars.map((j) => [j.id, j])), [jars]);
  return (
    <div className="card tx-card">
      <div className="tx-head">
        <h3>Recent Transactions</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn btn-secondary"
            style={{ padding: "6px 10px", fontSize: 12 }}
            onClick={onAddExpense}
          >
            <Icon name="plus" size={12} /> Add expense
          </button>
          <button className="tx-link">View All</button>
        </div>
      </div>
      {tx.length === 0 ? (
        <div className="tx-empty">
          <Icon name="receipt" size={28} />
          <div>No transactions yet</div>
        </div>
      ) : (
        <table className="tx">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Jar</th>
              <th>Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {tx.slice(0, 7).map((t) => {
              const j = t.jarId ? jarById[t.jarId] : null;
              return (
                <tr key={t.id}>
                  <td style={{ color: "var(--ink-3)" }}>{t.date}</td>
                  <td style={{ color: "var(--ink)", fontWeight: 500 }}>{t.desc}</td>
                  <td>
                    {j ? (
                      <span className="tx-jar">
                        <span className="dotc" style={{ background: j.color }} /> {j.name}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-3)" }}>All Jars</span>
                    )}
                  </td>
                  <td>
                    <span className={"tx-type " + t.type}>
                      {t.type === "expense" ? "Expense" : "Income"}
                    </span>
                  </td>
                  <td className={"tx-amount num " + (t.type === "expense" ? "neg" : "pos")}>
                    {t.type === "expense" ? "−" : "+"}
                    {fmt(t.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
