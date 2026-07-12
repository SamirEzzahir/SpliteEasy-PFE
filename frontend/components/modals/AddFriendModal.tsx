"use client";
// components/modals/AddFriendModal.tsx

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { friendsApi } from "@/lib/api/friends";
import type { ApiUser } from "@/lib/api/types";
import { registerUsers } from "@/lib/people-cache";
import type { FriendRow } from "@/lib/types";

interface Props {
  existingFriends: FriendRow[];
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}

export default function AddFriendModal({ existingFriends, onClose, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);

  const existingIds = useMemo(() => new Set(existingFriends.map((f) => f.personId)), [existingFriends]);
  const filtered = useMemo(
    () => results.filter((u) => !existingIds.has(String(u.id))),
    [existingIds, results],
  );

  useEffect(() => {
    const q = query.trim();
    setPending(new Set());
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      friendsApi.search(q)
        .then((users) => {
          if (cancelled) return;
          registerUsers(users);
          setResults(users);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const toggleAdd = (id: string) => {
    const next = new Set(pending);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPending(next);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h with-icon">
          <div className="modal-h-titlewrap">
            <div className="modal-icon"><Icon name="userPlus" size={24} /></div>
            <div>
              <h2>Add Friend</h2>
              <p>Search and add friends to start splitting expenses.</p>
            </div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="modal-b">
          <div className="fr-search-box">
            <Icon name="search" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or phone number"
            />
          </div>

          <div className="fr-sec-h">
            {query.trim().length >= 2 ? `Search results (${filtered.length})` : "Search Friends"}
          </div>
          <div className="fr-sug-list">
            {query.trim().length < 2 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                Type at least 2 characters to search users from the backend.
              </div>
            ) : loading ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                Searching...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                No matches found.
              </div>
            ) : (
              filtered.map((p) => {
                const personId = String(p.id);
                const isPending = pending.has(personId);
                return (
                  <div key={p.id} className="fr-sug-row">
                    <Avatar id={personId} size="md" />
                    <div>
                      <div className="nm">{p.full_name || p.username}</div>
                      <div className="sub">{p.email}</div>
                    </div>
                    <button
                      className={"btn-add-sm" + (isPending ? " pending" : "")}
                      onClick={() => toggleAdd(personId)}
                      style={isPending ? { background: "var(--primary)", color: "white" } : {}}
                    >
                      <Icon name={isPending ? "check" : "plus"} size={11} />
                      {isPending ? " Added" : " Add"}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="fr-sec-h">Other Options</div>
          <div className="fr-invite-grid">
            <button className="fr-invite-card">
              <div className="ic" style={{ background: "#eeecff", color: "#5b4ef0" }}>
                <Icon name="mail" size={18} />
              </div>
              <div>
                <div className="nm">Invite via Email</div>
                <div className="ds">Send an invitation to your friend&apos;s email</div>
              </div>
              <Icon name="chevR" size={14} className="chev" />
            </button>
            <button className="fr-invite-card">
              <div className="ic" style={{ background: "#dcfce7", color: "#10b981" }}>
                <Icon name="phone" size={18} />
              </div>
              <div>
                <div className="nm">Invite via Phone</div>
                <div className="ds">Send an invitation via phone number</div>
              </div>
              <Icon name="chevR" size={14} className="chev" />
            </button>
          </div>
        </div>

        <div className="modal-f">
          <div />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={() => onAdd(Array.from(pending))}>
              Done {pending.size > 0 && `(${pending.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
