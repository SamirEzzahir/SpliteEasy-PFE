"use client";
// components/modals/CreateGroupModal.tsx

import { useState } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { GROUP_TYPES, PEOPLE, personById } from "@/lib/data";
import type { Group, GroupType } from "@/lib/types";

const SPLIT_OPTS = [
  { id: "equal", name: "Equal Split",    ds: "Split expenses equally among all members", icon: "split-equal", color: "#5b4ef0", soft: "#eeecff" },
  { id: "pct",   name: "By Percentage",  ds: "Split expenses by custom percentages",     icon: "split-pct",   color: "#10b981", soft: "#dcfce7" },
  { id: "share", name: "By Share",       ds: "Split expenses by custom shares",          icon: "split-share", color: "#f97316", soft: "#fff1e6" },
];

const PALETTE = [
  { color: "#5b4ef0", soft: "#eeecff", heroA: "#7c3aed", heroB: "#f59e0b" },
  { color: "#10b981", soft: "#dcfce7", heroA: "#10b981", heroB: "#fbbf24" },
  { color: "#f97316", soft: "#fff1e6", heroA: "#f97316", heroB: "#ec4899" },
  { color: "#0ea5e9", soft: "#e0f2fe", heroA: "#0ea5e9", heroB: "#5b4ef0" },
];

interface Props {
  onClose: () => void;
  onSubmit: (g: Group) => void;
}

export default function CreateGroupModal({ onClose, onSubmit }: Props) {
  const [name, setName] = useState("Weekend Trip to Dubai");
  const [type, setType] = useState<GroupType>("trip");
  const [description, setDescription] = useState("Trip to Dubai with close friends for a weekend getaway.");
  const [currency, setCurrency] = useState("USD");
  const [memberIds, setMemberIds] = useState<string[]>(["ahmed", "youssef", "sara", "omar"]);
  const [splitMode, setSplitMode] = useState("equal");
  const [anyoneAdd, setAnyoneAdd] = useState(true);
  const [memberQuery, setMemberQuery] = useState("");

  const valid = name.trim().length > 0;

  const removeMember = (id: string) => setMemberIds((s) => s.filter((x) => x !== id));
  const addMember = (id: string) => {
    if (!memberIds.includes(id)) setMemberIds((s) => [...s, id]);
    setMemberQuery("");
  };

  const candidates = PEOPLE.filter(
    (p) =>
      !p.you &&
      !memberIds.includes(p.id) &&
      (memberQuery.trim() ? p.name.toLowerCase().includes(memberQuery.toLowerCase()) : false),
  );

  const submit = () => {
    if (!valid) return;
    const typeMeta = GROUP_TYPES.find((t) => t.id === type)!;
    const palette = PALETTE[Math.floor(Math.random() * 4)];
    onSubmit({
      id: "g" + Date.now(),
      name: name.trim(),
      type,
      icon: typeMeta.icon,
      memberIds: ["samir", ...memberIds],
      total: 0,
      balance: 0,
      updated: "just now",
      ...palette,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
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

        <div className="modal-b">
          <div className="form-grid-2">
            <div className="form-block">
              <label>Group Name</label>
              <div className="form-input">
                <Icon name="groups" size={15} className="ic" />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend Trip" />
              </div>
            </div>
            <div className="form-block">
              <label>Group Type</label>
              <div className="form-input">
                <Icon
                  name={GROUP_TYPES.find((t) => t.id === type)!.icon}
                  size={15}
                  className="ic"
                  style={{ color: "var(--primary)" }}
                />
                <select value={type} onChange={(e) => setType(e.target.value as GroupType)}>
                  {GROUP_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <Icon name="chev" size={12} className="ic" />
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
                  onChange={(e) => setDescription(e.target.value.slice(0, 200))}
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
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="MAD">MAD — Moroccan Dirham</option>
                </select>
                <Icon name="chev" size={12} className="ic" />
              </div>
            </div>
            <div className="form-block">
              <label>Group Image <span className="opt">(Optional)</span></label>
              <button className="upload-box" style={{ width: "100%" }}>
                <div className="ic"><Icon name="image" size={16} /></div>
                <div>
                  <div className="nm">Click to upload or drag &amp; drop</div>
                  <div className="sub">PNG, JPG up to 2MB</div>
                </div>
              </button>
            </div>
          </div>

          <div className="form-block">
            <label>Add Members</label>
            <div className="form-input">
              <Icon name="search" size={15} className="ic" />
              <input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Search by name or email..."
              />
            </div>
            {candidates.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  background: "#fafbfc",
                  border: "1px solid var(--line-2)",
                  borderRadius: 10,
                  maxHeight: 160,
                  overflow: "auto",
                }}
              >
                {candidates.slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addMember(p.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      width: "100%",
                      border: 0,
                      background: "transparent",
                      borderRadius: 6,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <Avatar id={p.id} size="sm" />
                    <span style={{ fontSize: 13 }}>{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="member-chips">
              {memberIds.map((id) => {
                const p = personById(id);
                return (
                  <span key={id} className="chip">
                    <Avatar id={id} size="sm" />
                    <span className="chip-nm">{p.name}</span>
                    <button className="chip-x" onClick={() => removeMember(id)}>
                      <Icon name="x" size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="form-block">
            <label>Default Expense Split</label>
            <div className="split-options">
              {SPLIT_OPTS.map((o) => (
                <button
                  key={o.id}
                  className={"split-opt" + (splitMode === o.id ? " active" : "")}
                  onClick={() => setSplitMode(o.id)}
                >
                  <div className="split-opt-ic" style={{ background: o.soft, color: o.color }}>
                    <Icon name={o.icon} size={18} />
                  </div>
                  <div className="nm">{o.name}</div>
                  <div className="ds">{o.ds}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="toggle-row">
            <div>
              <div className="nm">Anyone can add expenses</div>
              <div className="ds">Allow all group members to add expenses</div>
            </div>
            <button
              className={"switch switch-light" + (anyoneAdd ? " on" : "")}
              onClick={() => setAnyoneAdd((v) => !v)}
            />
          </div>
        </div>

        <div className="modal-f">
          <div />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!valid}
              onClick={submit}
              style={{ opacity: valid ? 1 : 0.5 }}
            >
              <Icon name="userPlus" size={14} /> Create Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
