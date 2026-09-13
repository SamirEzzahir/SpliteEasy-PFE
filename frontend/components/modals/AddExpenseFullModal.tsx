"use client";
import ExpenseForm from "./ExpenseForm";
import type { Expense } from "@/lib/types";
export default function AddExpenseFullModal(props: {
  onClose: () => void; onSubmit: (expense: Expense) => void | Promise<void>; defaultGroupId?: string;
}) { return <ExpenseForm {...props} />; }
