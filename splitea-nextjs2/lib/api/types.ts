// lib/api/types.ts — backend response shapes (subset; expand as new fields surface)

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  gender?: string | null;
  role_id?: number | null;
  role?: { id: number; name: string; permissions?: string } | null;
  is_active?: boolean;
  profile_picture?: string | null;
}

export interface ApiLoginResponse {
  access_token: string;
  token_type: string;
}

export interface ApiGroup {
  id: number;
  title: string;
  currency: string;
  type?: string | null;
  owner_id: number;
  created_at?: string;
}

export interface ApiMembership {
  id: number;
  group_id: number;
  user_id: number;
  is_admin: boolean;
  user?: ApiUser;
}

export interface ApiSplit {
  id: number;
  expense_id: number;
  user_id: number;
  amount: number;
}

export interface ApiExpense {
  id: number;
  group_id: number;
  payer_id: number;
  amount: number;
  description: string;
  category?: string | null;
  date?: string;
  split_type?: "equal" | "percentage" | "share" | null;
  wallet_id?: number | null;
  splits?: ApiSplit[];
  payer?: ApiUser;
}

export interface ApiFriend {
  id: number;
  user_id: number;
  friend_id: number;
  status: "pending" | "accepted" | "rejected";
  user?: ApiUser;
  friend?: ApiUser;
  created_at?: string;
}

export interface ApiBalanceEntry {
  user_id: number;
  username?: string;
  balance: number;
}

export interface ApiGlobalBalance {
  friend_id: number;
  friend_username?: string;
  net_balance: number; // positive = friend owes you, negative = you owe
}

export interface ApiSettlement {
  id: number;
  group_id?: number;
  from_user_id: number;
  to_user_id: number;
  amount: number;
  status: "pending" | "accepted" | "rejected";
  created_at?: string;
  description?: string | null;
  proof_image?: string | null;
}

export interface ApiNotification {
  id: number;
  user_id: number;
  type: string;
  message: string;
  is_read: boolean;
  link?: string | null;
  related_id?: number | null;
  created_at: string;
}

// ── Économé (jars) ──────────────────────────────────────────────────────────

export type JarCode = "NEC" | "FFA" | "EDU" | "LTSS" | "PLAY" | "GIVE";

export interface ApiJarStrategy {
  id: number;
  name: string;
  is_default?: boolean;
  necessities_pct: number;
  financial_freedom_pct: number;
  education_pct: number;
  long_term_savings_pct: number;
  play_pct: number;
  give_pct: number;
}

export interface ApiJarBalance {
  jar_type: JarCode;
  balance: number;
}

export interface ApiJarTransaction {
  id: number;
  user_id: number;
  jar_type: JarCode;
  amount: number; // signed
  description?: string | null;
  created_at: string;
}

export interface ApiIncomeLog {
  id: number;
  amount: number;
  source_name?: string | null;
  distributed_at?: string;
  strategy_id?: number | null;
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export interface ApiDashboardSummary {
  total_income: number;
  total_expenses: number;
  net_balance: number;
  recent_expenses?: ApiExpense[];
}
