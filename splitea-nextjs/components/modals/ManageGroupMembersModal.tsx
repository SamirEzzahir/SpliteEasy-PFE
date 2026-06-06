"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { friendsApi } from "@/lib/api/friends";
import { groupsApi } from "@/lib/api/groups";
import type { ApiMembership, ApiUser } from "@/lib/api/types";
import { personById } from "@/lib/data";
import { registerUsers } from "@/lib/people-cache";
import { useApp } from "@/lib/store";
import type { Group } from "@/lib/types";

interface Props {
  group: Group;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onToast?: (message: string, type?: "success" | "error" | "info" | "warning") => void;
}

const canUseBackend = (id: string) => Number.isFinite(Number(id));

export default function ManageGroupMembersModal({ group, onClose, onChanged, onToast }: Props) {
  const { friends } = useApp();
  const [members, setMembers] = useState<ApiMembership[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiUser[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupId = Number(group.id);
  const backendReady = canUseBackend(group.id);

  const memberIds = useMemo(
    () => new Set((members.length ? members.map((m) => String(m.user_id)) : group.memberIds)),
    [members, group.memberIds],
  );

  useEffect(() => {
    if (!backendReady) return;
    setLoading(true);
    setError(null);
    groupsApi.members(groupId)
      .then((rows) => {
        registerUsers(rows.map((row) => row.user!).filter(Boolean));
        setMembers(rows);
      })
      .catch(() => setError("Could not load live members."))
      .finally(() => setLoading(false));
  }, [backendReady, groupId]);

  useEffect(() => {
    const q = query.trim();
    setSelected(new Set());
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      friendsApi.search(q)
        .then((users) => {
          if (cancelled) return;
          registerUsers(users);
          setResults(users);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const friendOptions = useMemo(() => {
    return friends
      .filter((friend) => friend.status === "friend" && !memberIds.has(friend.personId))
      .map((friend) => {
        const person = personById(friend.personId);
        return {
          id: Number(friend.personId),
          username: person.name,
          full_name: person.name,
          email: person.email || "",
        } as ApiUser;
      })
      .filter((user) => Number.isFinite(user.id));
  }, [friends, memberIds]);

  const visibleResults = (query.trim().length >= 2 ? results : friendOptions)
    .filter((user) => !memberIds.has(String(user.id)));

  const toggleSelected = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const addSelected = async () => {
    if (!backendReady || selected.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (const userId of Array.from(selected)) {
        await groupsApi.addMember(groupId, userId, makeAdmin);
      }
      onToast?.(`Added ${selected.size} member${selected.size === 1 ? "" : "s"}`);
      setSelected(new Set());
      setQuery("");
      await onChanged();
      const rows = await groupsApi.members(groupId);
      registerUsers(rows.map((row) => row.user!).filter(Boolean));
      setMembers(rows);
    } catch {
      setError("Could not add selected members.");
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (userId: number) => {
    if (!backendReady || !confirm("Remove this member from the group?")) return;
    setSaving(true);
    setError(null);
    try {
      await groupsApi.removeMember(groupId, userId);
      onToast?.("Member removed");
      await onChanged();
      setMembers((rows) => rows.filter((row) => row.user_id !== userId));
    } catch {
      setError("Could not remove member.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAdmin = async (member: ApiMembership) => {
    if (!backendReady) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await groupsApi.updateMember(groupId, member.user_id, !member.is_admin);
      setMembers((rows) => rows.map((row) => (row.user_id === updated.user_id ? updated : row)));
      onToast?.(updated.is_admin ? "Admin role added" : "Admin role removed");
      await onChanged();
    } catch {
      setError("Could not update admin role.");
    } finally {
      setSaving(false);
    }
  };

  const fallbackMembers = group.memberIds.map((id, index) => ({
    id: index,
    user_id: Number(id) || index,
    group_id: Number(group.id) || 0,
    is_admin: index === 0,
    user: undefined,
  }));
  const rows = members.length ? members : fallbackMembers;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-xl gm-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-h with-icon gm-modal-head">
          <div className="modal-h-titlewrap">
            <div className="modal-icon"><Icon name="groups" size={25} /></div>
            <div>
              <h2>Manage Members</h2>
              <p>Add, remove or update members in this group.</p>
            </div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={17} /></button>
        </div>

        <div className="gm-group-strip">
          <div className="gm-group-icon" style={{ color: group.color, background: group.soft }}>
            <Icon name={group.icon} size={25} />
          </div>
          <div>
            <div className="gm-group-name">{group.name} <span>Group</span></div>
            <div className="gm-group-sub">{group.memberIds.length} members</div>
          </div>
        </div>

        {error && <div className="notice error gm-notice"><Icon name="info" size={14} /> {error}</div>}
        {!backendReady && (
          <div className="notice gm-notice">
            <Icon name="info" size={14} /> Demo groups can be previewed, but member changes require a backend group.
          </div>
        )}

        <div className="modal-b gm-layout">
          <section className="gm-card">
            <div className="gm-card-head">
              <div>
                <h3>Add New Members</h3>
                <p>Search friends and select who should join this group.</p>
              </div>
            </div>
            <div className="fr-search-box gm-search">
              <Icon name="search" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or email"
                disabled={!backendReady}
              />
            </div>

            <div className="gm-candidates">
              {!backendReady ? (
                <div className="gm-empty">Connect to a live backend group to add members.</div>
              ) : query.trim().length < 2 && visibleResults.length === 0 ? (
                <div className="gm-empty">No available friends to add.</div>
              ) : visibleResults.length === 0 ? (
                <div className="gm-empty">No users found.</div>
              ) : (
                visibleResults.map((user) => {
                  const checked = selected.has(user.id);
                  return (
                    <button key={user.id} className="gm-candidate" onClick={() => toggleSelected(user.id)}>
                      <Avatar id={String(user.id)} size="md" />
                      <span>
                        <b>{user.full_name || user.username}</b>
                        <small>{user.email}</small>
                      </span>
                      <i className={checked ? "checked" : ""}>{checked && <Icon name="check" size={13} />}</i>
                    </button>
                  );
                })
              )}
            </div>

            <label className="gm-admin-toggle">
              <span>
                <Icon name="crown" size={18} />
                <b>Make Admin</b>
                <small>Assign admin rights to selected members.</small>
              </span>
              <input type="checkbox" checked={makeAdmin} onChange={(event) => setMakeAdmin(event.target.checked)} />
              <em />
            </label>

            <button
              className="btn btn-primary gm-add-btn"
              disabled={!backendReady || saving || selected.size === 0}
              onClick={addSelected}
            >
              <Icon name="userPlus" size={15} /> Add {selected.size} Member{selected.size === 1 ? "" : "s"}
            </button>
          </section>

          <section className="gm-card">
            <div className="gm-card-head">
              <div>
                <h3>Current Members ({rows.length})</h3>
                <p>Manage group members and their permissions.</p>
              </div>
              {loading && <span className="gm-loading">Loading...</span>}
            </div>

            <div className="gm-members">
              {rows.map((member) => {
                const person = member.user
                  ? {
                      name: member.user.full_name || member.user.username,
                      email: member.user.email,
                    }
                  : {
                      name: personById(String(member.user_id)).name,
                      email: personById(String(member.user_id)).email || "member@spliteasy.local",
                    };
                return (
                  <div key={member.user_id} className="gm-member-row">
                    <Avatar id={String(member.user_id)} size="lg" />
                    <div className="gm-member-body">
                      <div className="gm-member-name">
                        {person.name}
                        {member.is_admin && <span>Admin <Icon name="crown" size={11} /></span>}
                      </div>
                      <div className="gm-member-mail">{person.email}</div>
                    </div>
                    <button
                      className={"gm-role-btn" + (member.is_admin ? " active" : "")}
                      disabled={!backendReady || saving}
                      onClick={() => toggleAdmin(member)}
                    >
                      {member.is_admin ? "Remove admin" : "Make admin"}
                    </button>
                    <button
                      className="gm-remove-btn"
                      disabled={!backendReady || saving}
                      onClick={() => removeMember(member.user_id)}
                      aria-label="Remove member"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="gm-invite">
              <div>
                <Icon name="share" size={18} />
                <span>
                  <b>Group Invitation Link</b>
                  <small>Anyone with this link can request to join the group.</small>
                </span>
              </div>
              <button className="btn btn-secondary" onClick={() => onToast?.("Invitation link copied")}>
                Copy Link
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
