// lib/api/types.ts — backend response shapes (subset; expand as new fields surface)

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  gender?: string | null;
  role_id?: number | null;
  role?: { id: number; name: string; permissions?: string } | null;
  is_active?: boolean;
  phone?: string | null;
  profile_photo?: string | null;
  profile_picture?: string | null;
  preferred_currency?: string | null;
  created_at?: string;
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
  photo?: string | null;
  description?: string | null;
  owner_id: number;
  owner_username?: string | null;
  members_usernames?: string[];
  expenses_count?: number;
  total_amount?: number;
  has_unsettled_balance?: boolean;
  created_at?: string;
}

export interface ApiMembership {
  id: number;
  group_id: number;
  user_id: number;
  is_admin: boolean;
  username?: string | null;
  email?: string | null;
  full_name?: string | null;
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
  currency?: string | null;
  description: string;
  category?: string | null;
  date?: string;
  created_at?: string;
  added_by?: number | null;
  added_by_username?: string | null;
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
  balance?: number;
  net?: number;
  original_net?: number | null;
  global_adjustment?: number | null;
}

export interface ApiGlobalBalance {
  user_id: number;
  username?: string;
  net: number; // positive = friend owes you, negative = you owe
}

export interface ApiSettlement {
  id: number;
  group_id?: number;
  from_user_id: number;
  from_username?: string;
  to_user_id: number;
  to_username?: string;
  amount: number;
  status: "pending" | "accepted" | "rejected";
  created_at?: string;
  updated_at?: string;
  message?: string | null;
  description?: string | null;
  proof_photo?: string | null;
  rejected_reason?: string | null;
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
  total_expense: number;
  net_balance: number;
  recent_expenses?: ApiExpense[];
}
