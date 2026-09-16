"use client";
import { usePreferences } from "@/hooks/usePreferences";
import { useId, useState } from "react";
import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/api/client";
import { walletsApi, moneyApi, moneyChanged, MONEY_CURRENCIES, type Wallet, type WalletType, type WalletSettlement, type Budget } from "@/lib/api/wallets";
import { fmt } from "@/lib/format";
import {useBudgetPlans} from "./BudgetPlans";
import { useWalletPrivacy } from "@/hooks/useWalletPrivacy";

export type MoneyAction = "wallet" | "income" | "spending" | "transfer" | "receive" | "edit" | "adjust" | "budget-transfer";
const TITLES: Record<MoneyAction,string> = {wallet:"Create wallet",income:"Add income",spending:"Record spending",transfer:"Transfer between wallets",receive:"Record a shared payment",edit:"Edit wallet",adjust:"Adjust balance","budget-transfer":"Move budget allocation"};

export default function MoneyForm({action,wallets,types,currency,settlements,budgets,initial,onClose,onSaved}: {
  action: MoneyAction; wallets: Wallet[]; types: WalletType[]; currency: string; settlements: WalletSettlement[]; budgets: Budget[];
  initial?: Wallet; onClose:()=>void; onSaved:()=>void;
}) {
  usePreferences();
  const formId=useId();
  const {balancesHidden,formatBalance}=useWalletPrivacy();
  const [key]=useState(()=>crypto.randomUUID());
  const [recordedAt]=useState(()=>new Date());
  const active=wallets.filter(w=>!w.archived_at && w.currency===currency);
  const [name,setName]=useState(initial?.name || "");
  const [typeId,setTypeId]=useState(initial?.wallet_type_id || types.find(t=>t.user_id===null && t.name.toLowerCase()==="cash")?.id || "");
  const [allTypes,setAllTypes]=useState(types);
  const [addingType,setAddingType]=useState(false);
  const [newType,setNewType]=useState("");
  const [typeBusy,setTypeBusy]=useState(false);
  const [typeMessage,setTypeMessage]=useState("");
  const [typeError,setTypeError]=useState("");
  const [walletCurrency,setWalletCurrency]=useState(initial?.currency || currency);
  const [amount,setAmount]=useState(action==="wallet" ? "0" : action==="adjust" ? (balancesHidden ? "" : initial?.balance || "0") : "");
  const [description,setDescription]=useState("");
  const [date,setDate]=useState(()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10));
  const [from,setFrom]=useState(initial?.id || active[0]?.id || "");
  const [to,setTo]=useState(active[1]?.id || "");
  const [source,setSource]=useState("");
  const [allocate,setAllocate]=useState(false);
  const {plans}=useBudgetPlans();
  const [strategyId,setStrategyId]=useState("");
  const [jar,setJar]=useState("");
  const [toJar,setToJar]=useState("FFA");
  const [settlementId,setSettlementId]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const wallet=active.find(w=>w.id===from);
  const isWallet=action==="wallet" || action==="edit";
  const needsWallet=["income","spending","transfer","receive"].includes(action);
  const blocked=needsWallet && !active.length || action==="transfer" && active.length<2 || action==="receive" && !settlements.length;
  async function addType() {
    if(typeBusy) return;
    if(!newType.trim()) { setTypeError("Enter a wallet type."); return; }
    setTypeBusy(true); setTypeError("");
    try { const created=await walletsApi.createType(newType.trim()); setAllTypes(current=>current.some(t=>t.id===created.id)?current:[...current,created]); setTypeId(created.id); setAddingType(false); setNewType(""); setTypeMessage(`${created.name} saved to your types. Only visible to you.`); }
    catch(error) { setTypeError(apiErrorMessage(error)); } finally { setTypeBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if(saving || typeBusy || blocked) return;
    if(addingType && newType.trim()) { setError("Create your new wallet type first, or cancel the new type."); return; }
    setSaving(true); setError("");
    try {
      const now=recordedAt;
      const today=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
      const occurredAt=date===today?now:new Date(`${date}T12:00:00`);
      const record={amount,description:description.trim(),date:occurredAt.toISOString(),idempotency_key:key};
      if(action==="wallet") await walletsApi.create({name:name.trim(),wallet_type_id:typeId,currency:walletCurrency,balance:amount,idempotency_key:key});
      else if(action==="edit" && initial) await walletsApi.update(initial.id,{name:name.trim(),...(typeId!==initial.wallet_type_id?{wallet_type_id:typeId}:{}),...(!initial.currency?{currency:walletCurrency}:{})});
      else if(action==="adjust" && initial) await walletsApi.adjustment(initial.id,{balance:amount,description:description.trim(),idempotency_key:key});
      else if(action==="income") await moneyApi.record("income",{...record,wallet_id:from,source:source.trim() || "Other income",allocate,strategy_id:strategyId || null});
      else if(action==="spending") await moneyApi.record("spending",{...record,wallet_id:from,jar_type:jar || null});
      else if(action==="transfer") await moneyApi.record("transfer",{...record,description:description.trim() || "Wallet transfer",from_wallet_id:from,to_wallet_id:to});
      else if(action==="budget-transfer") await moneyApi.record("budgets/transfer",{...record,description:description.trim() || "Budget transfer",from_jar:jar,to_jar:toJar,currency});
      else if(action==="receive") { const settlement=settlements.find(s=>`${s.scope}/${s.id}`===settlementId); if(!settlement) throw new Error("Choose a confirmed payment"); await moneyApi.receive(settlement,from,key); }
      moneyChanged(); onSaved();
    } catch(error) { setError(apiErrorMessage(error)); } finally { setSaving(false); }
  }
  const walletOptions=active.map(w=><option key={w.id} value={w.id}>{w.name} · {formatBalance(w.balance,w.currency)}</option>);
  return <Dialog open onClose={onClose} busy={saving || typeBusy} title={TITLES[action]} className="money-dialog"
    description={isWallet?"A place you keep money, visible only to you.":action==="receive"?"Choose a confirmed payment you have actually received or paid.":"Record the money that actually moved."}
    footer={<><button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving || typeBusy}>Cancel</button><button className="btn btn-primary" type="submit" form={formId} disabled={saving || typeBusy || blocked}>{saving?"Saving…":action==="wallet"?"Create wallet":"Save record"}</button></>}>
    {blocked?<div className="empty-state"><p>{action==="receive" && active.length ? "No unrecorded, confirmed shared payments for this currency." : action==="transfer" ? "Create two wallets in the same currency to transfer money." : `Create a ${currency} wallet first.`}</p><Link className="btn btn-secondary" href={action==="receive" && active.length?"/settlements":"/money/wallets"} onClick={onClose}>{action==="receive" && active.length?"View settlements":"View wallets"}</Link></div>:<form id={formId} className="expense-form" onSubmit={submit}><fieldset disabled={saving || typeBusy}>
      {isWallet?<><label>Wallet name<input required autoFocus maxLength={50} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Upwork earnings" /></label>
        <label><span id={`${formId}-type`}>Wallet type</span><select aria-labelledby={`${formId}-type`} required value={typeId} onChange={e=>setTypeId(e.target.value)}><option value="" disabled>Choose a type</option>{initial && !allTypes.some(t=>t.id===initial.wallet_type_id) && <option value={initial.wallet_type_id}>{initial.category} (archived type)</option>}{allTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <p className="field-help">Cash and Bank are defaults. Your custom types belong only to you.</p>
        <button type="button" className="btn btn-ghost" aria-expanded={addingType} onClick={()=>{setAddingType(!addingType);setNewType("");}}>{addingType?"Cancel new type":"Add wallet type"}</button>
        {addingType && <div className="money-type-form"><label>New wallet type<input value={newType} maxLength={50} onChange={e=>setNewType(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void addType();}}} placeholder="Freelancing, Gift, Prime…" /></label><p className="field-help">Only visible to you. Saved even if you cancel this wallet.</p><button className="btn btn-secondary" type="button" onClick={()=>void addType()}>Create type</button>{typeError && <p className="form-error" role="alert">{typeError}</p>}</div>}
        {typeMessage && <p className="field-help" role="status">{typeMessage}</p>}
        <label>Currency<select value={walletCurrency} onChange={e=>setWalletCurrency(e.target.value)} disabled={!!initial?.currency}>{MONEY_CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></label>
      </>:null}
      {needsWallet && <label>{action==="income" || action==="receive"?"Record in wallet":"Paid from wallet"}<select required value={from} onChange={e=>setFrom(e.target.value)}><option value="" disabled>Choose a wallet</option>{walletOptions}</select></label>}
      {action==="transfer" && <label>To wallet<select required value={to} onChange={e=>setTo(e.target.value)}><option value="" disabled>Choose a wallet</option>{walletOptions}</select></label>}
      {action!=="edit" && action!=="receive" && <label>{action==="wallet"?`Opening balance (${walletCurrency})`:action==="adjust"?`Correct balance (${initial?.currency || currency})`:`Amount (${currency})`}<input type="number" inputMode="decimal" min={action==="wallet" || action==="adjust"?"0":"0.01"} max="9999999999.99" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" /></label>}
      {action==="wallet" && <p className="field-help">Money already held in this wallet. This is an opening balance, not income.</p>}
      {!isWallet && action!=="receive" && <label>{action==="adjust"?"Reason for adjustment":"Description"}<input required={!['transfer','budget-transfer'].includes(action)} maxLength={255} value={description} onChange={e=>setDescription(e.target.value)} placeholder={action==="adjust"?"e.g. Corrected my opening balance":"e.g. Groceries"} /></label>}
      {action==="income" && <><label>Income source<input maxLength={50} value={source} onChange={e=>setSource(e.target.value)} placeholder="Salary, Freelancing, Gift…" /></label><label className="money-checkbox"><input type="checkbox" checked={allocate} onChange={e=>setAllocate(e.target.checked)} />Allocate this income to my six-jar plan</label><p className="field-help">55% essentials, 10% each for freedom, learning, long-term saving and play, 5% giving. Uses the same income once.</p></>}
      {action==="income" && allocate && <label>Budget plan<select value={strategyId} onChange={e=>setStrategyId(e.target.value)}><option value="">Six-jar default (55/10/10/10/10/5)</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      {(action==="spending" || action==="budget-transfer") && <label>{action==="spending"?"Budget (optional)":"From budget"}<select required={action==="budget-transfer"} value={jar} onChange={e=>setJar(e.target.value)}><option value="">{action==="spending"?"No budget":"Choose a budget"}</option>{budgets.map(b=><option key={b.id} value={b.id}>{b.name} · {fmt(Number(b.balance),currency)}</option>)}</select></label>}
      {action==="budget-transfer" && <label>To budget<select required value={toJar} onChange={e=>setToJar(e.target.value)}>{budgets.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      {action==="receive" && <label>Confirmed payment<select required value={settlementId} onChange={e=>setSettlementId(e.target.value)}><option value="">Choose a payment</option>{settlements.map(s=><option key={`${s.scope}/${s.id}`} value={`${s.scope}/${s.id}`}>{s.direction==="received"?"Received from":"Paid to"} {s.person} · {fmt(Number(s.amount),s.currency)}</option>)}</select></label>}
      {['income','spending','transfer','budget-transfer'].includes(action) && <label>Date<input type="date" required value={date} onChange={e=>setDate(e.target.value)} /></label>}
      {wallet && ['income','spending'].includes(action) && Number(amount)>0 && <p className="money-result">{wallet.name} after this record: <strong>{formatBalance(Number(wallet.balance)+(action==="income"?1:-1)*Number(amount),currency)}</strong></p>}
      {action==="transfer" && <p className="field-help">Moving money between your wallets keeps the combined balance the same.</p>}
      {action==="spending" && <p className="field-help">For a shared bill, use <Link href="/expenses" onClick={onClose}>Add Expense</Link> to choose a group and people.</p>}
    </fieldset>{error && <p className="form-error" role="alert">{error}</p>}</form>}
  </Dialog>;
}
