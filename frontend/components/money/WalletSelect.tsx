"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { walletsApi, type Wallet } from "@/lib/api/wallets";
import { apiErrorMessage } from "@/lib/api/client";
import { useWalletPrivacy } from "@/hooks/useWalletPrivacy";

/** Loaded only inside forms that explicitly offer private wallet tracking. */
export default function WalletSelect({value, onChange, currency = "MAD", label = "Pay from wallet (optional)", direction = "out"}: {
  value: string; onChange: (id: string) => void; currency?: string; label?: string; direction?: "in" | "out";
}) {
  const {user} = useAuth();
  const {formatBalance} = useWalletPrivacy();
  const [result,setResult] = useState<{owner:string; wallets:Wallet[]}|null>(null);
  const [error,setError] = useState("");
  const [retry,setRetry] = useState(0);
  useEffect(() => { let active = true; setResult(null); setError(""); if(user) walletsApi.list().then(wallets => {
    if(active) setResult({owner:user.id,wallets});
  }).catch(error => { if(active) setError(apiErrorMessage(error)); }); return () => { active=false; }; },[user?.id,retry]);
  const wallets = result?.owner === user?.id ? result?.wallets.filter(wallet => wallet.currency === currency) || [] : [];
  return <div className="wallet-select-field"><label>{label}<select value={value} onChange={e=>onChange(e.target.value)} disabled={!result && !error}>
    <option value="">Don&apos;t track in a wallet</option>{value && !wallets.some(wallet=>wallet.id===value) && <option value={value}>Existing wallet (keep current link)</option>}
    {wallets.map(wallet=><option key={wallet.id} value={wallet.id}>{wallet.name} · {formatBalance(wallet.balance,wallet.currency)}</option>)}
  </select></label>{error ? <p role="alert" className="form-error">{error} <button type="button" className="btn btn-ghost" onClick={()=>setRetry(retry+1)}>Retry</button></p> : result && !wallets.length ? <p className="field-help">No active {currency} wallets. <Link href="/money/wallets">Create a wallet</Link> to track this payment.</p> : <p className="field-help">Only you can see this choice. This payment {direction === "in" ? "increases" : "reduces"} your wallet balance.</p>}</div>;
}
