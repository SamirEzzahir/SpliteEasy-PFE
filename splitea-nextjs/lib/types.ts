// lib/types.ts — shared domain types

export type JarKind = "spend" | "save";

export interface Jar {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  soft: string;
  pct: number;
  kind: JarKind;
  spent: number;
  saved: number;
  _celebrated?: boolean;
}

export type TxType = "expense" | "income";

export interface Tx {
  id: number;
  date: string;
  desc: string;
  jarId: string | null;
  type: TxType;
  amount: number;
}

export interface Person {
  id: string;
  name: string;
  you?: boolean;
  email?: string;
  color: string;
  color2: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  soft: string;
  pillBg: string;
  pillFg: string;
}

export type GroupType = "trip" | "home" | "social" | "work";

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  currency?: string;
  photo?: string | null;
  description?: string;
  icon: string;
  color: string;
  soft: string;
  heroA: string;
  heroB: string;
  memberIds: string[];
  total: number;
  balance: number;
  updated: string;
}

export interface Expense {
  id: string;
  title: string;
  subtitle: string;
  groupId: string;
  paidBy: string;
  categoryId: string;
  amount: number;
  currency?: string;
  date: string;
  time: string;
  splitIds: string[];
  addedByUsername?: string;
  _rawDate?: string;
}

export type FriendStatus = "friend" | "received" | "sent";

export interface FriendRow {
  personId: string;
  status: FriendStatus;
  balance: number;
  mutuals: number;
  friendshipId?: number;
  requestId?: number;
  displayName?: string;
  email?: string;
  requestAt?: string;
  activity?: string;
}

export interface Suggestion {
  personId: string;
  mutuals: number;
}

export interface ActivityItem {
  who: string;
  action: string;
  detail: string;
  when: string;
  icon: string;
  color: string;
  soft: string;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
  label: string;
  status: string;
}

export interface Preset {
  id: string;
  name: string;
  desc: string;
  pcts: Record<string, number>;
}
