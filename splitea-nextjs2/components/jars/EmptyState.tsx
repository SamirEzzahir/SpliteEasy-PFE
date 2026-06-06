"use client";
// components/jars/EmptyState.tsx

import Icon from "@/components/Icon";

export default function EmptyState({ onLogIncome }: { onLogIncome: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-illustration">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <path
            d="M14 18h36l-3 6v28a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4V24l-3-6z"
            fill="#dcdaff"
            stroke="#5b4ef0"
            strokeWidth="2"
          />
          <path
            d="M22 18v-3a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3"
            stroke="#5b4ef0"
            strokeWidth="2"
            fill="none"
          />
          <path d="M17 36h30" stroke="#5b4ef0" strokeWidth="2" strokeLinecap="round" />
          <circle cx="26" cy="44" r="2.5" fill="#5b4ef0" />
          <circle cx="38" cy="44" r="2.5" fill="#5b4ef0" opacity=".6" />
          <path
            d="M32 6v4M28 8l4 4 4-4"
            stroke="#5b4ef0"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3>Your jars are empty</h3>
      <p>Log your first income to start distributing across your six jars. We'll handle the math.</p>
      <button
        className="btn btn-primary"
        onClick={onLogIncome}
        style={{ padding: "11px 18px", fontSize: 14 }}
      >
        <Icon name="plus" size={14} /> Log Income
      </button>
    </div>
  );
}
