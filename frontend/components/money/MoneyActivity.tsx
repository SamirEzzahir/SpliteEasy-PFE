"use client";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, Receipt, RotateCcw } from "lucide-react";
import { fmt } from "@/lib/format";
import { useWalletPrivacy } from "@/hooks/useWalletPrivacy";
import type { MoneyEvent, Wallet } from "@/lib/api/wallets";
export const EVENT_LABELS:Record<string,string>={opening:"Opening balance",income:"Income",spending:"Spending",shared_expense:"Shared expense",transfer:"Transfer",reimbursement:"Reimbursement",settlement:"Shared payment",adjustment:"Adjustment",reversal:"Reversal",budget_transfer:"Budget transfer",loan:"Loan",debt:"Borrowing",repayment:"Repayment"};
export const walletTone=(wallet:Wallet)=>wallet.category.toLowerCase()==="bank"?"bank":wallet.category.toLowerCase()==="cash"?"cash":"custom";
const color=(wallet:Wallet)=>walletTone(wallet)==="bank"?"var(--primary)":walletTone(wallet)==="cash"?"var(--success)":"var(--amber)";
export const money=(value:string|number,currency:string|null)=>fmt(Number(value),currency || "MAD");
export function WalletChart({wallets,currency}:{wallets:Wallet[];currency:string}) {
  const {balancesHidden,formatBalance}=useWalletPrivacy();
  const total=wallets.reduce((sum,w)=>sum+Number(w.balance),0);let offset=0;
  return <><div className="mw-chart"><svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="80" fill="none" stroke="var(--line)" strokeWidth="18" />{wallets.filter(w=>Number(w.balance)>0).map(w=>{const pct=total>0?Number(w.balance)/total*100:0;const start=offset;offset+=pct;const length=Math.max(0,pct-(pct<100?Math.min(1.5,pct/4):0));return <circle key={w.id} cx="100" cy="100" r="80" fill="none" stroke={color(w)} strokeWidth="18" pathLength="100" strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-start}/>;})}</svg><div><span>Total balance</span><strong className="num">{formatBalance(total,currency)}</strong></div></div><ul className="mw-legend">{wallets.map(w=><li key={w.id}><i style={{background:color(w)}} aria-hidden="true"/><span>{w.name}<small>{w.category}</small></span><b className="num">{formatBalance(w.balance,currency)}<small>{balancesHidden?"—":`${total?(Number(w.balance)/total*100).toFixed(1):"0"}%`}</small></b></li>)}</ul></>;
}
export function EventList({events,onReverse,onAllocate}:{events:MoneyEvent[];onReverse:(event:MoneyEvent)=>void;onAllocate:(event:MoneyEvent)=>void}) {
  let date="";
  return <div className="mw-events">{events.map(event=>{
    const keyDate=event.date.slice(0,10);const heading=keyDate!==date;date=keyDate;
    const delta=event.entries.reduce((sum,entry)=>sum+Number(entry.amount),0);
    const outgoing=(["repayment","adjustment","reversal"].includes(event.kind) && delta<0) || ["spending","shared_expense","settlement","loan"].includes(event.kind),incoming=(["repayment","adjustment","reversal"].includes(event.kind) && delta>0) || ["income","reimbursement","debt"].includes(event.kind);
    const icon=outgoing?<Receipt size={18}/>:incoming?<ArrowDownLeft size={18}/>:<ArrowLeftRight size={18}/>;
    const reversible=!event.reversed_at && event.source_type!=="income_correction" && ["income","spending","transfer","adjustment","budget_transfer"].includes(event.kind);
    return <div key={event.id}>{heading && <h3 className="mw-date">{new Date(`${keyDate}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</h3>}<div className={`mw-entry${event.reversed_at?" is-reversed":""}`}><span className={`mw-entry-icon ${outgoing?"outgoing":incoming?"incoming":""}`}>{icon}</span><div className="mw-entry-text"><b>{event.description}</b><small>{EVENT_LABELS[event.kind] || event.kind}{event.entries.length?` · ${[...event.entries].sort((a,b)=>Number(a.amount)-Number(b.amount)).map(e=>e.wallet_name).join(" → ")}`:""}{event.reversed_at?" · Reversed":""}</small>{event.source_type==="expense" && <Link href="/expenses">View shared expenses</Link>}</div><div className={`mw-entry-amount num ${outgoing?"outgoing":incoming?"incoming":""}`}><strong>{outgoing?"− ":incoming?"+ ":event.kind==="transfer"?"↔ ":""}{money(event.amount,event.currency)}</strong>{event.personal_share!==null && event.kind==="shared_expense" && <small>Your share {money(event.personal_share,event.currency)}</small>}</div></div>{reversible && <div className="mw-event-actions">{event.kind==="income" && <button type="button" className="btn btn-ghost" onClick={()=>onAllocate(event)}>Allocate to budgets</button>}<button type="button" className="btn btn-ghost" onClick={()=>onReverse(event)}><RotateCcw size={12}/>Reverse record</button></div>}</div>;
  })}</div>;
}
