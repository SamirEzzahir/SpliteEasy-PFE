"use client";
// app/friends/page.tsx

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import AddFriendModal from "@/components/modals/AddFriendModal";
import ReportModal from "@/components/support/ReportModal";
import { personById } from "@/lib/data";
import { activityApi, type ApiActivityLog } from "@/lib/api/activity";
import { friendsApi, type ApiFriendSuggestion } from "@/lib/api/friends";
import { registerUsers } from "@/lib/people-cache";
import { fmt } from "@/lib/format";
import { useApp } from "@/lib/store";
import type { FriendStatus } from "@/lib/types";

function timeAgo(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function activityIcon(activity: ApiActivityLog): { icon: string; color: string; soft: string } {
  const text = `${activity.target_type || ""} ${activity.action}`.toLowerCase();
  if (text.includes("expense")) return { icon: "expense", color: "#5b4ef0", soft: "#eeecff" };
  if (text.includes("settle") || text.includes("paid")) return { icon: "settle", color: "#10b981", soft: "#dcfce7" };
  if (text.includes("group") || text.includes("member")) return { icon: "groups", color: "#f59e0b", soft: "#fef3c7" };
  return { icon: "activity", color: "#ec4899", soft: "#fce7f3" };
}

export default function FriendsPage() {
  const {
    friends,
    settleFriend,
    addFriends,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
  } = useApp();
  const [tab, setTab] = useState<FriendStatus>("friend");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [suggestions, setSuggestions] = useState<ApiFriendSuggestion[]>([]);
  const [activity, setActivity] = useState<ApiActivityLog[]>([]);
  const [reportUser, setReportUser] = useState<{ id: number; name: string } | null>(null);

  const counts = {
    friend: friends.filter((f) => f.status === "friend").length,
    received: friends.filter((f) => f.status === "received").length,
    sent: friends.filter((f) => f.status === "sent").length,
  };

  const visible = useMemo(() => {
    let list = friends.filter((f) => f.status === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((f) => {
        const p = personById(f.personId);
        return (
          (f.displayName || p.name).toLowerCase().includes(q) ||
          (f.email || p.email || "").toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [friends, tab, query]);

  useEffect(() => {
    let cancelled = false;
    friendsApi.suggestions(5)
      .then((items) => {
        if (cancelled) return;
        registerUsers(items.map((item) => item.user));
        setSuggestions(items);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    activityApi.list(6)
      .then((items) => {
        if (cancelled) return;
        registerUsers(items.map((item) => item.user));
        setActivity(items);
      })
      .catch(() => {
        if (!cancelled) setActivity([]);
      });
    return () => {
      cancelled = true;
    };
  }, [friends.length]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Friends</h1>
          <p>Manage your friends, requests and connections.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Icon name="userPlus" size={14} /> Add Friend
          </button>
        </div>
      </div>

      <div className="page-2col">
        <div>
          <div className="tabs">
            <button
              className={"tab friend" + (tab === "friend" ? " active" : "")}
              onClick={() => setTab("friend")}
            >
              <Icon name="groups" size={14} /> My Friends
            </button>
            <button
              className={"tab" + (tab === "received" ? " active" : "")}
              onClick={() => setTab("received")}
            >
              <Icon name="userPlus" size={14} /> Received Requests
              {counts.received > 0 && <span className="tab-badge">{counts.received}</span>}
            </button>
            <button
              className={"tab" + (tab === "sent" ? " active" : "")}
              onClick={() => setTab("sent")}
            >
              <Icon name="userPlus" size={14} /> Sent Requests
            </button>
          </div>

          <div className="friend-list">
            <div className="friend-list-head">
              <div className="search">
                <Icon name="search" size={14} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your friends..." />
              </div>
              <button className="dropdown">Sort by: Name (A-Z) <Icon name="chev" size={12} className="chev" /></button>
            </div>

            {visible.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-3)" }}>
                <Icon name="groups" size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                  No {tab === "received" ? "requests" : tab === "sent" ? "pending" : "friends"} yet
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {tab === "friend" ? "Add a friend to get started" : "Check back later"}
                </div>
              </div>
            ) : (
              visible.map((f) => {
                const p = personById(f.personId);
                const name = f.displayName || p.name;
                const email = f.email || p.email;
                return (
                  <div key={f.personId} className="friend-row">
                    <Avatar id={f.personId} size="lg" />
                    <div>
                      <div className="nm">{name}</div>
                      <div className="sub">
                        {tab === "friend" ? (
                          <>
                            <Icon name="groups" size={12} /> {f.mutuals} mutual friends
                          </>
                        ) : (
                          email || "Friend request"
                        )}
                      </div>
                    </div>
                    {tab === "friend" ? (
                      <>
                        {f.balance === 0 ? (
                          <div className="friend-bal settled">
                            <div className="v num">{fmt(0)}</div>
                          </div>
                        ) : (
                          <div className={"friend-bal " + (f.balance > 0 ? "owed" : "youowe")}>
                            <div className="lbl">{f.balance > 0 ? "You are owed" : "You owe"}</div>
                            <div className="v num">{fmt(Math.abs(f.balance))}</div>
                          </div>
                        )}
                        {f.balance !== 0 ? (
                          <button className="btn-settle" onClick={() => settleFriend(f.personId)}>
                            Settle up
                          </button>
                        ) : (
                          <div />
                        )}
                        <button className="btn-chat"><Icon name="chat" size={15} /></button>
                        <button
                          className="btn-more-i"
                          title="Report user"
                          onClick={() => setReportUser({ id: Number(f.personId), name })}
                        >
                          <Icon name="alertTriangle" size={15} />
                        </button>
                        <button
                          className="btn-more-i"
                          title="Remove friend"
                          onClick={() => f.friendshipId && removeFriend(f.friendshipId)}
                        >
                          <Icon name="x" size={15} />
                        </button>
                      </>
                    ) : tab === "received" ? (
                      <>
                        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Sent {f.requestAt}</div>
                        <div className="req-actions">
                          <button
                            className="btn-decline"
                            onClick={() => f.requestId && rejectFriendRequest(f.requestId)}
                          >
                            Decline
                          </button>
                          <button
                            className="btn-accept"
                            onClick={() => f.requestId && acceptFriendRequest(f.requestId)}
                          >
                            Accept
                          </button>
                        </div>
                        <div />
                        <button className="btn-more-i"><Icon name="dots" size={15} /></button>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Sent {f.requestAt}</div>
                        <span className="status-badge pending">Pending</span>
                        <div />
                        <button className="btn-more-i"><Icon name="dots" size={15} /></button>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rail">
          <div className="rail-card">
            <div className="rail-head"><h3>People you may know</h3><button className="rail-link">View all</button></div>
            {suggestions.map((s) => {
              const personId = String(s.user.id);
              const p = personById(personId);
              return (
                <div key={s.user.id} className="pymk-row">
                  <Avatar id={personId} size="md" />
                  <div>
                    <div className="nm">{p.name}</div>
                    <div className="sub">{s.mutuals} mutual friends</div>
                  </div>
                  <button className="btn-add-sm" onClick={() => addFriends([personId])}>
                    <Icon name="plus" size={11} /> Add
                  </button>
                </div>
              );
            })}
            {suggestions.length === 0 && (
              <div style={{ padding: "16px 0", color: "var(--ink-3)", fontSize: 13 }}>
                Search by name or email to add more friends.
              </div>
            )}
          </div>

          <div className="rail-card">
            <div className="rail-head"><h3>Friend activity</h3><button className="rail-link">View all</button></div>
            {activity.map((a) => {
              const p = personById(String(a.user_id));
              const meta = activityIcon(a);
              return (
                <div key={a.id} className="act-row">
                  <div className="ic" style={{ background: meta.soft, color: meta.color }}>
                    <Icon name={meta.icon} size={15} />
                  </div>
                  <div className="body">
                    <div className="nm"><b>{p.name}</b> {a.action}</div>
                    <div className="ds">{a.target_type || "Activity"}</div>
                  </div>
                  <div className="when">{timeAgo(a.created_at)}</div>
                </div>
              );
            })}
            {activity.length === 0 && (
              <div style={{ padding: "16px 0", color: "var(--ink-3)", fontSize: 13 }}>
                No recent activity yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <AddFriendModal
          existingFriends={friends}
          onClose={() => setShowAdd(false)}
          onAdd={(ids) => {
            addFriends(ids);
            setShowAdd(false);
          }}
        />
      )}
      {reportUser && (
        <ReportModal
          targetType="user"
          targetId={reportUser.id}
          targetLabel={reportUser.name}
          onClose={() => setReportUser(null)}
        />
      )}
    </>
  );
}
