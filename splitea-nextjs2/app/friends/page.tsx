"use client";
// app/friends/page.tsx

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import AddFriendModal from "@/components/modals/AddFriendModal";
import { FRIEND_ACTIVITY, SUGGESTIONS, personById } from "@/lib/data";
import { fmt } from "@/lib/format";
import { useApp } from "@/lib/store";
import type { FriendStatus } from "@/lib/types";

export default function FriendsPage() {
  const { friends, settleFriend, addFriends } = useApp();
  const [tab, setTab] = useState<FriendStatus>("friend");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const counts = {
    friend: friends.filter((f) => f.status === "friend").length,
    received: friends.filter((f) => f.status === "received").length,
    sent: friends.filter((f) => f.status === "sent").length,
  };

  const visible = useMemo(() => {
    let list = friends.filter((f) => f.status === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((f) => personById(f.personId).name.toLowerCase().includes(q));
    }
    return list;
  }, [friends, tab, query]);

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
              className={"tab" + (tab === "friend" ? " active" : "")}
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
                return (
                  <div key={f.personId} className="friend-row">
                    <Avatar id={f.personId} size="lg" />
                    <div>
                      <div className="nm">{p.name}</div>
                      <div className="sub">
                        <Icon name="groups" size={12} /> {f.mutuals} mutual friends
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
                        <button className="btn-more-i"><Icon name="dots" size={15} /></button>
                      </>
                    ) : tab === "received" ? (
                      <>
                        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Sent {f.requestAt}</div>
                        <div className="req-actions">
                          <button className="btn-decline">Decline</button>
                          <button className="btn-accept">Accept</button>
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
            {SUGGESTIONS.map((s) => {
              const p = personById(s.personId);
              return (
                <div key={s.personId} className="pymk-row">
                  <Avatar id={s.personId} size="md" />
                  <div>
                    <div className="nm">{p.name}</div>
                    <div className="sub">{s.mutuals} mutual friends</div>
                  </div>
                  <button className="btn-add-sm"><Icon name="plus" size={11} /> Add</button>
                </div>
              );
            })}
          </div>

          <div className="rail-card">
            <div className="rail-head"><h3>Friend activity</h3><button className="rail-link">View all</button></div>
            {FRIEND_ACTIVITY.map((a, i) => {
              const p = personById(a.who);
              return (
                <div key={i} className="act-row">
                  <div className="ic" style={{ background: a.soft, color: a.color }}>
                    <Icon name={a.icon} size={15} />
                  </div>
                  <div className="body">
                    <div className="nm"><b>{p.name}</b> {a.action}</div>
                    <div className="ds">{a.detail}</div>
                  </div>
                  <div className="when">{a.when}</div>
                </div>
              );
            })}
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
    </>
  );
}
