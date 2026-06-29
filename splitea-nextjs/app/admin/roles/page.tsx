"use client";
// app/admin/roles/page.tsx — roles list + permission-matrix editor.

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/Icon";
import Skeleton from "@/components/Skeleton";
import { confirmAction } from "@/components/admin/ui";
import { usePerms } from "@/components/admin/usePerms";
import { adminApi, parsePermissions, type AdminRole, type PermissionInfo } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

interface EditorState {
  id?: number;
  name: string;
  perms: Set<string>;
  wildcard: boolean;
}

export default function AdminRolesPage() {
  const { has } = usePerms();
  const canManage = has("manage_roles");

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [catalog, setCatalog] = useState<PermissionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([adminApi.roles(), adminApi.permissions()]);
      setRoles(r); setCatalog(c);
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionInfo[]>();
    catalog.forEach((p) => { if (!map.has(p.group)) map.set(p.group, []); map.get(p.group)!.push(p); });
    return Array.from(map.entries());
  }, [catalog]);

  function openCreate() {
    setEditor({ name: "", perms: new Set(), wildcard: false });
  }
  function openEdit(role: AdminRole) {
    const parsed = parsePermissions(role);
    const wildcard = parsed.includes("*");
    setEditor({
      id: role.id,
      name: role.name,
      perms: new Set(wildcard ? catalog.map((c) => c.key) : parsed),
      wildcard,
    });
  }

  function togglePerm(key: string) {
    setEditor((ed) => {
      if (!ed) return ed;
      const perms = new Set(ed.perms);
      if (perms.has(key)) perms.delete(key); else perms.add(key);
      return { ...ed, perms };
    });
  }

  async function save() {
    if (!editor) return;
    if (!editor.name.trim()) { toast.error("Role name is required"); return; }
    const permissions = editor.wildcard ? JSON.stringify(["*"]) : JSON.stringify(Array.from(editor.perms));
    setSaving(true);
    try {
      if (editor.id) await adminApi.updateRole(editor.id, { name: editor.name.trim(), permissions });
      else await adminApi.createRole(editor.name.trim(), permissions);
      toast.success(editor.id ? "Role updated" : "Role created");
      setEditor(null);
      void load();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setSaving(false); }
  }

  async function remove(role: AdminRole) {
    const ok = await confirmAction({ title: `Delete role "${role.name}"?`, text: "Users assigned to it will lose its permissions.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try { await adminApi.deleteRole(role.id); toast.success("Role deleted"); void load(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  function permLabel(role: AdminRole): string {
    const p = parsePermissions(role);
    if (p.includes("*")) return "All permissions";
    return `${p.length} permission${p.length === 1 ? "" : "s"}`;
  }

  return (
    <div>
      <PageHeader
        title="Roles"
        subtitle="Define what each role can do in the admin panel"
        actions={canManage ? (
          <button className="btn btn-primary" onClick={openCreate}><Icon name="plus" size={15} /> New role</button>
        ) : undefined}
      />

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 18 }}>
              <Skeleton width="50%" height={18} /><Skeleton width="30%" height={13} style={{ marginTop: 10 }} />
            </div>
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="card" style={{ padding: 8 }}>
          <EmptyState icon="shield" title="No roles yet" message="Create a role to grant admin access." action={canManage ? <button className="btn btn-primary" onClick={openCreate}>New role</button> : undefined} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
          {roles.map((role) => (
            <div key={role.id} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--primary-soft)", color: "var(--primary)" }}>
                  <Icon name="shield" size={18} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{role.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{permLabel(role)}</div>
                </div>
              </div>
              {canManage && (
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => openEdit(role)}><Icon name="edit" size={14} /> Edit</button>
                  <button className="admin-icon-btn danger" onClick={() => remove(role)}><Icon name="trash" size={15} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editor && (
        <div
          onClick={() => setEditor(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(11,15,26,.45)", zIndex: 200, display: "grid", placeItems: "center", padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", padding: 22 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{editor.id ? "Edit role" : "New role"}</h2>
              <button className="admin-icon-btn" onClick={() => setEditor(null)}><Icon name="x" size={16} /></button>
            </div>

            <div className="field">
              <label>Role name</label>
              <input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="e.g. Moderator" />
            </div>

            <label className={"admin-perm-item" + (editor.wildcard ? " checked" : "")} style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={editor.wildcard} onChange={(e) => setEditor({ ...editor, wildcard: e.target.checked })} />
              <span><strong>Super Admin</strong> — all permissions (wildcard <code>*</code>)</span>
            </label>

            <div style={{ opacity: editor.wildcard ? 0.5 : 1, pointerEvents: editor.wildcard ? "none" : "auto" }}>
              {grouped.map(([group, perms]) => (
                <div key={group} className="admin-perm-group">
                  <h4>{group}</h4>
                  <div className="admin-perm-grid">
                    {perms.map((p) => (
                      <label key={p.key} className={"admin-perm-item" + (editor.perms.has(p.key) ? " checked" : "")}>
                        <input type="checkbox" checked={editor.perms.has(p.key)} onChange={() => togglePerm(p.key)} />
                        <span>{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setEditor(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save role"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
