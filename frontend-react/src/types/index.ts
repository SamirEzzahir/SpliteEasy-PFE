export interface User {
  id: number
  username: string
  email: string
  first_name?: string
  last_name?: string
  profile_photo?: string
  is_active: boolean
  global_settlement_mode?: string
  role?: { name: string; permissions: string }
  phone?: string
  gender?: string
  created_at?: string
}

export interface Group {
  id: number
  title: string
  description?: string
  type: string
  currency: string
  owner_id: number
  created_at: string
  photo?: string | null
  owner_username?: string | null
  members_usernames?: string[]
  expenses_count?: number
  total_amount?: number
  has_unsettled_balance?: boolean
}

export interface GroupMember {
  id?: number
  user_id: number
  group_id?: number
  username: string
  email?: string
  profile_photo?: string
  role: string
  is_admin?: boolean
}

export interface Expense {
  id: number
  group_id: number
  payer_id: number
  payer_username: string
  added_by: number
  added_by_username: string
  description: string
  amount: number
  currency: string
  category: string
  wallet_id?: number
  wallet_name?: string
  split_type: string
  note?: string
  photo?: string
  created_at: string
  updated_at: string
  splits: Split[]
  group_name?: string
  payer_name?: string
}

export interface Split {
  id: number
  expense_id: number
  user_id: number
  username: string
  share_amount: number
}

export interface Friend {
  id: number
  user_id: number
  friend_id: number
  status: 'pending' | 'accepted' | 'rejected'
  user?: User
  friend?: User
}

// Shape returned by GET /friends/my in backend/routers/friends.py
export interface MyFriend {
  friendship_id: number
  user_id: number
  username: string
  email: string
  phone?: string
  created_at?: string
  profile_photo?: string
}

export interface Notification {
  id: number
  user_id: number
  message: string
  type: string
  is_read: boolean
  link?: string
  created_at: string
}

export interface ActivityLog {
  id: number
  user_id: number
  action: string
  target_type?: string
  target_id?: number
  created_at: string
  user?: User
}

export interface Wallet {
  id: number
  user_id: number
  name: string
  balance: number
  currency: string
  category: string
}

export interface Income {
  id: number
  user_id: number
  amount: number
  date: string
  note?: string
  wallet_id: number
  wallet_name: string
  income_type_id: number
  category_name: string
  created_at: string
  updated_at: string
}

export interface IncomeType {
  id: number
  name: string
  user_id?: number
}

export interface Settlement {
  id: number
  group_id: number
  from_user_id: number
  to_user_id: number
  amount: number
  status: 'pending' | 'accepted' | 'rejected'
  message?: string
  proof_photo?: string
  created_at: string
}

export interface GlobalSettlement {
  id: number
  from_user_id: number
  to_user_id: number
  amount: number
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

export interface Debt {
  id: number
  user_id: number
  lender_name: string
  original_amount: number
  remaining_amount: number
  status: 'active' | 'partially_paid' | 'fully_paid'
  wallet_id?: number
  due_date?: string
  note?: string
  created_at: string
}

export interface Loan {
  id: number
  user_id: number
  borrower_name: string
  original_amount: number
  remaining_amount: number
  status: 'active' | 'partially_paid' | 'fully_paid'
  wallet_id?: number
  due_date?: string
  note?: string
  created_at: string
}
