"use client";
// app/admin/support/[id]/page.tsx — admin ticket workspace: conversation + manage
// (reply, status, priority, assign, resolve/close/reopen).

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/Icon";
import Skeleton from "@/components/Skeleton";
import Thread from "@/components/support/Thread";
import {
  StatusBadge, PriorityBadge, CategoryBadge, fmtWhen,
  STATUS_LABELS, PRIORITY_LABELS,
} from "@/components/support/ui";
import { promptSelect } from "@/components/admin/ui";
import { usePerms } from "@/components/admin/usePerms";
import { useAuth } from "@/lib/auth/AuthContext";
import { adminApi } from "@/lib/api/admin";
import type { TicketDetail } from "@/lib/api/support";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

export default function AdminTicketPage() {
  const params = useParams<{ id: string }>();
  const ticketId = Number(params.id);
  const { has } = usePerms();
  const { user } = useAuth();
  const canManage = has("manage_support");

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [assignees, setAssignees] = useState<{ id: number; username: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setTicket(await adminApi.ticket(ticketId)); }
    catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (canManage) adminApi.ticketAssignees().then(setAssignees).catch(() => {});
  }, [canManage]);

  async function sendReply(body: string) {
    try { await adminApi.ticketReply(ticketId, body); await load(); }
    catch (e) { toast.error(apiErrorMessage(e)); throw e; }
  }

  async function changeStatus() {
    const next = await promptSelect({ title: "Set status", options: STATUS_LABELS, confirmText: "Apply" });
    if (next === null) return;
    try { await adminApi.ticketStatus(ticketId, next); toast.success("Status updated"); void load(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  async function changePriority() {
    const next = await promptSelect({ title: "Set priority", options: PRIORITY_LABELS, confirmText: "Apply" });
    if (next === null) return;
    try { await adminApi.ticketPriority(ticketId, next); toast.success("Priority updated"); void load(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  async function assign() {
    const options: Record<string, string> = { "": "— Unassigned —" };
    assignees.forEach((a) => { options[String(a.id)] = a.username; });
    const choice = await promptSelect({ title: "Assign ticket", options, confirmText: "Assign" });
    if (choice === null) return;
    try { await adminApi.ticketAssign(ticketId, choice === "" ? null : Number(choice)); toast.success("Assignment updated"); void load(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  async function quickStatus(status: string, label: string) {
    try { await adminApi.ticketStatus(ticketId, status); toast.success(label); void load(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  const closed = ticket?.status === "closed";

  return (
    <div>
      <PageHeader
        title={ticket ? ticket.subject : "Ticket"}
        breadcrumbs={[{ label: "Support", href: "/admin/support" }, { label: ticket ? `#${ticket.id}` : "…" }]}
      />

      {loading || !ticket ? (
        <div className="card" style={{ padding: 22 }}>
          <Skeleton width="40%" height={20} />
          <Skeleton width="80%" height={14} style={{ marginTop: 14 }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 18, alignItems: "start" }} className="admin-detail-grid">
          {/* Conversation */}
          <div className="card" style={{ padding: 18 }}>
            <Thread
              requesterId={ticket.user_id}
              requesterName={ticket.requester_username || `User #${ticket.user_id}`}
              description={ticket.message}
              descriptionDate={ticket.created_at}
              replies={ticket.replies}
              meId={Number(user?.id ?? -1)}
              onSend={canManage && !closed ? sendReply : undefined}
              disabled={closed}
              disabledNote="This ticket is closed. Reopen it to continue the conversation."
              placeholder="Reply to the user…"
            />
          </div>

          {/* Meta + actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 12px" }}>Details</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <CategoryBadge category={ticket.category} />
              </div>
              <dl className="admin-kv">
                <dt>Requester</dt><dd>{ticket.requester_username || `#${ticket.user_id}`}</dd>
                <dt>Assignee</dt><dd>{ticket.assignee_username || "Unassigned"}</dd>
                <dt>Opened</dt><dd>{fmtWhen(ticket.created_at)}</dd>
                <dt>Updated</dt><dd>{fmtWhen(ticket.updated_at)}</dd>
              </dl>
            </div>

            {canManage && (
              <div className="card" style={{ padding: 18 }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 12px" }}>Manage</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="btn btn-ghost admin-action-btn" onClick={changeStatus}><Icon name="settle" size={15} /> Change status</button>
                  <button className="btn btn-ghost admin-action-btn" onClick={changePriority}><Icon name="alertTriangle" size={15} /> Change priority</button>
                  <button className="btn btn-ghost admin-action-btn" onClick={assign}><Icon name="friends" size={15} /> Assign</button>
                  {ticket.status !== "resolved" && !closed && (
                    <button className="btn btn-ghost admin-action-btn" onClick={() => quickStatus("resolved", "Marked resolved")}><Icon name="check" size={15} /> Mark resolved</button>
                  )}
                  {!closed ? (
                    <button className="btn admin-action-btn" style={{ color: "var(--rose)", background: "var(--rose-soft)" }} onClick={() => quickStatus("closed", "Ticket closed")}><Icon name="x" size={15} /> Close ticket</button>
                  ) : (
                    <button className="btn btn-ghost admin-action-btn" onClick={() => quickStatus("open", "Ticket reopened")}><Icon name="plus" size={15} /> Reopen ticket</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
