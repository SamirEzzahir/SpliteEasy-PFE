"use client";

import { Eye, EyeOff } from "lucide-react";
import { useWalletPrivacy } from "@/hooks/useWalletPrivacy";

export default function WalletVisibilityButton() {
  const { balancesHidden, toggleBalances } = useWalletPrivacy();
  const label = balancesHidden ? "Show wallet balances" : "Hide wallet balances";
  return (
    <button type="button" className="btn btn-ghost mw-privacy-toggle"
      onClick={toggleBalances} aria-label={label} title={label} aria-pressed={balancesHidden}>
      {balancesHidden ? <Eye size={20} aria-hidden="true" /> : <EyeOff size={20} aria-hidden="true" />}
    </button>
  );
}
