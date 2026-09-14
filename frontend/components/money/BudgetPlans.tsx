"use client";
import {useEffect,useState} from "react";
import {Dialog} from "@/components/ui/dialog";
import {api,apiErrorMessage} from "@/lib/api/client";

export type BudgetPlan={id:string;name:string;user_id:string|null;nec:number;ffa:number;edu:number;ltss:number;play:number;give:number};
const jars=[['nec','Essentials',55],['ffa','Financial freedom',10],['edu','Learning',10],['ltss','Long-term saving',10],['play','Play',10],['give','Giving',5]] as const;
export function useBudgetPlans() {
  const [plans,setPlans]=useState<BudgetPlan[]>([]),[error,setError]=useState('');
  useEffect(()=>{let active=true;api.get<BudgetPlan[]>('/econome/strategies').then(r=>{if(active)setPlans(r.data);}).catch(e=>{if(active)setError(apiErrorMessage(e));});return()=>{active=false;};},[]);
  return {plans,error};
}

export default function BudgetPlans({onClose}:{onClose:()=>void}) {
  const {plans,error:loadError}=useBudgetPlans();
  const [name,setName]=useState('My budget plan'),[selected,setSelected]=useState('');
  const [percent,setPercent]=useState<Record<string,string>>(()=>Object.fromEntries(jars.map(([key,,pct])=>[key,String(pct)])));
  const [saving,setSaving]=useState(false),[error,setError]=useState('');
  const total=Object.values(percent).reduce((sum,p)=>sum+Number(p),0);
  function choose(id:string) {
    setSelected(id);const plan=plans.find(p=>p.id===id);setName(plan?plan.name:'My budget plan');
    setPercent(Object.fromEntries(jars.map(([key,,pct])=>[key,String(plan?Math.round(plan[key]*10000)/100:pct)])));
  }
  async function save(e:React.FormEvent) {
    e.preventDefault();if(saving)return;setSaving(true);setError('');
    const data={name:name.trim(),...Object.fromEntries(jars.map(([key])=>[key,Number(percent[key])/100]))};
    try {const plan=plans.find(p=>p.id===selected);if(plan?.user_id)await api.put('/econome/strategies/'+plan.id,data);else await api.post('/econome/strategies',data);onClose();}
    catch(e){setError(apiErrorMessage(e));}finally{setSaving(false);}
  }
  return <Dialog open busy={saving} onClose={onClose} title="Budget plans" description="A plan divides future income. Existing allocations stay as recorded."
    footer={<><button className="btn btn-secondary" disabled={saving} onClick={onClose}>Cancel</button><button form="budget-plan" type="submit" className="btn btn-primary" disabled={saving || Math.abs(total-100)>.001}>Save plan</button></>}>
    <form id="budget-plan" className="expense-form" onSubmit={save}><fieldset disabled={saving}>
      <label>Plan<select value={selected} onChange={e=>choose(e.target.value)}><option value="">Create a plan</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name}{p.user_id?'':' (copy shared plan)'}</option>)}</select></label>
      <label>Plan name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
      {jars.map(([key,label])=><label key={key}>{label} (%)<input required type="number" min="0" max="100" step="0.01" value={percent[key]} onChange={e=>setPercent({...percent,[key]:e.target.value})}/></label>)}
      <p className="field-help">Total: {total.toFixed(2)}% of each income allocation. Choose this plan when you add income.</p>
    </fieldset>{(error || loadError) && <p role="alert" className="form-error">{error || loadError}</p>}</form>
  </Dialog>;
}
