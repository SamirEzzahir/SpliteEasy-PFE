// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface TokenResponse {
  access_token: string
  token_type: string
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: number
  username: string
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  profile_photo?: string | null
  gender?: 'Male' | 'Female' | null
  is_active: boolean
  role_id?: number | null
  global_settlement_mode: 'separate' | 'auto_adjust' | 'hybrid'
  created_at: string
  updated_at: string
}

// ─── Group ────────────────────────────────────────────────────────────────────
export type GroupType = 'Home' | 'Couple' | 'Trip' | 'Work' | 'Personal' | 'Other'
export type Currency = 'USD' | 'EUR' | 'MAD' | 'GBP' | 'CAD' | 'AED' | 'SAR' | 'EGP'

export interface Group {
  id: number
  title: string
  description?: string
  owner_id: number
  type: GroupType
  photo?: string | null
  currency: Currency
  created_at: string
  updated_at: string
  // computed
  owner_username?: string | null
  members_usernames?: string[]
  expenses_count?: number
  total_amount?: number
  has_unsettled_balance?: boolean
}

export interface Membership {
  id: number
  user_id: number
  group_id: number
  is_admin: boolean
  username?: string | null
}

export interface GroupMessage {
  id: number
  group_id: number
  user_id: number
  username?: string | null
  content: string
  created_at: string
}

// ─── Expense ──────────────────────────────────────────────────────────────────
export type ExpenseCategory =
  | 'Food' | 'Transport' | 'Shopping' | 'Entertainment'
  | 'Travel' | 'Accommodation' | 'Utilities' | 'Billing' | 'Other'
export type SplitType = 'equal' | 'percentage' | 'share'

export interface Split {
  id: number
  expense_id: number
  user_id: number
  share_amount: number
  username?: string
}

export interface Expense {
  id: number
  group_id: number
  payer_id?: number | null
  added_by: number
  description: string
  amount: number
  currency: string
  category?: ExpenseCategory | null
  wallet_id?: number | null
  split_type: SplitType
  jar_type?: string | null
  is_from_jar?: boolean
  note?: string | null
  photo?: string | null
  created_at: string
  updated_at: string
  // computed
  payer_username?: string
  added_by_username?: string
  wallet_name?: string | null
  group_name?: string
  splits?: Split[]
}

export interface PaginatedExpenses {
  expenses: Expense[]
  total: number
  offset: number
  limit: number
  has_more: boolean
}

// ─── Settlement ───────────────────────────────────────────────────────────────
export type SettlementStatus = 'pending' | 'accepted' | 'rejected'

export interface Settlement {
  id?: number
  group_id?: number
  from_user_id: number
  to_user_id: number
  amount: number
  status: SettlementStatus
  message?: string | null
  proof_photo?: string | null
  rejected_reason?: string | null
  created_at: string
  updated_at?: string | null
  from_username?: string
  to_username?: string
}

export interface BalanceItem {
  user_id: number
  username: string
  net: number
  original_net?: number | null
  global_adjustment?: number | null
}

// ─── Friends ──────────────────────────────────────────────────────────────────
export interface Friend {
  friendship_id: number
  user_id: number
  username: string
  email: string
  phone?: string | null
}

export interface FriendRequest {
  id: number
  friend_email?: string
  user_email?: string
}

// ─── Finance ──────────────────────────────────────────────────────────────────
export interface Wallet {
  id: number
  user_id: number
  name: string
  category: string
  balance: number
  created_at: string
  updated_at: string
}

export interface IncomeType {
  id: number
  name: string
  category?: string | null
  user_id?: number | null
}

export interface Income {
  id: number
  user_id: number
  income_type_id: number
  wallet_id: number
  amount: number
  source_type: string
  note?: string | null
  date: string
  created_at: string
}

export interface Transaction {
  id: number
  user_id: number
  from_wallet_id: number
  to_wallet_id?: number | null
  transaction_type: 'transfer' | 'debt' | 'credit'
  amount: number
  note?: string | null
  created_at: string
}

// ─── Debts & Loans ────────────────────────────────────────────────────────────
export type DebtLoanStatus = 'active' | 'partially_paid' | 'fully_paid'

export interface Debt {
  id: number
  user_id: number
  lender_name: string
  original_amount: number
  remaining_amount: number
  status: DebtLoanStatus
  wallet_id?: number | null
  due_date?: string | null
  note?: string | null
  created_at: string
  updated_at: string
}

export interface Loan {
  id: number
  user_id: number
  borrower_name: string
  original_amount: number
  remaining_amount: number
  status: DebtLoanStatus
  wallet_id?: number | null
  due_date?: string | null
  note?: string | null
  created_at: string
  updated_at: string
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardSummary {
  total_income: number
  total_expense: number
  net_balance: number
  recent_expenses: Array<{
    description: string
    amount: number
    currency: string
    created_at: string
  }>
}

// ─── Activity ─────────────────────────────────────────────────────────────────
export interface ActivityLog {
  id: number
  user_id: number
  action: string
  target_type?: string | null
  target_id?: number | null
  created_at: string
  user?: { username: string } | null
}

// ─── Notifications ────────────────────────────────────────────────────────────
export interface AppNotification {
  id: number
  user_id: number
  message: string
  type?: string | null
  link?: string | null
  is_read: boolean
  created_at: string
}

// ─── Econome / Jar ────────────────────────────────────────────────────────────
export interface JarStrategy {
  id: number
  user_id?: number | null
  name: string
  nec: number
  ffa: number
  edu: number
  ltss: number
  play: number
  give: number
  created_at: string
  updated_at: string
}
