// lib/store.tsx — global app state, backed by the SplitEasy FastAPI backend.
//
// RN adaptation of the web store:
//   • react-toastify replaced with in-context toast state (rendered by a Toast
//     component in the root layout)
//   • no other web APIs were used, so the fetch/mutation logic is unchanged
//
// On mount (once a user is authenticated) the provider fetches:
//   • econome strategy + balances + income logs → jars + tx + income
//   • /groups + memberships per group → groups[]
//   • per-group expenses → expenses[]
//   • /friends + global balances → friends[]

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Expense, FriendRow, Group, Jar, Tx } from "./types";
import { INITIAL_JARS, INITIAL_TX, INITIAL_INCOME } from "./jars";
import { personById } from "./data";
import { fmt, todayStr } from "./format";
import { useAuth } from "./auth/AuthContext";
import { economeApi } from "./api/econome";
import { groupsApi } from "./api/groups";
import { expensesApi } from "./api/expenses";
import { friendsApi } from "./api/friends";
import { settleApi } from "./api/settle";
import {
  JAR_CODE_BY_UI_ID, JAR_UI_ID_BY_CODE,
  buildJarsFromBackend, mapExpense, mapAcceptedFriend, mapReceivedRequest, mapGroup, mapJarTxToTx,
  mapSentRequest, strategyPctsFromUi,
} from "./api/mappers";
import { registerUsers, setCurrentUserId } from "./people-cache";
import type { ApiJarStrategy } from "./api/types";

export type ToastType = "success" | "error" | "info" | "warning";
export interface ToastState { msg: string; type: ToastType; id: number; }

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
  loading: boolean;

  // ui
  tipDismissed: boolean;
  setTipDismissed: (v: boolean) => void;
  toast: ToastState | null;
  showToast: (msg: string, type?: ToastType) => void;
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
  acceptFriendRequest: (requestId: number) => Promise<void>;
  rejectFriendRequest: (requestId: number) => Promise<void>;
  removeFriend: (friendshipId: number) => Promise<void>;
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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // ── ui state ────────────────────────────────────────────────────────────
  const [tipDismissed, setTipDismissed] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [celebrate, setCelebrate] = useState<CelebrateState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastId = useRef(0);

  const hasIncome = !empty && income > 0;
  const totalInJars = hasIncome ? income : 0;

  const showToast = useCallback((msg: string, type: ToastType = "info") => {
    const id = ++toastId.current;
    setToast({ msg, type, id });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToast((cur) => (cur && cur.id === id ? null : cur));
    }, 3000);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

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
      // Newest first by descending id.
      setTx([...incomeTx, ...ledgerTx].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 20));
    } catch {
      // Leave the seed data in place if the API call fails (e.g. no jars yet).
    }
  }, []);

  const refetchSplitting = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fire all top-level fetches in parallel: groups list, all expenses, friends.
      const [rawGroups, rawAllExpenses, rawFriends, pendingReceived, pendingSent, globals] =
        await Promise.all([
          groupsApi.list().catch(() => []),
          expensesApi.listAll().catch(() => []),
          friendsApi.list().catch(() => []),
          friendsApi.pendingRequests().catch(() => []),
          friendsApi.sentRequests().catch(() => []),
          settleApi.globalBalances().catch(() => []),
        ]);

      // Fetch members for all groups in parallel (needed for memberIds).
      const membersPerGroup = await Promise.all(
        rawGroups.map((g) => groupsApi.members(g.id).catch(() => [])),
      );

      // Register all users we've seen so personById() resolves correctly.
      for (const members of membersPerGroup) {
        registerUsers(members.map((m) => m.user!).filter(Boolean));
      }
      registerUsers(
        [
          ...rawFriends.map((f) => ({ id: f.user_id, username: f.username, email: f.email, full_name: null })),
          ...pendingReceived.filter((r) => r.user_id).map((r) => ({
            id: r.user_id!, username: r.user_username || r.user_email,
            email: r.user_email, full_name: r.user_full_name ?? null,
          })),
          ...pendingSent.filter((r) => r.friend_id).map((r) => ({
            id: r.friend_id!, username: r.friend_username || r.friend_email,
            email: r.friend_email, full_name: r.friend_full_name ?? null,
          })),
        ] as never,
      );

      // ── Groups ────────────────────────────────────────────────
      const totalByGroup = new Map<number, number>();
      for (const e of rawAllExpenses) {
        totalByGroup.set(e.group_id, (totalByGroup.get(e.group_id) ?? 0) + e.amount);
      }

      const mappedGroups: Group[] = rawGroups.map((g, i) => {
        const memberIds = membersPerGroup[i].map((m) => String(m.user_id));
        return mapGroup(g, { memberIds, total: totalByGroup.get(g.id) ?? 0, balance: 0 });
      });
      setGroups(mappedGroups);

      // ── Expenses ─────────────────────────────────────────────
      const allExp: Expense[] = rawAllExpenses.map(mapExpense);
      setExpenses(allExp);

      // ── Friends ───────────────────────────────────────────────
      const balByUser = new Map<number, number>();
      for (const b of globals) balByUser.set(b.user_id, b.net);
      const friendRows: FriendRow[] = rawFriends.map((f) => ({
        ...mapAcceptedFriend(f),
        balance: balByUser.get(f.user_id) ?? 0,
      }));
      setFriends([
        ...friendRows,
        ...pendingReceived.map(mapReceivedRequest),
        ...pendingSent.map(mapSentRequest),
      ]);
    } catch {
      // Keep existing data on network failure.
    } finally {
      setLoading(false);
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
      showToast("Income logged · " + fmt(amount), "success");
      await refetchEconome();
    } catch {
      showToast("Failed to log income", "error");
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
      showToast("Strategy saved", "success");
      await refetchEconome();
    } catch {
      showToast("Failed to save strategy", "error");
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
      showToast("Failed to add expense", "error");
    }
  }, [refetchEconome, showToast]);

  // ── splitting mutations ─────────────────────────────────────────────────

  const addExpense = useCallback(async (exp: Expense) => {
    try {
      const splitType = ((exp as Expense & { splitType?: "equal" | "percentage" | "share" }).splitType) || "equal";
      const customAmounts = (exp as Expense & { customAmounts?: Record<string, string> }).customAmounts;
      await expensesApi.create({
        group_id: Number(exp.groupId),
        payer_id: Number(exp.paidBy),
        added_by: user?.id ?? Number(exp.paidBy),
        amount: exp.amount,
        currency: exp.currency || "USD",
        description: exp.title,
        category: exp.categoryId,
        created_at: new Date().toISOString(),
        split_type: splitType,
        splits: exp.splitIds.map((id) => ({
          user_id: Number(id),
          share_amount: customAmounts?.[id]
            ? parseFloat(customAmounts[id]) || 0
            : exp.amount / Math.max(1, exp.splitIds.length),
        })),
      });
      showToast("Expense added · " + fmt(exp.amount), "success");
      await refetchSplitting();
    } catch {
      showToast("Failed to add expense", "error");
    }
  }, [refetchSplitting, showToast, user]);

  const createGroup = useCallback(async (g: Group) => {
    try {
      await groupsApi.create({
        title: g.name,
        currency: g.currency || "USD",
        type: g.type,
        photo: g.photo || null,
        member_ids: g.memberIds
          .filter((id) => id !== String(user?.id))
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id)),
      });
      showToast("Group created · " + g.name, "success");
      await refetchSplitting();
    } catch {
      showToast("Failed to create group", "error");
    }
  }, [refetchSplitting, showToast, user?.id]);

  const addFriends = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await Promise.all(ids.map((id) => friendsApi.sendRequest(Number(id))));
      showToast(ids.length + " friend request" + (ids.length > 1 ? "s" : "") + " sent", "success");
      await refetchSplitting();
    } catch {
      showToast("Failed to send friend requests", "error");
    }
  }, [refetchSplitting, showToast]);

  const acceptFriendRequest = useCallback(async (requestId: number) => {
    try {
      await friendsApi.accept(requestId);
      showToast("Friend request accepted", "success");
      await refetchSplitting();
    } catch {
      showToast("Failed to accept friend request", "error");
    }
  }, [refetchSplitting, showToast]);

  const rejectFriendRequest = useCallback(async (requestId: number) => {
    try {
      await friendsApi.reject(requestId);
      showToast("Friend request declined", "info");
      await refetchSplitting();
    } catch {
      showToast("Failed to decline friend request", "error");
    }
  }, [refetchSplitting, showToast]);

  const removeFriend = useCallback(async (friendshipId: number) => {
    try {
      await friendsApi.remove(friendshipId);
      showToast("Friend removed", "info");
      await refetchSplitting();
    } catch {
      showToast("Failed to remove friend", "error");
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
      showToast("Settled up with " + p.name, "success");
      await refetchSplitting();
    } catch {
      showToast("Failed to settle", "error");
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
    setExpenses([]);
    setGroups([]);
    setFriends([]);
  }, []);

  const value: AppState = {
    jars, tx, income, strategy: strategyName, empty, hasIncome, totalInJars,
    expenses, groups, friends, loading,
    tipDismissed, setTipDismissed, toast, showToast,
    celebrate, closeCelebrate,
    logIncome, saveStrategy, addJarExpense,
    addExpense, createGroup, addFriends, settleFriend,
    acceptFriendRequest, rejectFriendRequest, removeFriend,
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
