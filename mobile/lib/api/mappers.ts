// lib/api/mappers.ts — translate backend shapes into the UI types used by the
// existing pages. Keeps the rest of the app ignorant of the API's exact wire format.

import type {
  ApiExpense, ApiGroup, ApiJarBalance, ApiJarStrategy,
  ApiJarTransaction, ApiNotification, ApiUser, JarCode,
} from "./types";
import type { ApiFriendEntry, ApiReceivedRequest, ApiSentRequest } from "./friends";
import type {
  Expense, FriendRow, Group, GroupType, Jar, Person, Tx,
} from "../types";

// ── people / users ──────────────────────────────────────────────────────────

// Deterministic-ish color picker so the same user always renders with the same
// gradient. Avoids stashing per-user color in state when we only have an id.
const COLOR_PAIRS: [string, string][] = [
  ["#f59e0b", "#ec4899"],
  ["#0ea5e9", "#2563eb"],
  ["#5b4ef0", "#7c3aed"],
  ["#ec4899", "#f43f5e"],
  ["#10b981", "#14b8a6"],
  ["#f97316", "#f59e0b"],
  ["#8b5cf6", "#a855f7"],
  ["#06b6d4", "#0ea5e9"],
  ["#d946ef", "#a855f7"],
  ["#84cc16", "#10b981"],
  ["#f43f5e", "#be123c"],
  ["#22c55e", "#0ea5e9"],
];

export function userColors(userId: number): { color: string; color2: string } {
  const [color, color2] = COLOR_PAIRS[userId % COLOR_PAIRS.length];
  return { color, color2 };
}

export function mapUserToPerson(u: ApiUser, currentUserId?: number): Person {
  const { color, color2 } = userColors(u.id);
  const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return {
    id: String(u.id),
    name: u.full_name || fullName || u.username,
    email: u.email,
    you: currentUserId != null && u.id === currentUserId,
    color,
    color2,
  };
}

// ── groups ─────────────────────────────────────────────────────────────────

// Map free-form backend "type" to one of our four UI buckets.
function normalizeGroupType(t?: string | null): GroupType {
  const v = (t || "").toLowerCase();
  if (v.includes("trip") || v.includes("travel")) return "trip";
  if (v.includes("work") || v.includes("office")) return "work";
  if (v.includes("home") || v.includes("family") || v.includes("couple")) return "home";
  return "social";
}

const GROUP_ICON_BY_TYPE: Record<GroupType, string> = {
  trip: "briefcase",
  home: "home",
  social: "groups",
  work: "office",
};

const GROUP_PALETTES: { color: string; soft: string; heroA: string; heroB: string }[] = [
  { color: "#5b4ef0", soft: "#eeecff", heroA: "#7c3aed", heroB: "#f59e0b" },
  { color: "#10b981", soft: "#dcfce7", heroA: "#10b981", heroB: "#fbbf24" },
  { color: "#f97316", soft: "#fff1e6", heroA: "#f97316", heroB: "#ec4899" },
  { color: "#0ea5e9", soft: "#e0f2fe", heroA: "#0ea5e9", heroB: "#5b4ef0" },
  { color: "#ec4899", soft: "#fce7f3", heroA: "#ec4899", heroB: "#f97316" },
  { color: "#8b5cf6", soft: "#ede9fe", heroA: "#8b5cf6", heroB: "#06b6d4" },
];

export interface GroupExtras {
  memberIds: string[];
  total: number;
  balance: number;
}

function formatRelativeDate(iso?: string): string {
  if (!iso) return "recently";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "moments ago";
  if (diffMs < hour) return Math.max(1, Math.floor(diffMs / minute)) + "m ago";
  if (diffMs < day) return Math.floor(diffMs / hour) + "h ago";
  if (diffMs < 7 * day) return Math.floor(diffMs / day) + "d ago";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function mapGroup(g: ApiGroup, extras: GroupExtras): Group {
  const type = normalizeGroupType(g.type);
  const palette = GROUP_PALETTES[g.id % GROUP_PALETTES.length];
  return {
    id: String(g.id),
    name: g.title,
    type,
    currency: g.currency || "USD",
    icon: GROUP_ICON_BY_TYPE[type],
    memberIds: extras.memberIds,
    total: extras.total || g.total_amount || 0,
    balance: extras.balance,
    updated: formatRelativeDate(g.created_at),
    ownerUsername: g.owner_username ?? undefined,
    ownerId: g.owner_id,
    ...palette,
  };
}

// ── expenses ───────────────────────────────────────────────────────────────

const CATEGORY_FALLBACK = "other";

function normalizeCategoryId(name?: string | null): string {
  const v = (name || "").toLowerCase();
  if (!v) return CATEGORY_FALLBACK;
  if (v.includes("food") || v.includes("drink") || v.includes("rest")) return "food";
  if (v.includes("transp") || v.includes("taxi") || v.includes("uber") || v.includes("fuel")) return "transport";
  if (v.includes("shop") || v.includes("groc")) return "shopping";
  if (v.includes("enter") || v.includes("movie") || v.includes("game") || v.includes("fun")) return "entertainment";
  if (v.includes("bill") || v.includes("utili")) return "bills";
  if (v.includes("hotel") || v.includes("stay") || v.includes("rent") || v.includes("accom")) return "accom";
  return CATEGORY_FALLBACK;
}

function toUtcDate(iso: string): Date {
  // Backend returns UTC datetimes sometimes without the Z suffix.
  // Appending Z when missing forces correct UTC interpretation.
  const normalized = /[Zz+\-]\d*$/.test(iso.trim()) ? iso : iso + "Z";
  return new Date(normalized);
}

function formatDate(iso?: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = toUtcDate(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: "" };

  const diffMs = Date.now() - d.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  let date: string;
  if (diffMs < minute) date = "Just now";
  else if (diffMs < hour) date = Math.max(1, Math.floor(diffMs / minute)) + "min ago";
  else if (diffMs < 2 * hour) date = "1h ago";
  else if (diffMs < day) date = Math.floor(diffMs / hour) + "h ago";
  else if (diffMs < 2 * day) date = "Yesterday";
  else if (diffMs < 7 * day) date = Math.floor(diffMs / day) + " days ago";
  else date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return { date, time };
}

export function mapExpense(e: ApiExpense): Expense {
  const { date, time } = formatDate(e.date || e.created_at);
  return {
    id: String(e.id),
    title: e.description,
    subtitle: "",
    groupId: String(e.group_id),
    paidBy: String(e.payer_id),
    categoryId: normalizeCategoryId(e.category),
    amount: e.amount,
    currency: e.currency ?? undefined,
    date,
    time,
    splitIds: (e.splits || []).map((s) => String(s.user_id)),
    addedByUsername: e.added_by_username ?? undefined,
    _rawDate: e.date || e.created_at,
  };
}

// ── friends ────────────────────────────────────────────────────────────────

export function mapAcceptedFriend(f: ApiFriendEntry): FriendRow {
  return {
    personId: String(f.user_id),
    status: "friend",
    balance: 0, // merged later from global balances
    mutuals: 0,
    friendshipId: f.friendship_id,
    displayName: f.username,
    email: f.email,
    requestAt: undefined,
  };
}

export function mapReceivedRequest(r: ApiReceivedRequest): FriendRow {
  const personId = r.user_id ? String(r.user_id) : `req-${r.id}`;
  const fullName = [r.user_first_name, r.user_last_name].filter(Boolean).join(" ").trim();
  return {
    personId,
    status: "received",
    balance: 0,
    mutuals: 0,
    requestId: r.id,
    displayName: r.user_full_name || fullName || r.user_username || r.user_email,
    email: r.user_email,
    requestAt: "Pending",
  };
}

export function mapSentRequest(r: ApiSentRequest): FriendRow {
  const personId = r.friend_id ? String(r.friend_id) : `sent-${r.id}`;
  const fullName = [r.friend_first_name, r.friend_last_name].filter(Boolean).join(" ").trim();
  return {
    personId,
    status: "sent",
    balance: 0,
    mutuals: 0,
    requestId: r.id,
    displayName: r.friend_full_name || fullName || r.friend_username || r.friend_email,
    email: r.friend_email,
    requestAt: "Pending",
  };
}

// ── jars ───────────────────────────────────────────────────────────────────

// Maps the backend's six fixed jar codes onto the UI's jar metadata.
const JAR_META: Record<JarCode, Pick<Jar, "id" | "name" | "desc" | "icon" | "color" | "soft" | "kind">> = {
  NEC:  { id: "necessities", name: "Necessities",       desc: "Rent, food, bills, transport",   icon: "home",   color: "#f97316", soft: "#fff1e6", kind: "spend" },
  FFA:  { id: "financial",   name: "Financial Freedom", desc: "Investments, passive income",    icon: "coin",   color: "#10b981", soft: "#dcfce7", kind: "save"  },
  LTSS: { id: "savings",     name: "Long-term Savings", desc: "Big purchases, emergencies",     icon: "target", color: "#f43f5e", soft: "#ffe4e6", kind: "save"  },
  EDU:  { id: "education",   name: "Education",         desc: "Books, courses, growth",         icon: "book",   color: "#0ea5e9", soft: "#e0f2fe", kind: "spend" },
  PLAY: { id: "play",        name: "Play",              desc: "Fun, entertainment, dining",     icon: "party",  color: "#ec4899", soft: "#fce7f3", kind: "spend" },
  GIVE: { id: "give",        name: "Give",              desc: "Charity, gifts, donations",      icon: "gift",   color: "#8b5cf6", soft: "#ede9fe", kind: "spend" },
};

export const JAR_ORDER: JarCode[] = ["NEC", "FFA", "LTSS", "EDU", "PLAY", "GIVE"];

// Inverse of JAR_META.id — for resolving the backend jar code from a UI jar id
// (used when the user spends from a jar via the small Add-Expense modal).
export const JAR_CODE_BY_UI_ID: Record<string, JarCode> = Object.fromEntries(
  Object.entries(JAR_META).map(([code, meta]) => [meta.id, code as JarCode]),
) as Record<string, JarCode>;

export function buildJarsFromBackend(
  strategy: ApiJarStrategy | null,
  balances: ApiJarBalance[],
): Jar[] {
  const balByCode: Record<JarCode, number> = {
    NEC: 0, FFA: 0, EDU: 0, LTSS: 0, PLAY: 0, GIVE: 0,
  };
  for (const b of balances) balByCode[b.jar_type] = b.balance;

  const pctByCode: Record<JarCode, number> = strategy
    ? {
        NEC: strategy.necessities_pct,
        FFA: strategy.financial_freedom_pct,
        EDU: strategy.education_pct,
        LTSS: strategy.long_term_savings_pct,
        PLAY: strategy.play_pct,
        GIVE: strategy.give_pct,
      }
    : { NEC: 55, FFA: 10, EDU: 10, LTSS: 10, PLAY: 10, GIVE: 5 };

  return JAR_ORDER.map((code) => {
    const meta = JAR_META[code];
    const bal = balByCode[code];
    return {
      ...meta,
      pct: pctByCode[code],
      spent: meta.kind === "spend" ? Math.max(0, -bal) : 0,
      saved: meta.kind === "save" ? Math.max(0, bal) : 0,
    };
  });
}

export function strategyPctsFromUi(pcts: Record<string, number>): {
  necessities_pct: number;
  financial_freedom_pct: number;
  education_pct: number;
  long_term_savings_pct: number;
  play_pct: number;
  give_pct: number;
} {
  return {
    necessities_pct: pcts.necessities ?? 0,
    financial_freedom_pct: pcts.financial ?? 0,
    education_pct: pcts.education ?? 0,
    long_term_savings_pct: pcts.savings ?? 0,
    play_pct: pcts.play ?? 0,
    give_pct: pcts.give ?? 0,
  };
}

// ── notifications ─────────────────────────────────────────────────────────

export function mapNotification(n: ApiNotification) {
  return {
    id: n.id,
    type: n.type,
    message: n.message,
    isRead: n.is_read,
    link: n.link || null,
    createdAt: n.created_at,
  };
}

// ── transactions (Économé ledger → UI Tx) ─────────────────────────────────

export function mapJarTxToTx(t: ApiJarTransaction, jarUiIdByCode: Record<JarCode, string>): Tx {
  const isIncome = t.amount > 0;
  const { date } = formatDate(t.created_at);
  return {
    id: t.id,
    date,
    desc: t.description || (isIncome ? "Income" : "Expense"),
    jarId: jarUiIdByCode[t.jar_type] || null,
    type: isIncome ? "income" : "expense",
    amount: Math.abs(t.amount),
  };
}

export const JAR_UI_ID_BY_CODE: Record<JarCode, string> = Object.fromEntries(
  Object.entries(JAR_META).map(([code, meta]) => [code as JarCode, meta.id]),
) as Record<JarCode, string>;
