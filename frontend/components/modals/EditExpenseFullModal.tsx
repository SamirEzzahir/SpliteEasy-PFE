"use client";
import ExpenseForm from "./ExpenseForm";
import { expensesApi } from "@/lib/api/expenses";
import { expenseTimestamp } from "@/lib/expense-date";
import type { Expense } from "@/lib/types";
export default function EditExpenseFullModal({ expense, onClose, onSaved, showToast }: {
  expense: Expense; onClose: () => void; onSaved: () => Promise<void>;
  showToast: (message: string, type?: "success" | "error" | "info" | "warning") => void;
}) {
  return <ExpenseForm initial={expense} onClose={onClose} onSubmit={async (updated) => {
    await expensesApi.update(expense.id, {
      description: updated.title, amount: updated.amount, category: updated.categoryId,
      note: updated.note, created_at: expenseTimestamp(updated.date, updated._rawDate),
      payer_id: updated.paidBy, group_id: updated.groupId,
      split_type: updated.splitType === "custom" ? "share" : updated.splitType,
      wallet_id: updated.walletId,
      jar_type: updated.jarType,
      is_from_jar: updated.isFromJar,
      splits: updated.splitIds.map((id) => ({ user_id: id, share_amount: updated.splitAmounts![id] })),
    });
    showToast("Expense updated", "success");
    try { await onSaved(); } catch { showToast("Saved. Refresh the page to see the updated expense.", "info"); }
  }} />;
}
