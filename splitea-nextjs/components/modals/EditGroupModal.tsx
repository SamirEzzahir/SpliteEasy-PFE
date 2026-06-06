"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { GROUP_TYPES } from "@/lib/data";
import { groupsApi } from "@/lib/api/groups";
import type { Group, GroupType } from "@/lib/types";

interface Props {
  group: Group;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onToast?: (message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export default function EditGroupModal({ group, onClose, onSaved, onToast }: Props) {
  const [name, setName] = useState(group.name);
  const [type, setType] = useState<GroupType>(group.type);
  const [currency, setCurrency] = useState("USD");
  const [photo, setPhoto] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBackendGroup = Number.isFinite(Number(group.id));

  const save = async () => {
    if (!name.trim() || !isBackendGroup) return;
    setSaving(true);
    setError(null);
    try {
      await groupsApi.update(Number(group.id), {
        title: name.trim(),
        type,
        currency,
        photo: photo.trim() || null,
      });
      onToast?.("Group updated");
      await onSaved();
      onClose();
    } catch {
      setError("Could not update group.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(event) => event.stopPropagation()}>
        <div className="modal-h with-icon">
          <div className="modal-h-titlewrap">
            <div className="modal-icon"><Icon name="edit" size={23} /></div>
            <div>
              <h2>Edit Group</h2>
              <p>Update group details, type, currency, and cover image.</p>
            </div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="modal-b">
          {error && <div className="notice error" style={{ marginBottom: 14 }}><Icon name="info" size={14} /> {error}</div>}
          {!isBackendGroup && (
            <div className="notice" style={{ marginBottom: 14 }}>
              <Icon name="info" size={14} /> Demo groups can be previewed, but editing needs a backend group.
            </div>
          )}

          <div className="form-grid-2">
            <div className="form-block">
              <label>Group Name</label>
              <div className="form-input">
                <Icon name="groups" size={15} className="ic" />
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </div>
            </div>
            <div className="form-block">
              <label>Group Type</label>
              <div className="form-input">
                <Icon name={GROUP_TYPES.find((item) => item.id === type)?.icon || "groups"} size={15} className="ic" />
                <select value={type} onChange={(event) => setType(event.target.value as GroupType)}>
                  {GROUP_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-block">
              <label>Currency</label>
              <div className="form-input">
                <Icon name="coin" size={15} className="ic" />
                <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                  <option value="USD">USD - US Dollar</option>
                  <option value="MAD">MAD - Moroccan Dirham</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                </select>
              </div>
            </div>
            <div className="form-block">
              <label>Cover Image URL <span className="opt">(Optional)</span></label>
              <div className="form-input">
                <Icon name="image" size={15} className="ic" />
                <input value={photo} onChange={(event) => setPhoto(event.target.value)} placeholder="https://..." />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-f">
          <div />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !isBackendGroup || !name.trim()} onClick={save}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
