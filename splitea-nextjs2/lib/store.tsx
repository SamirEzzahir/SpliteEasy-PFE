"use client";
// lib/store.tsx — global app state, backed by the SplitEasy FastAPI backend.
//
// On mount (once a user is authenticated) the provider fetches:
//   • econome strategy + balances + income logs → jars + tx + income
//   • /groups + memberships per group → groups[]
//   • per-group expenses → expenses[]
//   • /friends + global balances → friends[]
//
// Mutations call the matching endpoint and then refetch just the affected
// slice. Mock seed data still populates state so the page never renders an
// empty shell — the API fetch overwrites it once data arrives.

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Expense, FriendRow, Group, Jar, Tx } from "./types";
import { INITIAL_JARS, INITIAL_TX, INITIAL_INCOME } from "./jars";
import { EXPENSES, GROUPS, FRIENDS_INIT, personById } from "./data";
import { fmt, todayStr } from "./format";
import { useAuth } from "./auth/AuthContext";
import { economeApi } from "./api/econome";
import { groupsApi } from "./api/groups";
import { expensesApi } from "./api/expenses";
import { friendsApi } from "./api/friends";
import { settleApi } from "./api/settle";
import {
  JAR_CODE_BY_UI_ID, JAR_UI_ID_BY_CODE,
  buildJarsFromBackend, mapExpense, mapFriend, mapGroup, mapJarTxToTx,
  strategyPctsFromUi,
} from "./api/mappers";
import { registerUsers, setCurrentUserId } from "./people-cache";
import type { ApiJarStrategy } from "./api/types";

interface CelebrateState { jar: Jar; amount: number; }

interface AppState {
  // jars
  jars: Jar[];
  tx: Tx[];
  income: number;
  strategy: string;
  empty: boolean;
  hasIncome: boolean;
  totalInJars: number;

  // splitting
  expenses: Expense[];
  groups: Group[];
  friends: FriendRow[];

  // ui
  tipDismissed: boolean;
  setTipDismissed: (v: boolean) => void;
  toast: string | null;
  showToast: (msg: string) => void;
  celebrate: CelebrateState | null;
  closeCelebrate: () => void;

  // jar handlers (API)
  logIncome: (amount: number, label: string) => Promise<void>;
  saveStrategy: (pcts: Record<string, number>, presetId: string) => Promise<void>;
  addJarExpense: (args: { amount: number; label: string; jarId: string }) => Promise<void>;

  // splitting handlers (API)
  addExpense: (e: Expense) => Promise<void>;
  createGroup: (g: Group) => Promise<void>;
  addFriends: (ids: string[]) => Promise<void>;
  settleFriend: (personId: string) => Promise<void>;

  // demo triggers (still client-side — they only mutate local UI state)
  triggerEmpty: () => void;
  triggerCelebrate: () => void;
  reset: () => void;

  // refetchers — pages can force a fresh pull
  refetchEconome: () => Promise<void>;
  refetchSplitting: () => Promise<void>;
}

const AppCtx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // ── jar state ────────────────────────────────────────────────────────────
  const [jars, setJars] = useState<Jar[]>(INITIAL_JARS);
  const [tx, setTx] = useState<Tx[]>(INITIAL_TX);
  const [income, setIncome] = useState<number>(INITIAL_INCOME);
  const [strategyId, setStrategyId] = useState<number | null>(null);
  const [strategyName, setStrategyName] = useState<string>("default");
  const [empty, setEmpty] = useState<boolean>(false);

  // ── splitting state ──────────────────────────────────────────────────────
  const [expenses, setExpenses] = useState<Expense[]>(EXPENSES);
  const [groups, setGroups] = useState<Group[]>(GROUPS);
  const [friends, setFriends] = useState<FriendRow[]>(FRIENDS_INIT);

  // ── ui state ────────────────────────────────────────────────────────────
  const [tipDismissed, setTipDismissed] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<CelebrateState | null>(null);

  const hasIncome = !empty && income > 0;
  const totalInJars = hasIncome ? income : 0;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  // ── fetchers ────────────────────────────────────────────────────────────

  const refetchEconome = useCallback(async () => {
    try {
      const [strategies, balances, logs] = await Promise.all([
        economeApi.strategies(),
        economeApi.balances(),
        economeApi.incomeLogs(),
      ]);
      const def: ApiJarStrategy | null =
        strategies.find((s) => s.is_default) || strategies[0] || null;
      setStrategyId(def?.id ?? null);
      setStrategyName(def?.name ?? "default");
      setJars(buildJarsFromBackend(def, balances));
      const totalIncome = logs.reduce((s, l) => s + l.amount, 0);
      setIncome(totalIncome);
      setEmpty(totalIncome === 0 && balances.every((b) => b.balance === 0));

      // Build tx list from ledger (jar transactions) + income logs.
      const ledger = await economeApi.ledger();
      const ledgerTx: Tx[] = ledger
        .slice(0, 50)
        .map((t) => mapJarTxToTx(t, JAR_UI_ID_BY_CODE));
      const incomeTx: Tx[] = logs.slice(0, 10).map((l) => ({
        id: 1000000 + l.id,
        date: l.distributed_at
          ? new Date(l.distributed_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })
          : todayStr(),
        desc: l.source_name || "Income",
        jarId: null,
        type: "income",
        amount: l.amount,
      }));
      // Newest first by descending id (the ledger is already newest-first on most APIs).
      setTx([...incomeTx, ...ledgerTx].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 20));
    } catch {
      // Leave the seed data in place if the API call fails (e.g. no jars yet).
    }
  }, []);

  const refetchSplitting = useCallback(async () => {
    if (!user) return;
    try {
      const rawGroups = await groupsApi.list();

      // Pull members + expenses for each group in parallel.
      const enriched = await Promise.all(
        rawGroups.map(async (g) => {
          const [members, gExpenses] = await Promise.all([
            groupsApi.members(g.id).catch(() => []),
            expensesApi.listForGroup(g.id).catch(() => []),
          ]);
          // Register every user we see so personById() resolves names + avatars.
          registerUsers(members.map((m) => m.user!).filter(Boolean));
          const memberIds = members.map((m) => String(m.user_id));
          const total = gExpenses.reduce((s, e) => s + e.amount, 0);
          return { g, members, gExpenses, memberIds, total };
        }),
      );

      // ── Groups ────────────────────────────────────────────────
      const balByGroup = new Map<number, number>(); // populated below
      const mappedGroups: Group[] = enriched.map(({ g, memberIds, total }) =>
        mapGroup(g, {
          memberIds,
          total,
          balance: balByGroup.get(g.id) ?? 0,
        }),
      );
      setGroups(mappedGroups);

      // ── Expenses (flattened across groups) ────────────────────
      const allExp: Expense[] = enriched
        .flatMap(({ gExpenses }) => gExpenses)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .map(mapExpense);
      setExpenses(allExp);

      // ── Friends ───────────────────────────────────────────────
      if (user) {
        const [rawFriends, pending, globals] = await Promise.all([
          friendsApi.list().catch(() => []),
          friendsApi.pendingRequests().catch(() => []),
          settleApi.globalBalances().catch(() => []),
        ]);
        // Register the embedded users on friends so the friend page can name them.
        registerUsers(
          [...rawFriends, ...pending]
            .flatMap((f) => [f.user, f.friend].filter(Boolean))
            .filter(Boolean) as any,
        );
        const balByUser = new Map<number, number>();
        for (const b of globals) balByUser.set(b.friend_id, b.net_balance);
        const merged: FriendRow[] = [...rawFriends, ...pending].map((f) => {
          const base = mapFriend(f, user.id);
          const bal = balByUser.get(Number(base.personId)) ?? 0;
          return { ...base, balance: bal };
        });
        setFriends(merged);
      }
    } catch {
      // Keep seed data on network failure.
    }
  }, [user]);

  // ── boot: load /me into the people cache, then pull everything ─────────
  useEffect(() => {
    if (!user) {
      setCurrentUserId(null);
      return;
    }
    setCurrentUserId(user.id);
    registerUsers([user]);
    void refetchEconome();
    void refetchSplitting();
  }, [user, refetchEconome, refetchSplitting]);

  // ── celebrate trigger (still client-side) ───────────────────────────────
  useEffect(() => {
    for (const j of jars) {
      const tot = income * (j.pct / 100);
      const used = j.spent + j.saved;
      const usage = tot ? used / tot : 0;
      if (j.kind === "save" && usage >= 1 && !j._celebrated && tot > 0) {
        setCelebrate({ jar: j, amount: used });
        setJars((js) => js.map((x) => (x.id === j.id ? { ...x, _celebrated: true } : x)));
        break;
      }
    }
  }, [jars, income]);

  const closeCelebrate = useCallback(() => setCelebrate(null), []);

  // ── jar mutations ───────────────────────────────────────────────────────

  const logIncome = useCallback(async (amount: number, label: string) => {
    try {
      await economeApi.distribute({
        amount,
        source_name: label,
        strategy_id: strategyId ?? undefined,
      });
      showToast("Income logged · " + fmt(amount));
      await refetchEconome();
    } catch {
      showToast("Failed to log income");
    }
  }, [strategyId, refetchEconome, showToast]);

  const saveStrategy = useCallback(async (pcts: Record<string, number>, presetId: string) => {
    try {
      const payload = { name: presetId, ...strategyPctsFromUi(pcts), is_default: true };
      if (strategyId) {
        await economeApi.updateStrategy(strategyId, payload);
      } else {
        const created = await economeApi.createStrategy(payload);
        setStrategyId(created.id);
      }
      setStrategyName(presetId);
      showToast("Strategy saved");
      await refetchEconome();
    } catch {
      showToast("Failed to save strategy");
    }
  }, [strategyId, refetchEconome, showToast]);

  const addJarExpense = useCallback(async ({
    amount, label, jarId,
  }: { amount: number; label: string; jarId: string }) => {
    const code = JAR_CODE_BY_UI_ID[jarId];
    if (!code) return;
    try {
      await economeApi.spend({ jar_type: code, amount, description: label });
      await refetchEconome();
    } catch {
      showToast("Failed to add expense");
    }
  }, [refetchEconome, showToast]);

  // ── splitting mutations ─────────────────────────────────────────────────

  const addExpense = useCallback(async (exp: Expense) => {
    try {
      await expensesApi.create({
        group_id: Number(exp.groupId),
        payer_id: Number(exp.paidBy),
        amount: exp.amount,
        description: exp.title,
        category: exp.categoryId,
        date: new Date().toISOString(),
        split_type: "equal",
        splits: exp.splitIds.map((id) => ({
          user_id: Number(id),
          amount: exp.amount / Math.max(1, exp.splitIds.length),
        })),
      });
      showToast("Expense added · " + fmt(exp.amount));
      await refetchSplitting();
    } catch {
      showToast("Failed to add expense");
    }
  }, [refetchSplitting, showToast]);

  const createGroup = useCallback(async (g: Group) => {
    try {
      await groupsApi.create({ title: g.name, currency: "USD", type: g.type });
      showToast("Group created · " + g.name);
      await refetchSplitting();
    } catch {
      showToast("Failed to create group");
    }
  }, [refetchSplitting, showToast]);

  const addFriends = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await Promise.all(ids.map((id) => friendsApi.sendRequest(Number(id))));
      showToast(ids.length + " friend request" + (ids.length > 1 ? "s" : "") + " sent");
      await refetchSplitting();
    } catch {
      showToast("Failed to send friend requests");
    }
  }, [refetchSplitting, showToast]);

  const settleFriend = useCallback(async (personId: string) => {
    if (!user) return;
    const friend = friends.find((f) => f.personId === personId);
    if (!friend) return;
    try {
      await settleApi.recordGlobal({
        from_user_id: friend.balance < 0 ? user.id : Number(personId),
        to_user_id: friend.balance < 0 ? Number(personId) : user.id,
        amount: Math.abs(friend.balance),
        description: "Settle up",
      });
      const p = personById(personId);
      showToast("Settled up with " + p.name);
      await refetchSplitting();
    } catch {
      showToast("Failed to settle");
    }
  }, [user, friends, refetchSplitting, showToast]);

  // ── demo triggers (kept as client-side toys) ────────────────────────────

  const triggerEmpty = useCallback(() => {
    setEmpty(true);
    setJars(INITIAL_JARS.map((j) => ({ ...j, spent: 0, saved: 0, _celebrated: false })));
    setTx([]);
    setIncome(0);
  }, []);

  const triggerCelebrate = useCallback(() => {
    setJars((js) =>
      js.map((j) =>
        j.id === "savings" ? { ...j, saved: income * (j.pct / 100), _celebrated: false } : j,
      ),
    );
  }, [income]);

  const reset = useCallback(() => {
    setJars(INITIAL_JARS);
    setTx(INITIAL_TX);
    setIncome(INITIAL_INCOME);
    setStrategyName("default");
    setEmpty(false);
    setCelebrate(null);
    setTipDismissed(false);
    setExpenses(EXPENSES);
    setGroups(GROUPS);
    setFriends(FRIENDS_INIT);
  }, []);

  const value: AppState = {
    jars, tx, income, strategy: strategyName, empty, hasIncome, totalInJars,
    expenses, groups, friends,
    tipDismissed, setTipDismissed, toast, showToast,
    celebrate, closeCelebrate,
    logIncome, saveStrategy, addJarExpense,
    addExpense, createGroup, addFriends, settleFriend,
    triggerEmpty, triggerCelebrate, reset,
    refetchEconome, refetchSplitting,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
