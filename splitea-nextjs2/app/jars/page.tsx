"use client";
// app/jars/page.tsx — Econome (Jars) page

import { useState } from "react";
import Icon from "@/components/Icon";
import StatsRow from "@/components/jars/StatsRow";
import JarsView from "@/components/jars/JarsView";
import DistributionDonut from "@/components/jars/DistributionDonut";
import TransactionsTable from "@/components/jars/TransactionsTable";
import EmptyState from "@/components/jars/EmptyState";
import TipBanner from "@/components/jars/TipBanner";
import LogIncomeModal from "@/components/modals/LogIncomeModal";
import ManageStrategyModal from "@/components/modals/ManageStrategyModal";
import AddJarExpenseModal from "@/components/modals/AddJarExpenseModal";
import { PRESETS } from "@/lib/jars";
import { useApp } from "@/lib/store";
import { useAppTweaks } from "@/components/shell/AppShell";

export default function JarsPage() {
  const {
    jars, tx, income, strategy, hasIncome, totalInJars,
    tipDismissed, setTipDismissed,
    logIncome, saveStrategy, addJarExpense,
  } = useApp();
  const tweaks = useAppTweaks();

  const [showLog, setShowLog] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Econome (Jars)</h1>
          <p>Manage your money using the 6-jar system.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowLog(true)}>
            <Icon name="plus" size={14} /> Log Income
          </button>
          <button className="btn btn-secondary" onClick={() => setShowStrategy(true)}>
            <Icon name="edit" size={14} /> Manage Strategy
          </button>
        </div>
      </div>

      {!hasIncome ? (
        <EmptyState onLogIncome={() => setShowLog(true)} />
      ) : (
        <>
          <StatsRow
            income={income}
            hasIncome={hasIncome}
            totalInJars={totalInJars}
            jars={jars}
            onOpenStrategy={() => setShowStrategy(true)}
          />

          <div className="section">
            <div className="section-head">
              <h2>Your Jars</h2>
              <div className="meta">
                Strategy: <b>{PRESETS.find((p) => p.id === strategy)?.name || "Custom"}</b> · 6 Jars
              </div>
            </div>
            <JarsView style={tweaks.vizStyle} jars={jars} totals={{ income }} />
          </div>

          <div className="lower">
            <TransactionsTable tx={tx} jars={jars} onAddExpense={() => setShowAddExp(true)} />
            {tweaks.showDonut && <DistributionDonut jars={jars} total={totalInJars} />}
          </div>

          {!tipDismissed && <TipBanner onDismiss={() => setTipDismissed(true)} />}
        </>
      )}

      {showLog && (
        <LogIncomeModal
          jars={jars}
          onClose={() => setShowLog(false)}
          onLog={(amount, label) => {
            logIncome(amount, label);
            setShowLog(false);
          }}
        />
      )}
      {showStrategy && (
        <ManageStrategyModal
          jars={jars}
          income={income || 8420}
          currentStrategy={strategy}
          onClose={() => setShowStrategy(false)}
          onSave={(pcts, presetId) => {
            saveStrategy(pcts, presetId);
            setShowStrategy(false);
          }}
        />
      )}
      {showAddExp && (
        <AddJarExpenseModal
          jars={jars}
          onClose={() => setShowAddExp(false)}
          onAdd={(args) => {
            addJarExpense(args);
            setShowAddExp(false);
          }}
        />
      )}
    </>
  );
}
