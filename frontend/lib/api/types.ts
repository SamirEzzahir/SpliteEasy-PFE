// lib/api/types.ts — backend response shapes (subset; expand as new fields surface)

export interface ApiUser {
  id: string;
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  gender?: string | null;
  role_id?: string | null;
  role?: { id: string; name: string; permissions?: string } | null;
  is_active?: boolean;
  phone?: string | null;
  profile_photo?: string | null;
  profile_picture?: string | null;
  preferred_currency?: string | null;
  onboarding_completed?: boolean;
  created_at?: string;
}

export interface ApiLoginResponse {
  access_token: string;
  token_type: string;
}

export interface ApiGroup {
  id: string;
  title: string;
  currency: string;
  type?: string | null;
  photo?: string | null;
  description?: string | null;
  owner_id: string;
  owner_username?: string | null;
  members_usernames?: string[];
  expenses_count?: number;
  total_amount?: number;
  has_unsettled_balance?: boolean;
  created_at?: string;
}

export interface ApiMembership {
  id: string;
  group_id: string;
  user_id: string;
  is_admin: boolean;
  username?: string | null;
  email?: string | null;
  full_name?: string | null;
  user?: ApiUser;
}

export interface ApiSplit {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number;
  amount?: number;
}

export interface ApiExpense {
  id: string;
  group_id: string;
  payer_id: string;
  amount: number;
  currency?: string | null;
  description: string;
  note?: string | null;
  category?: string | null;
  date?: string;
  created_at?: string;
  added_by?: string | null;
  added_by_username?: string | null;
  split_type?: "equal" | "percentage" | "share" | null;
  wallet_id?: string | null;
  jar_type?: string | null;
  is_from_jar?: boolean;
  splits?: ApiSplit[];
  payer?: ApiUser;
}

export interface ApiFriend {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "rejected";
  user?: ApiUser;
  friend?: ApiUser;
  created_at?: string;
}

export interface ApiBalanceEntry {
  user_id: string;
  username?: string;
  balance?: number;
  net?: number;
  original_net?: number | null;
  global_adjustment?: number | null;
}

export interface ApiGlobalBalance {
  user_id: string;
  username?: string;
  net: number; // positive = friend owes you, negative = you owe
}

export interface ApiSettlement {
  id: string;
  group_id?: string;
  from_user_id: string;
  from_username?: string;
  to_user_id: string;
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
  id: string;
  user_id: string;
  type: string;
  message: string;
  is_read: boolean;
  link?: string | null;
  related_id?: string | null;
  created_at: string;
}

// ── Économé (jars) ──────────────────────────────────────────────────────────

export type JarCode = "NEC" | "FFA" | "EDU" | "LTSS" | "PLAY" | "GIVE";

export interface ApiJarStrategy {
  id: string;
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
  id: string;
  user_id: string;
  jar_type: JarCode;
  amount: number; // signed
  description?: string | null;
  created_at: string;
}

export interface ApiIncomeLog {
  id: string;
  amount: number;
  source_name?: string | null;
  distributed_at?: string;
  strategy_id?: string | null;
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export interface ApiDashboardSummary {
  total_income: number;
  total_expense: number;
  net_balance: number;
  recent_expenses?: ApiExpense[];
}
