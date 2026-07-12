"use client";
// components/chat/GroupChat.tsx — floating group chat bubble

import { useEffect, useRef, useState, useCallback } from "react";
import { Avatar } from "@/components/Avatar";
import Icon from "@/components/Icon";
import { chatApi, type ChatMessage } from "@/lib/api/chat";
import { useAuth } from "@/lib/auth/AuthContext";
import { useWS } from "@/lib/ws-context";

interface Props {
  groupId: number;
  groupName: string;
}

// ── notification sound (Web Audio API — no file needed) ──────────────────────
function playNotif() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close();
  } catch {
    // audio not supported — silently ignore
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function msgTime(iso: string) {
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(iso: string) {
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function sameDay(a: string, b: string) {
  return new Date(a.endsWith("Z") ? a : a + "Z").toDateString() ===
         new Date(b.endsWith("Z") ? b : b + "Z").toDateString();
}

// ── component ─────────────────────────────────────────────────────────────────

export default function GroupChat({ groupId, groupName }: Props) {
  const { user } = useAuth();
  const { subscribe } = useWS();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showNewPill, setShowNewPill] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({}); // userId → username

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  // timers to auto-clear typing indicators after 3s
  const typingTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // debounce timer for sending typing events
  const typingSendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── load messages on mount + whenever group changes ─────────────────────────
  const loadMessages = useCallback(async () => {
    setLoadingMsgs(true);
    try {
      const msgs = await chatApi.fetchMessages(groupId);
      setMessages(msgs);
    } catch (err) {
      console.error("[GroupChat] failed to load messages:", err);
    } finally {
      setLoadingMsgs(false);
    }
  }, [groupId]);

  // Load on mount so messages are ready before user even opens the panel
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // ── scroll to bottom when messages load or chat opens ────────────────────────
  useEffect(() => {
    if (open && !loadingMsgs) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 50);
    }
  }, [open, loadingMsgs, messages.length]);

  // ── Subscribe to shared WebSocket (no new socket opened here) ───────────────
  useEffect(() => {
    const unsubTyping = subscribe("typing", (raw) => {
      const data = raw as { group_id: number; user_id: number; username: string };
      if (data.group_id !== groupId) return;
      const uid = data.user_id;
      setTypingUsers((prev) => ({ ...prev, [uid]: data.username }));
      if (typingTimers.current[uid]) clearTimeout(typingTimers.current[uid]);
      typingTimers.current[uid] = setTimeout(() => {
        setTypingUsers((prev) => { const n = { ...prev }; delete n[uid]; return n; });
      }, 3000);
    });

    const unsubMsg = subscribe("new_chat_message", (raw) => {
      const data = raw as { message: ChatMessage };
      const msg = data.message;
      if (msg.group_id !== groupId) return;

      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      setTypingUsers((prev) => { const n = { ...prev }; delete n[msg.user_id]; return n; });
      if (typingTimers.current[msg.user_id]) clearTimeout(typingTimers.current[msg.user_id]);

      if (msg.user_id !== user?.id) playNotif();

      if (!openRef.current) {
        setUnread((u) => u + 1);
      } else {
        const el = scrollRef.current;
        if (el) {
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (atBottom) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          else setShowNewPill(true);
        }
      }
    });

    return () => { unsubTyping(); unsubMsg(); };
  }, [subscribe, groupId, user?.id]);

  // ── send ─────────────────────────────────────────────────────────────────────
  const send = async () => {
    const text = input.trim();
    if (!text || sending || !user) return;
    setSending(true);
    setInput("");
    try {
      const msg = await chatApi.sendMessage(groupId, text);
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      setInput(text); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // debounce typing signal: fire once every 2s while user keeps typing
    if (typingSendTimer.current) return;
    typingSendTimer.current = setTimeout(() => {
      typingSendTimer.current = null;
      chatApi.sendTyping(groupId).catch(() => {});
    }, 400);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowNewPill(false);
  };

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className={"gc-wrap" + (open ? " gc-wrap--open" : "")}>
      {/* Floating bubble button */}
      <button
        className="gc-bubble"
        onClick={() => { setOpen((v) => !v); setUnread(0); }}
        aria-label="Group chat"
      >
        <Icon name="chat" size={22} style={{ color: "#fff" }} />
        {unread > 0 && (
          <span className="gc-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {/* Mobile-only backdrop behind the full-screen sheet */}
      {open && <div className="gc-backdrop" onClick={() => setOpen(false)} />}

      {/* Chat panel */}
      {open && (
        <div className="gc-panel" role="dialog" aria-modal="true" aria-label={`${groupName} chat`}>
          {/* Header */}
          <div className="gc-header">
            {/* Mobile back chevron — reads as "close sheet" */}
            <button className="gc-back" onClick={() => setOpen(false)} aria-label="Close chat">
              <Icon name="chevR" size={18} style={{ color: "#fff", transform: "rotate(180deg)" }} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <div className="gc-header-icon">
                <Icon name="chat" size={16} style={{ color: "#fff" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{groupName}</div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)" }}>Group Chat</div>
              </div>
            </div>
            <button className="gc-close" onClick={() => setOpen(false)} aria-label="Close chat">
              <Icon name="x" size={15} style={{ color: "#fff" }} />
            </button>
          </div>

          {/* Messages */}
          <div className="gc-messages" ref={scrollRef} onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) setShowNewPill(false);
          }}>
            {loadingMsgs ? (
              <div className="gc-skeletons">
                {[70, 50, 85].map((w, i) => (
                  <div key={i} className={`gc-skel-row ${i % 2 === 1 ? "right" : ""}`}>
                    <div className="sk-block" style={{ width: `${w}%`, height: 38, borderRadius: 12 }} />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="gc-empty">
                <span style={{ fontSize: 28 }}>💬</span>
                <p>No messages yet.</p>
                <p style={{ fontSize: 12, color: "var(--ink-4)" }}>Say hi to the group!</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.user_id === user?.id;
                const prev = messages[i - 1];
                const next = messages[i + 1];
                const showDay = !prev || !sameDay(prev.created_at, msg.created_at);
                const isSameAuthorAsPrev = prev && prev.user_id === msg.user_id && !showDay;
                const isSameAuthorAsNext = next && next.user_id === msg.user_id && sameDay(msg.created_at, next.created_at);
                const showAvatar = !isMe && !isSameAuthorAsNext;
                const showName = !isMe && !isSameAuthorAsPrev;

                return (
                  <div key={msg.id}>
                    {/* Date separator */}
                    {showDay && (
                      <div className="gc-day-sep">
                        <span>{dayLabel(msg.created_at)}</span>
                      </div>
                    )}

                    <div className={`gc-msg-row ${isMe ? "me" : "them"}`}>
                      {/* Avatar placeholder for alignment when no avatar shown */}
                      {!isMe && (
                        <div className="gc-avatar-slot">
                          {showAvatar && <Avatar id={String(msg.user_id)} size="sm" />}
                        </div>
                      )}

                      <div className="gc-bubble-wrap">
                        {showName && (
                          <div className="gc-username">{msg.username}</div>
                        )}
                        <div className={`gc-msg-bubble ${isMe ? "mine" : "theirs"}`}>
                          {msg.content}
                        </div>
                        {/* Show time on last message of a group */}
                        {!isSameAuthorAsNext && (
                          <div className={`gc-time ${isMe ? "right" : "left"}`}>
                            {msgTime(msg.created_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* New message pill */}
          {showNewPill && (
            <button className="gc-new-pill" onClick={scrollToBottom}>
              ↓ New message
            </button>
          )}

          {/* Typing indicator */}
          {Object.keys(typingUsers).length > 0 && (
            <div className="gc-typing-bar">
              <div className="gc-typing-dots">
                <span /><span /><span />
              </div>
              <span className="gc-typing-label">
                {Object.values(typingUsers).join(", ")}
                {Object.keys(typingUsers).length === 1 ? " is" : " are"} typing…
              </span>
            </div>
          )}

          {/* Input */}
          <div className="gc-input-row">
            <textarea
              className="gc-input"
              placeholder="Type a message… (Enter to send)"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKey}
              rows={1}
              disabled={sending}
            />
            <button
              className="gc-send"
              onClick={send}
              disabled={sending || !input.trim()}
              aria-label="Send"
            >
              <Icon name="settle" size={16} style={{ transform: "rotate(-90deg)" }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
