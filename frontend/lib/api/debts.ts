// lib/api/debts.ts — Debts & Loans API (backend prefix /debts-loans).
// Debt   = money YOU owe someone (lender_name).
// Loan   = money someone owes YOU (borrower_name).

import { api } from "./client";

export type DebtLoanStatus = "active" | "partially_paid" | "fully_paid";

export interface ApiDebt {
  id: string;
  user_id: string;
  lender_name: string;
  original_amount: number;
  remaining_amount: number;
  total_paid: number;
  status: DebtLoanStatus;
  wallet_id?: string | null;
  due_date?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiLoan {
  id: string;
  user_id: string;
  borrower_name: string;
  original_amount: number;
  remaining_amount: number;
  total_paid: number;
  status: DebtLoanStatus;
  wallet_id?: string | null;
  due_date?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiRepayment {
  id: string;
  amount: number;
  wallet_name?: string | null;
  note?: string | null;
  created_at: string;
}

export interface ApiDebtLoanSummary {
  total_debt: number;
  total_loans: number;
  net: number;
  active_debts_count: number;
  active_loans_count: number;
  total_debts_count: number;
  total_loans_count: number;
}

export interface DebtInput {
  lender_name: string;
  original_amount: number;
  due_date?: string | null;
  note?: string | null;
}

export interface LoanInput {
  borrower_name: string;
  original_amount: number;
  due_date?: string | null;
  note?: string | null;
}

export const debtsLoansApi = {
  async summary(): Promise<ApiDebtLoanSummary> {
    const r = await api.get<ApiDebtLoanSummary>("/debts-loans/summary");
    return r.data;
  },

  // ── Debts (you owe) ─────────────────────────────────────────────────────────
  async listDebts(): Promise<ApiDebt[]> {
    const r = await api.get<ApiDebt[]>("/debts-loans/debts");
    return r.data;
  },
  async createDebt(payload: DebtInput): Promise<ApiDebt> {
    const r = await api.post<ApiDebt>("/debts-loans/debts", payload);
    return r.data;
  },
  async deleteDebt(id: string): Promise<void> {
    await api.delete(`/debts-loans/debts/${id}`);
  },
  async repayDebt(id: string, amount: number, note?: string): Promise<void> {
    await api.post(`/debts-loans/debts/${id}/repay`, { amount, note });
  },

  // ── Loans (owed to you) ─────────────────────────────────────────────────────
  async listLoans(): Promise<ApiLoan[]> {
    const r = await api.get<ApiLoan[]>("/debts-loans/loans");
    return r.data;
  },
  async createLoan(payload: LoanInput): Promise<ApiLoan> {
    const r = await api.post<ApiLoan>("/debts-loans/loans", payload);
    return r.data;
  },
  async deleteLoan(id: string): Promise<void> {
    await api.delete(`/debts-loans/loans/${id}`);
  },
  async repayLoan(id: string, amount: number, note?: string): Promise<void> {
    await api.post(`/debts-loans/loans/${id}/repay`, { amount, note });
  },
};
