"use client";
// components/modals/CreateGroupModal.tsx

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { PeoplePicker } from "@/components/ui/PeoplePicker";
import { GROUP_TYPES, personById } from "@/lib/data";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp } from "@/lib/store";
import type { Group, GroupType } from "@/lib/types";

const PALETTE = [
  { color: "#5b4ef0", soft: "#eeecff", heroA: "#7c3aed", heroB: "#f59e0b" },
  { color: "#10b981", soft: "#dcfce7", heroA: "#10b981", heroB: "#fbbf24" },
  { color: "#f97316", soft: "#fff1e6", heroA: "#f97316", heroB: "#ec4899" },
  { color: "#0ea5e9", soft: "#e0f2fe", heroA: "#0ea5e9", heroB: "#5b4ef0" },
];

const CURRENCIES = [
  { id: "MAD", label: "MAD - Moroccan Dirham" },
  { id: "USD", label: "USD - US Dollar" },
  { id: "EUR", label: "EUR - Euro" },
  { id: "GBP", label: "GBP - British Pound" },
];

interface Props {
  onClose: () => void;
  onSubmit: (g: Group) => Promise<void>;
}

export default function CreateGroupModal({ onClose, onSubmit }: Props) {
  const { user } = useAuth();
  const { friends } = useApp();
  const [name, setName] = useState("");
  const [type, setType] = useState<GroupType>("home");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("MAD");
  const [photo, setPhoto] = useState("");
  const [personal, setPersonal] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  const friendSource = useMemo(() => {
    return friends
      .filter((friend) => friend.status === "friend" && friend.personId !== user?.id)
      .map((friend) => personById(friend.personId));
  }, [friends, user?.id]);
  const selectedMemberIds = memberIds.filter((id) => friendSource.some((friend) => friend.id === id));

  const valid = name.trim().length > 0 && !!user?.id;

  const clearMembers = () => {
    setMemberIds([]);
  };

  const togglePersonal = () => {
    setPersonal((value) => {
      const next = !value;
      if (next) clearMembers();
      return next;
    });
  };

  const submit = async () => {
    if (!valid || !user || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    const typeMeta = GROUP_TYPES.find((item) => item.id === type)!;
    const palette = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    try {
      await onSubmit({
        id: "g" + Date.now(),
        name: name.trim(),
        type,
        currency,
        photo: photo.trim() || null,
        description: description.trim(),
        icon: typeMeta.icon,
        memberIds: [String(user.id), ...(personal ? [] : selectedMemberIds)],
        total: 0,
        balance: 0,
        updated: "just now",
        ...palette,
      });
    } catch {
      setError("Could not create this group. Your details are saved here; please try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => { if (!saving) onClose(); }}>
      <div className="modal modal-lg cg-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-h with-icon">
          <div className="modal-h-titlewrap">
            <div className="modal-icon"><Icon name="groups" size={24} /></div>
            <div>
              <h2>Create New Group</h2>
              <p>Add group details and invite members.</p>
            </div>
          </div>
          <button className="modal-x" disabled={saving} onClick={onClose} aria-label="Close create group"><Icon name="x" size={16} /></button>
        </div>

        <div className="modal-b cg-body">
          <section className="cg-section">
            <div className="cg-section-head">
              <h3>Basics</h3>
              <span>Core group information</span>
            </div>

            <div className="form-grid-2">
              <div className="form-block">
                <label>Group Name</label>
                <div className="form-input">
                  <Icon name="groups" size={15} className="ic" />
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. House Expenses" autoFocus />
                </div>
              </div>

              <div className="form-block">
                <label>Group Type</label>
                <div className="form-input">
                  <Icon
                    name={GROUP_TYPES.find((item) => item.id === type)!.icon}
                    size={15}
                    className="ic"
                    style={{ color: "var(--primary)" }}
                  />
                  <select value={type} onChange={(event) => setType(event.target.value as GroupType)}>
                    {GROUP_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-block">
              <label>Description <span className="opt">(Optional)</span></label>
              <div className="textarea-wrap">
                <div className="form-input" style={{ alignItems: "flex-start", paddingTop: 8 }}>
                  <Icon name="chat" size={15} className="ic" style={{ marginTop: 4 }} />
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value.slice(0, 200))}
                    placeholder="What's this group for?"
                  />
                </div>
                <div className="counter">{description.length}/200</div>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-block">
                <label>Currency</label>
                <div className="form-input">
                  <Icon name="coin" size={15} className="ic" style={{ color: "var(--primary)" }} />
                  <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                    {CURRENCIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-block">
                <label>Group Image <span className="opt">(Optional)</span></label>
                <div className="form-input">
                  <Icon name="image" size={15} className="ic" />
                  <input value={photo} onChange={(event) => setPhoto(event.target.value)} placeholder="Paste image URL or leave empty" />
                </div>
              </div>
            </div>
          </section>

          <section className="cg-section">
            <div className="cg-mode-card">
              <div>
                <div className="cg-mode-title">
                  <Icon name="account" size={16} />
                  Personal Group (Solo)
                </div>
                <p>Start with only your own expenses. You can add friends later.</p>
              </div>
              <button
                className={"switch switch-light" + (personal ? " on" : "")}
                onClick={togglePersonal}
                role="switch"
                aria-checked={personal}
                disabled={saving}
                aria-label="Toggle personal group"
              />
            </div>

            {!personal ? (
              <>
                <PeoplePicker title="Invite Friends" description="Only accepted friends can be added." people={friendSource} selectedIds={selectedMemberIds} onChange={setMemberIds} disabled={saving} />
                {!friendSource.length && <p className="field-help">Create the group now and add friends later, or <Link href="/friends">find friends</Link>.</p>}
              </>
            ) : (
              <div className="cg-solo-note">
                <Icon name="shield" size={18} />
                <div>
                  <b>Solo mode enabled</b>
                  <span>This group starts with only you. You can invite friends whenever you want.</span>
                </div>
              </div>
            )}
          </section>
          {error && <p role="alert" style={{ color: "var(--rose)" }}>{error}</p>}
        </div>

        <div className="modal-f">
          <div className="cg-footer-note">
            {personal ? "Creating a personal group" : `${selectedMemberIds.length} friend${selectedMemberIds.length === 1 ? "" : "s"} selected`}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" disabled={saving} onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!valid || saving}
              onClick={submit}
              style={{ opacity: valid ? 1 : 0.5 }}
            >
              <Icon name="plus" size={14} /> {saving ? "Creating..." : "Create Group"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
