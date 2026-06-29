"use client";
// components/support/Thread.tsx — ticket conversation: the original message as the
// first bubble, then the reply thread, then a composer. Shared by the user portal
// and the admin panel; own messages align right.

import { useState } from "react";
import Icon from "@/components/Icon";
import type { TicketReply } from "@/lib/api/support";

interface Bubble {
  id: string;
  authorId?: number | null;
  authorName: string;
  isAdmin: boolean;
  body: string;
  createdAt: string;
}

interface Props {
  requesterId: number;
  requesterName: string;
  description: string;
  descriptionDate: string;
  replies: TicketReply[];
  meId: number;
  onSend?: (body: string) => Promise<void>;
  disabled?: boolean;
  disabledNote?: string;
  placeholder?: string;
}

function time(s: string): string {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Thread({
  requesterId, requesterName, description, descriptionDate, replies, meId,
  onSend, disabled, disabledNote, placeholder = "Write a reply…",
}: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const bubbles: Bubble[] = [
    { id: "desc", authorId: requesterId, authorName: requesterName, isAdmin: false, body: description, createdAt: descriptionDate },
    ...replies.map((r) => ({
      id: `r${r.id}`,
      authorId: r.author_id,
      authorName: r.author_username || (r.is_admin ? "Support" : "User"),
      isAdmin: r.is_admin,
      body: r.body,
      createdAt: r.created_at,
    })),
  ];

  async function send() {
    if (!onSend || !body.trim()) return;
    setSending(true);
    try {
      await onSend(body.trim());
      setBody("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {bubbles.map((b) => {
          const mine = b.authorId != null && b.authorId === meId;
          return (
            <div key={b.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
              <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBottom: 4, padding: "0 4px" }}>
                <span style={{ fontWeight: 600, color: "var(--ink-3)" }}>{mine ? "You" : b.authorName}</span>
                {b.isAdmin && !mine && (
                  <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 999, fontSize: 9.5, fontWeight: 700, background: "var(--primary-soft)", color: "var(--primary)" }}>SUPPORT</span>
                )}
                <span style={{ marginLeft: 8 }}>{time(b.createdAt)}</span>
              </div>
              <div
                style={{
                  maxWidth: "78%", padding: "10px 14px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.5,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  background: mine ? "var(--primary)" : "var(--surface)",
                  color: mine ? "#fff" : "var(--ink)",
                  border: mine ? "none" : "1px solid var(--line)",
                  borderBottomRightRadius: mine ? 4 : 14,
                  borderBottomLeftRadius: mine ? 14 : 4,
                }}
              >
                {b.body}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div style={{ marginTop: 18 }}>
        {disabled ? (
          <div style={{ padding: 14, borderRadius: 12, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink-3)", fontSize: 13, textAlign: "center" }}>
            {disabledNote || "This ticket is closed."}
          </div>
        ) : onSend ? (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={placeholder}
              rows={2}
              style={{
                flex: 1, resize: "vertical", minHeight: 44, padding: "10px 12px",
                border: "1px solid var(--line)", borderRadius: 12, fontSize: 13.5,
                outline: "none", background: "var(--surface)", color: "var(--ink)",
                fontFamily: "inherit",
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }}
            />
            <button className="btn btn-primary" onClick={send} disabled={sending || !body.trim()} style={{ height: 44 }}>
              <Icon name="chat" size={15} /> {sending ? "Sending…" : "Send"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
