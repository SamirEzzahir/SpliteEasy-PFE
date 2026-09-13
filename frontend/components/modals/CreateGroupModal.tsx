"use client";
// components/modals/CreateGroupModal.tsx

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { PeoplePicker } from "@/components/ui/PeoplePicker";
import { GROUP_TYPES, PEOPLE, personById } from "@/lib/data";
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
  onSubmit: (g: Group) => void;
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

  const friendSource = useMemo(() => {
    const accepted = friends
      .filter((friend) => friend.status === "friend")
      .map((friend) => personById(friend.personId));
    return accepted.length ? accepted : PEOPLE.filter((person) => !person.you);
  }, [friends]);

  const valid = name.trim().length > 0;

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

  const submit = () => {
    if (!valid) return;
    const typeMeta = GROUP_TYPES.find((item) => item.id === type)!;
    const palette = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    onSubmit({
      id: "g" + Date.now(),
      name: name.trim(),
      type,
      currency,
      photo: photo.trim() || null,
      description: description.trim(),
      icon: typeMeta.icon,
      memberIds: [String(user?.id || "samir"), ...(personal ? [] : memberIds)],
      total: 0,
      balance: 0,
      updated: "just now",
      ...palette,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg cg-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-h with-icon">
          <div className="modal-h-titlewrap">
            <div className="modal-icon"><Icon name="groups" size={24} /></div>
            <div>
              <h2>Create New Group</h2>
              <p>Add group details and invite members.</p>
            </div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={16} /></button>
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
                <p>A private group for your own expenses. No other members will be added.</p>
              </div>
              <button
                className={"switch switch-light" + (personal ? " on" : "")}
                onClick={togglePersonal}
                aria-label="Toggle personal group"
              />
            </div>

            {!personal ? (
              <PeoplePicker title="Invite Friends" people={friendSource} selectedIds={memberIds} onChange={setMemberIds} />
            ) : (
              <div className="cg-solo-note">
                <Icon name="shield" size={18} />
                <div>
                  <b>Solo mode enabled</b>
                  <span>This will create a group with only you for your Personel Expenses.</span>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="modal-f">
          <div className="cg-footer-note">
            {personal ? "Creating a personal group" : `${memberIds.length} friend${memberIds.length === 1 ? "" : "s"} selected`}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!valid}
              onClick={submit}
              style={{ opacity: valid ? 1 : 0.5 }}
            >
              <Icon name="plus" size={14} /> Create Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
