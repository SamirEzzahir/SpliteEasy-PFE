"use client";
import {useEffect,useState} from "react";
import {Dialog} from "@/components/ui/dialog";
import {api,apiErrorMessage} from "@/lib/api/client";
import {fmt} from "@/lib/format";
import type {Budget} from "@/lib/api/wallets";

type Entry={id:string;amount:number;description:string;date:string;entry_type:string;currency:string};
export default function BudgetHistory({budget,onClose}:{budget:Budget;onClose:()=>void}) {
  const [rows,setRows]=useState<Entry[]|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setRows(null);setError('');api.get<Entry[]>('/econome/jar/'+budget.id,{params:{currency:budget.currency}}).then(r=>{if(active)setRows(r.data);}).catch(e=>{if(active)setError(apiErrorMessage(e));});return()=>{active=false;};},[budget.id,budget.currency,retry]);
  return <Dialog open onClose={onClose} title={budget.name+' history'} description="Allocations, spending and corrections for this budget.">
    {error?<div role="alert"><p>{error}</p><button className="btn btn-secondary" onClick={()=>setRetry(retry+1)}>Retry</button></div>:rows===null?<div className="sk-block" style={{height:150}} aria-label="Loading budget history"/>:!rows.length?<p>No budget entries yet. Allocate an income to get started.</p>:<div className="mw-events">{rows.map(r=><div className="mw-entry" key={r.id}><div className="mw-entry-text"><b>{r.description}</b><small>{r.date.slice(0,10)} · {r.entry_type}</small></div><strong className={'num '+(r.amount<0?'outgoing':'incoming')}>{fmt(r.amount,r.currency)}</strong></div>)}</div>}
  </Dialog>;
}
