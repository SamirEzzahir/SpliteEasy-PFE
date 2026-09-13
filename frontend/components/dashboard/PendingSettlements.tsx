"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { settleApi } from "@/lib/api/settle";
import type { ApiSettlement } from "@/lib/api/types";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth/AuthContext";
import { fmt } from "@/lib/format";

export default function PendingSettlements() {
  const { groups, loading: groupsLoading } = useApp();
  const { user } = useAuth();
  const [items, setItems] = useState<Array<{ payment: ApiSettlement; groupId?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const ids = groups.map((g) => g.id).join(",");
  useEffect(() => {
    if (!user || groupsLoading) return;
    let active = true;
    const groupIds = ids ? ids.split(",") : [];
    setLoading(true);
    Promise.allSettled([settleApi.globalHistory(), ...groupIds.map((id) => settleApi.groupHistory(id))]).then((results) => {
      if (!active) return;
      setFailed(results.some((r) => r.status === "rejected"));
      const seen = new Set<string>();
      setItems(results.flatMap((r, index) => r.status === "fulfilled" ? r.value.filter((p) => {
        if (p.status !== "pending" || p.to_user_id !== user.id || seen.has(p.id)) return false;
        seen.add(p.id); return true;
      }).map((payment) => ({ payment, groupId: index > 0 ? groupIds[index - 1] : undefined })) : []));
      setLoading(false);
    });
    return () => { active = false; };
  }, [ids, user, groupsLoading, retry]);
  return <section className="dash-panel confirmation-panel">
    <div className="dash-panel-head"><h2>Needs your confirmation</h2><Link href="/settlements">View payments</Link></div>
    <p className="field-help">Confirm a payment only after you have received it.</p>
    {loading ? <div className="sk-block" style={{ height: 60 }} aria-label="Loading payments" /> : <>
      {failed && <p role="alert" className="form-error">Some payments could not be loaded. <button className="btn btn-secondary" onClick={() => setRetry((n) => n + 1)}>Retry</button></p>}
      {!failed && !items.length && <p className="field-help">No payments need your confirmation.</p>}
      {items.slice(0, 3).map(({ payment, groupId }) => <Link className="confirmation-row" key={payment.id} href={groupId ? `/groups/${groupId}?tab=balances` : "/settlements"}>
        <span><strong>{payment.from_username || "Group member"} → You</strong><small>Payment recorded · awaiting your confirmation</small></span>
        <strong className="num">{fmt(payment.amount, groups.find((g) => g.id === groupId)?.currency || user?.preferred_currency || "MAD")}</strong>
        <span className="confirmation-link">Review</span>
      </Link>)}
    </>}
  </section>;
}
