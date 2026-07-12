"use client";
// app/support/[id]/page.tsx — a user's own ticket: details, conversation, close.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/Icon";
import Skeleton from "@/components/Skeleton";
import Thread from "@/components/support/Thread";
import { StatusBadge, PriorityBadge, CategoryBadge, fmtWhen } from "@/components/support/ui";
import { confirmAction } from "@/components/admin/ui";
import { useAuth } from "@/lib/auth/AuthContext";
import { supportApi, type TicketDetail } from "@/lib/api/support";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

export default function SupportTicketPage() {
  const params = useParams<{ id: string }>();
  const ticketId = Number(params.id);
  const { user } = useAuth();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setTicket(await supportApi.get(ticketId));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { void load(); }, [load]);

  async function sendReply(body: string) {
    try {
      await supportApi.reply(ticketId, body);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
      throw e;
    }
  }

  async function closeTicket() {
    const ok = await confirmAction({ title: "Close this ticket?", text: "You can always open a new one later.", confirmText: "Close ticket" });
    if (!ok) return;
    try {
      await supportApi.close(ticketId);
      toast.success("Ticket closed");
      void load();
    } catch (e) { toast.error(apiErrorMessage(e)); }
  }

  const closed = ticket?.status === "closed";

  return (
    <div>
      <PageHeader
        title={ticket ? ticket.subject : "Ticket"}
        breadcrumbs={[{ label: "Support", href: "/support" }, { label: ticket?.subject ?? "…" }]}
        actions={ticket && !closed ? (
          <button className="btn btn-ghost" onClick={closeTicket}><Icon name="check" size={15} /> Close ticket</button>
        ) : undefined}
      />

      {loading || !ticket ? (
        <div className="card" style={{ padding: 22 }}>
          <Skeleton width="40%" height={20} />
          <Skeleton width="80%" height={14} style={{ marginTop: 14 }} />
          <Skeleton width="70%" height={14} style={{ marginTop: 8 }} />
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 18, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <CategoryBadge category={ticket.category} />
            <span style={{ fontSize: 12, color: "var(--ink-4)", marginLeft: "auto" }}>Opened {fmtWhen(ticket.created_at)}</span>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <Thread
              requesterId={ticket.user_id}
              requesterName={ticket.requester_username || "You"}
              description={ticket.message}
              descriptionDate={ticket.created_at}
              replies={ticket.replies}
              meId={Number(user?.id ?? -1)}
              onSend={sendReply}
              disabled={closed}
              disabledNote="This ticket is closed. Open a new one if you still need help."
              placeholder="Write a reply…"
            />
          </div>
        </>
      )}
    </div>
  );
}
