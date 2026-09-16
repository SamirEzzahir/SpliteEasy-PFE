"use client";
import { fmtNumber } from "@/lib/format";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Wallet as WalletIcon, Landmark, Banknote, Plus, ChevronRight, ChevronLeft, LockKeyhole, Archive, Pencil, SlidersHorizontal, List, PieChart } from "lucide-react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import PageHeader from "@/components/ui/PageHeader";
import PageTabs from "@/components/ui/PageTabs";
import StatCard from "@/components/ui/StatCard";
import FilterDropdown from "@/components/ui/FilterDropdown";
import Pagination from "@/components/ui/Pagination";
import { Dialog } from "@/components/ui/dialog";
import MoneyForm, { type MoneyAction } from "./MoneyForm";
import WalletVisibilityButton from "./WalletVisibilityButton";
import { useWalletPrivacy, MASKED_BALANCE } from "@/hooks/useWalletPrivacy";
import BudgetPlans from "./BudgetPlans";
import BudgetHistory from "./BudgetHistory";
import { EventList, WalletChart, EVENT_LABELS, walletTone, money } from "./MoneyActivity";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import { usePublicSettings } from "@/lib/public-settings";
import { apiErrorMessage } from "@/lib/api/client";
import { walletsApi, moneyApi, moneyChanged, MONEY_CURRENCIES, type Wallet, type WalletType, type MoneyEvent, type MoneySummary, type MoneyActivity, type Budget, type WalletSettlement } from "@/lib/api/wallets";

type Section = "overview" | "wallets" | "activity" | "budgets";
type Data = {owner:string; context:string; wallets:Wallet[]; types:WalletType[]; summary:MoneySummary; activity:MoneyActivity; budgets:Budget[]; settlements:WalletSettlement[]};
const SECTIONS: {value:Section;label:string}[]=[{value:"overview",label:"Overview"},{value:"wallets",label:"Wallets"},{value:"activity",label:"Activity"},{value:"budgets",label:"Budgets"}];
const ACTIONS = [["income","Add income",ArrowDownLeft],["spending","Add expense",ArrowUpRight],["transfer","Transfer",ArrowLeftRight],["wallet","Create wallet",Plus],["receive","Record reimbursement",WalletIcon]] as const;

export default function MoneyPage({view}:{view:string[]}) {
  const {user}=useAuth(); const {feature}=usePublicSettings(); const router=useRouter();
  const {balancesHidden, formatBalance}=useWalletPrivacy();
  const section=(SECTIONS.some(s=>s.value===view[0])?view[0]:"overview") as Section;
  const detailId=section==="wallets"?view[1]:undefined;
  const {currency:preferredCurrency}=usePreferences();
  const [currencyChoice,setCurrency]=useState<string|null>(null);
  const currency=currencyChoice || preferredCurrency;
  const [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7));
  const [page,setPage]=useState(1), [walletFilter,setWalletFilter]=useState(""), [kind,setKind]=useState("");
  const [data,setData]=useState<Data|null>(null), [loading,setLoading]=useState(true), [error,setError]=useState("");
  const [revision,setRevision]=useState(0), [action,setAction]=useState<MoneyAction|null>(null), [quick,setQuick]=useState(false);
  const [typesOpen,setTypesOpen]=useState(false), [typeEdit,setTypeEdit]=useState<WalletType|null>(null);
  const [typeName,setTypeName]=useState(""), [typeError,setTypeError]=useState(""), [busy,setBusy]=useState(false);
  const [showArchived,setShowArchived]=useState(false);
  const [plansOpen,setPlansOpen]=useState(false);
  const [budgetHistory,setBudgetHistory]=useState<Budget|null>(null);
  const carousel=useRef<HTMLDivElement>(null);
  const [scrollPosition,setScrollPosition]=useState({first:true,last:true});
  const context=JSON.stringify([currency,month,page,walletFilter,kind,detailId]);
  useEffect(()=>{setPage(1);setWalletFilter("");setKind("");},[section,detailId]);
  const refresh=useCallback(()=>setRevision(v=>v+1),[]);
  useEffect(()=>{const open=()=>setQuick(true);window.addEventListener("money:open-actions",open);return()=>window.removeEventListener("money:open-actions",open);},[]);
  useEffect(()=>{window.addEventListener("money:changed",refresh);window.addEventListener("focus",refresh);return()=>{window.removeEventListener("money:changed",refresh);window.removeEventListener("focus",refresh);};},[refresh]);
  useEffect(()=>{let cancelled=false;if(!user)return;setLoading(true);setError("");
    Promise.all([walletsApi.list(true),walletsApi.types(),moneyApi.summary(currency,month),moneyApi.activity({month,currency:detailId?undefined:currency,wallet_id:detailId || walletFilter || undefined,kind:kind || undefined,page,limit:20}),moneyApi.budgets(currency),moneyApi.settlements(currency)])
      .then(([wallets,types,summary,activity,budgets,settlements])=>{if(!cancelled)setData({owner:user.id,context,wallets,types,summary,activity,budgets,settlements});})
      .catch(error=>{if(!cancelled){setError(apiErrorMessage(error));setData(null);}}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[user?.id,currency,month,page,walletFilter,kind,detailId,revision]);
  const current=data && data.owner===user?.id && data.context===context?data:null, selected=current?.wallets.find(w=>w.id===detailId);
  useEffect(()=>{if(selected?.currency && MONEY_CURRENCIES.includes(selected.currency))setCurrency(selected.currency);},[selected?.currency]);
  const syncScroll=()=>{const el=carousel.current;if(el)setScrollPosition({first:el.scrollLeft<=1,last:el.scrollLeft+el.clientWidth>=el.scrollWidth-1});};
  useEffect(()=>{syncScroll();window.addEventListener("resize",syncScroll);return()=>window.removeEventListener("resize",syncScroll);},[current?.wallets,section]);
  const navigate=(next:Section)=>{setPage(1);setWalletFilter("");setKind("");router.push(next==="overview"?"/money":`/money/${next}`);};
  const close=()=>{setAction(null);refresh();};
  async function reverse(event:MoneyEvent) {
    const result=await Swal.fire({title:"Reverse this record?",text:"The wallet and any linked budget changes will be reversed. The original remains in your history.",icon:"question",showCancelButton:true,confirmButtonText:"Reverse record"});
    if(result.isConfirmed)try{await moneyApi.reverse(event);moneyChanged();toast.success("Record reversed");}catch(error){toast.error(apiErrorMessage(error));}
  }
  async function allocate(event:MoneyEvent) {
    const result=await Swal.fire({title:"Allocate this income?",text:"Use the six-jar plan for this income. Your wallet balance stays the same.",showCancelButton:true,confirmButtonText:"Allocate"});
    if(result.isConfirmed)try{await moneyApi.allocate(event.id);moneyChanged();toast.success("Income allocated");}catch(error){toast.error(apiErrorMessage(error));}
  }
  async function archive(wallet:Wallet) {
    const result=await Swal.fire({title:wallet.archived_at?"Restore wallet?":"Archive wallet?",text:wallet.archived_at?"This wallet will become available again.":"The balance must be zero. Every payment and entry will remain in your history.",showCancelButton:true,confirmButtonText:wallet.archived_at?"Restore":"Archive"});
    if(result.isConfirmed)try{await walletsApi.update(wallet.id,{archived:!wallet.archived_at});moneyChanged();}catch(error){toast.error(apiErrorMessage(error));}
  }
  if(!feature("personal_finance"))return <div className="card empty-state"><WalletIcon/><p>My Money is currently unavailable.</p><Link href="/dashboard">Back to dashboard</Link></div>;
  const wallets=current?.wallets.filter(w=>(showArchived || !w.archived_at) && (w.currency===currency || w.needs_currency)) || [];
  const known=wallets.filter(w=>w.currency===currency && !w.archived_at);
  const titles:Record<Section,string>={overview:"My Money",wallets:selected?.name || "My wallets",activity:"Money activity",budgets:"My budgets"};
  const empty=<div className="mw-empty"><WalletIcon size={32}/><h2>Your money starts here</h2><p>Create a wallet for cash, a bank account, or a custom type of your own.</p><button className="btn btn-primary" onClick={()=>setAction("wallet")}><Plus size={16}/>Create wallet</button></div>;
  const activityList=current?.activity.items.length?<EventList events={current.activity.items} onReverse={reverse} onAllocate={allocate}/>:<div className="mw-empty"><List size={30}/><p>No recorded activity for these filters yet.</p><button className="btn btn-secondary" onClick={()=>setAction("income")}>Add income</button></div>;
  return <div className="money-page">
    <PageHeader title={titles[section]} subtitle={<span className="mw-private"><LockKeyhole size={12}/>Only visible to you</span>} actions={<button className="btn btn-primary" onClick={()=>setQuick(true)} disabled={!current}><Plus size={16}/>Add record</button>}/>
    <PageTabs id="money" label="My Money sections" value={section} onChange={navigate} items={SECTIONS}/>
    <div className="mw-toolbar"><FilterDropdown icon="money" label="Currency" value={currency} options={MONEY_CURRENCIES.map(c=>({id:c,label:c}))} onChange={value=>{setCurrency(value);setWalletFilter("");setPage(1);}}/><label className="mw-month-label">Month<input aria-label="Month" type="month" value={month} onChange={e=>setMonth(e.target.value)} /></label><Link className="mw-debts-link" href="/debts-loans">Debts & loans<ChevronRight size={13}/></Link></div>
    {error && <div className="card mw-error" role="alert"><p>{error}</p><button className="btn btn-secondary" onClick={refresh}>Retry</button></div>}
    {!current && loading && <div className="mw-loading" role="status" aria-label="Loading your money"><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div>}
    {current && <section id={`money-panel-${section}`} role="tabpanel" aria-labelledby={`money-${section}`} aria-busy={loading}>
      {(section==="wallets" || section==="overview") && !detailId && <div className="mw-dashboard"><div className="mw-main">
        <section className="mw-accounts"><div className="mw-balance-head"><div><p>Total balance <span>{known.length} wallets</span></p><div className="mw-total-line"><strong className="mw-total num" data-testid="wallet-total" aria-label={balancesHidden?"Balance hidden":undefined}>{formatBalance(current.summary.balance,currency)}</strong><WalletVisibilityButton/></div></div><button className="btn btn-ghost" onClick={()=>{setTypesOpen(true);setTypeError("");}}>Wallet types</button></div>
          {wallets.length?<><div className="mw-carousel" ref={carousel} onScroll={syncScroll} tabIndex={0} role="region" aria-label="Your wallets">{wallets.map(w=><article key={w.id} className={`mw-wallet ${walletTone(w)}`}><div className="mw-wallet-top">{walletTone(w)==="bank"?<Landmark size={24}/>:walletTone(w)==="cash"?<Banknote size={24}/>:<WalletIcon size={24}/>}<span title={w.category}>{w.category}</span></div><h2>{w.name}</h2><strong className="num">{balancesHidden?MASKED_BALANCE:w.needs_currency?fmtNumber(Number(w.balance)):formatBalance(w.balance,w.currency)}</strong><div className="mw-wallet-bottom"><small>{w.needs_currency?"Confirm currency":w.archived_at?"Archived wallet":`Personal wallet · ${w.currency}`}</small><Link href={`/money/wallets/${w.id}`} aria-label={`View ${w.name}`}><ChevronRight size={18}/></Link></div></article>)}</div><div className="mw-carousel-controls"><span>Balances you record, kept in one place.</span><div><button disabled={scrollPosition.first} aria-label="Previous wallet" onClick={()=>carousel.current?.scrollBy({left:-320,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}><ChevronLeft size={16}/></button><button disabled={scrollPosition.last} aria-label="Next wallet" onClick={()=>carousel.current?.scrollBy({left:320,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}><ChevronRight size={16}/></button></div></div></>:empty}
          {wallets.some(w=>w.needs_currency) && <p className="field-help">Confirm older wallets&apos; currencies in their details to include them in totals.</p>}
          {current.wallets.some(w=>w.archived_at) && <label className="mw-show-archived"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>Show archived wallets</label>}
          <div className="mw-quick-actions">{ACTIONS.slice(0,4).map(([value,label,Icon])=><button key={value} onClick={()=>setAction(value)}><span className={value}><Icon size={18}/></span>{label}</button>)}</div>
        </section>
        <section className="card mw-feed"><div className="mw-cardhead"><div><h2>Recent activity</h2><p>Your latest money movements</p></div><button className="btn btn-ghost" onClick={()=>navigate("activity")}>View all<ArrowUpRight size={14}/></button></div>{current.activity.items.length?<EventList events={current.activity.items.slice(0,5)} onReverse={reverse} onAllocate={allocate}/>:activityList}</section>
      </div><aside className="mw-rail">
        <section className="mw-month"><div className="mw-cardhead"><h2>This month</h2><span>{month}</span></div><div className="ui-stat-grid cols-2"><StatCard icon="download" tone="success" label="Income" value={Number(current.summary.income)} currency={currency} sub="Money earned"/><StatCard icon="upload" tone="danger" label="Your spending" value={Number(current.summary.spending)} currency={currency} sub="Your share only"/></div></section>
        <section className="card mw-breakdown"><div className="mw-cardhead"><div><h2>Where your money is</h2><p>Your balance across wallets</p></div><PieChart size={18}/></div><WalletChart wallets={known} currency={currency}/></section>
        <section className="card mw-receivable"><ArrowLeftRight size={22}/><div><h2>Shared bills balance</h2><strong className="num">{money(current.summary.owed_to_you,currency)}</strong><p>Net amount still owed to you. Your wallet increases when you record a confirmed receipt.</p>{Number(current.summary.you_owe)>0 && <p>You owe {money(current.summary.you_owe,currency)}.</p>}<button className="btn btn-ghost" onClick={()=>setAction("receive")}>Record reimbursement<ArrowUpRight size={13}/></button></div></section>
      </aside></div>}
      {section==="wallets" && detailId && (selected?<><div className="card mw-detail"><div><span className="field-help">{selected.category} · {selected.archived_at?"Archived":"Private wallet"}</span><div className="mw-total-line"><h2>{selected.needs_currency?"Confirm this wallet's currency":formatBalance(selected.balance,selected.currency)}</h2><WalletVisibilityButton/></div></div><div className="mw-detail-actions"><button className="btn btn-secondary" onClick={()=>setAction("edit")}><Pencil size={14}/>Edit wallet</button><button className="btn btn-secondary" disabled={selected.needs_currency || !!selected.archived_at} onClick={()=>setAction("adjust")}><SlidersHorizontal size={14}/>Adjust balance</button><button className="btn btn-secondary" onClick={()=>void archive(selected)}><Archive size={14}/>{selected.archived_at?"Restore":"Archive"}</button></div></div><div className="card mw-feed"><h2>Wallet history</h2>{activityList}</div></>:<div className="card mw-empty"><WalletIcon/><p>Wallet not found.</p><Link href="/money/wallets">Back to wallets</Link></div>)}
      {section==="activity" && <section className="card mw-feed"><div className="mw-cardhead"><h2>Money activity</h2></div><div className="mw-filters"><FilterDropdown icon="wallet" label="Wallet" value={walletFilter} options={[{id:"",label:"All wallets"},...current.wallets.filter(w=>w.currency===currency).map(w=>({id:w.id,label:w.name}))]} onChange={id=>{setWalletFilter(id);setPage(1);}}/><FilterDropdown icon="filter" label="Type" value={kind} options={[{id:"",label:"All types"},...Object.entries(EVENT_LABELS).map(([id,label])=>({id,label}))]} onChange={id=>{setKind(id);setPage(1);}}/></div>{activityList}</section>}
      {(section==="activity" || !!detailId) && <Pagination page={page} totalPages={Math.max(1,Math.ceil(current.activity.total/20))} onChange={setPage} summary={`${current.activity.total} records`}/>}
      {section==="budgets" && <><section className="card mw-budget-intro"><div><h2>Give your money a purpose</h2><p>Wallets show where your money is. Budgets show what you plan to use it for.</p></div><button className="btn btn-secondary" onClick={()=>setAction("budget-transfer")}><ArrowLeftRight size={16}/>Move allocation</button></section><div className="mw-budget-grid">{current.budgets.map(b=><article className="card mw-budget" key={b.id}><span className="mw-budget-percent">{b.percent}% default plan</span><h2>{b.name}</h2><strong className={`num${Number(b.balance)<0?" outgoing":""}`}>{money(b.balance,currency)}</strong><p>Remaining · {money(b.allocated,currency)} allocated</p><progress aria-label={`${b.name} spending`} max={Math.max(1,Number(b.allocated))} value={Math.min(Math.max(0,Number(b.spent)),Math.max(1,Number(b.allocated)))}/><small>{money(b.spent,currency)} spent</small><button className="btn btn-ghost" onClick={()=>setBudgetHistory(b)}>View history</button></article>)}</div><div className="card mw-budget-intro"><div><h2>Fund your budgets once</h2><p>Allocate when adding income, or choose an income record from Activity. Transfers and reimbursements never count as new income.</p></div><button className="btn btn-primary" onClick={()=>setAction("income")}>Add income</button></div><button className="btn btn-secondary" onClick={()=>setPlansOpen(true)}>Manage budget plans</button></>}
    </section>}
    {budgetHistory && <BudgetHistory budget={budgetHistory} onClose={()=>setBudgetHistory(null)}/>}
    {plansOpen && <BudgetPlans onClose={()=>{setPlansOpen(false);refresh();}}/>}
    {current && action && <MoneyForm key={`${action}-${detailId || ''}`} action={action} wallets={current.wallets} types={current.types} currency={currency} initial={selected} settlements={current.settlements} budgets={current.budgets} onClose={close} onSaved={()=>{close();toast.success("Money record saved");}}/>}
    <Dialog open={quick} onClose={()=>setQuick(false)} title="What would you like to add?" description="Keep your money up to date." className="money-dialog"><div className="mw-action-sheet">{ACTIONS.map(([value,label,Icon])=><button key={value} onClick={()=>{setQuick(false);setAction(value);}}><span className={`mw-entry-icon ${value==='income'?'incoming':''}`}><Icon size={20}/></span><span><b>{label}</b></span><ChevronRight size={16}/></button>)}</div></Dialog>
    <Dialog open={typesOpen} onClose={()=>{setTypesOpen(false);setTypeEdit(null);refresh();}} busy={busy} title="Your wallet types" description="Cash and Bank are shared defaults. Custom types belong only to you."><div className="expense-form">{current?.types.map(type=><div className="mw-type-row" key={type.id}><span>{type.name}<small>{type.user_id?"Only visible to you":"System default"}</small></span>{type.user_id && <><button className="btn btn-ghost" disabled={busy} onClick={()=>{setTypeEdit(type);setTypeName(type.name);setTypeError("");}}>Rename</button><button className="btn btn-ghost" disabled={busy} onClick={async()=>{setBusy(true);setTypeError("");try{await walletsApi.archiveType(type.id);refresh();}catch(error){setTypeError(apiErrorMessage(error));}finally{setBusy(false);}}}>Archive</button></>}</div>)}{typeEdit && <form onSubmit={async e=>{e.preventDefault();setBusy(true);setTypeError("");try{await walletsApi.renameType(typeEdit.id,typeName.trim());setTypeEdit(null);refresh();}catch(error){setTypeError(apiErrorMessage(error));}finally{setBusy(false);}}}><label>Type name<input required maxLength={50} value={typeName} onChange={e=>setTypeName(e.target.value)}/></label><button type="submit" className="btn btn-primary" disabled={busy}>Save type</button></form>}{typeError && <p role="alert" className="form-error">{typeError}</p>}<button className="btn btn-secondary" onClick={()=>{setTypesOpen(false);setAction("wallet");}}>Create wallet or type</button></div></Dialog>
  </div>;
}
