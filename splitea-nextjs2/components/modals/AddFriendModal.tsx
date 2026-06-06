"use client";
// components/modals/AddFriendModal.tsx

import { useState } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { PEOPLE } from "@/lib/data";
import type { FriendRow } from "@/lib/types";

interface Props {
  existingFriends: FriendRow[];
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}

export default function AddFriendModal({ existingFriends, onClose, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set());

  const existingIds = new Set(existingFriends.map((f) => f.personId));
  const candidates = PEOPLE.filter((p) => !p.you && !existingIds.has(p.id));
  const filtered = query.trim()
    ? candidates.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.email || "").toLowerCase().includes(query.toLowerCase()),
      )
    : candidates.slice(0, 5);

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
            {query.trim() ? `Search results (${filtered.length})` : "Suggested Friends"}
          </div>
          <div className="fr-sug-list">
            {filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                No matches found.
              </div>
            ) : (
              filtered.map((p) => {
                const isPending = pending.has(p.id);
                return (
                  <div key={p.id} className="fr-sug-row">
                    <Avatar id={p.id} size="md" />
                    <div>
                      <div className="nm">{p.name}</div>
                      <div className="sub">{p.email}</div>
                    </div>
                    <button
                      className={"btn-add-sm" + (isPending ? " pending" : "")}
                      onClick={() => toggleAdd(p.id)}
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
            <button className="btn btn-primary" onClick={() => onAdd([...pending])}>
              Done {pending.size > 0 && `(${pending.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
