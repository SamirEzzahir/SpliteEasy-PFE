"use client";
// app/admin/announcements/page.tsx — create, publish, and manage announcements.

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/Icon";
import DataTable, { type Column } from "@/components/admin/DataTable";
import { fmtDateTime, confirmAction } from "@/components/admin/ui";
import { usePerms } from "@/components/admin/usePerms";
import { adminApi, type Announcement } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

const TYPES = ["maintenance", "release", "feature", "security", "emergency"];
const DELIVERIES = ["banner", "popup", "notification"];
const VISIBILITIES = [{ id: "everyone", label: "Everyone" }, { id: "admins", label: "Administrators only" }];

interface EditorState {
  id?: number;
  title: string;
  body: string;
  type: string;
  visibility: string;
  delivery: string;
  publish_now: boolean;
  expires_at: string;
}

const blankEditor = (): EditorState => ({ title: "", body: "", type: "feature", visibility: "everyone", delivery: "banner", publish_now: true, expires_at: "" });

export default function AdminAnnouncementsPage() {
  const { has } = usePerms();
  const canManage = has("manage_announcements");

  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.announcements({ page, page_size: 20 });
      setRows(res.items); setTotal(res.total); setPages(res.pages);
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  function openEdit(a: Announcement) {
    setEditor({
      id: a.id, title: a.title, body: a.body, type: a.type, visibility: a.visibility,
      delivery: a.delivery, publish_now: a.is_published,
      expires_at: a.expires_at ? a.expires_at.slice(0, 16) : "",
    });
  }

  async function save() {
    if (!editor) return;
    if (!editor.title.trim() || !editor.body.trim()) { toast.error("Title and body are required"); return; }
    setSaving(true);
    const body = {
      title: editor.title.trim(), body: editor.body.trim(), type: editor.type,
      visibility: editor.visibility, delivery: editor.delivery,
      expires_at: editor.expires_at ? new Date(editor.expires_at).toISOString() : null,
    };
    try {
      if (editor.id) await adminApi.updateAnnouncement(editor.id, body);
      else await adminApi.createAnnouncement({ ...body, publish_now: editor.publish_now });
      toast.success(editor.id ? "Announcement updated" : "Announcement created");
      setEditor(null);
      void load();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setSaving(false); }
  }

  async function publish(a: Announcement) {
    try { await adminApi.publishAnnouncement(a.id); toast.success("Published"); void load(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  async function remove(a: Announcement) {
    const ok = await confirmAction({ title: `Delete "${a.title}"?`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try { await adminApi.deleteAnnouncement(a.id); toast.success("Deleted"); void load(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  }

  const columns: Column<Announcement>[] = [
    {
      key: "title", header: "Announcement",
      render: (a) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--ink)" }}>{a.title}</div>
          <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{a.type} · {a.delivery} · {a.visibility}</div>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (a) => <span className={`admin-badge-pill ${a.is_published ? "is-accepted" : "is-neutral"}`}>{a.is_published ? "published" : "draft"}</span> },
    { key: "created_at", header: "Created", render: (a) => fmtDateTime(a.created_at) },
    {
      key: "actions", header: "", align: "right",
      render: (a) => canManage ? (
        <div className="admin-row-actions">
          {!a.is_published && <button className="admin-icon-btn" title="Publish" onClick={() => publish(a)}><Icon name="check" size={15} /></button>}
          <button className="admin-icon-btn" title="Edit" onClick={() => openEdit(a)}><Icon name="edit" size={15} /></button>
          <button className="admin-icon-btn danger" title="Delete" onClick={() => remove(a)}><Icon name="trash" size={15} /></button>
        </div>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle={`${total} total`}
        actions={canManage ? <button className="btn btn-primary" onClick={() => setEditor(blankEditor())}><Icon name="plus" size={15} /> New announcement</button> : undefined}
      />
      <DataTable<Announcement>
        columns={columns}
        rows={rows}
        rowKey={(a) => a.id}
        loading={loading}
        emptyIcon="bell"
        emptyTitle="No announcements"
        emptyMessage="Publish maintenance notices, release notes, and alerts."
        emptyAction={canManage ? <button className="btn btn-primary" onClick={() => setEditor(blankEditor())}>New announcement</button> : undefined}
        mobileCard={(a) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 600 }}>{a.title}</div>
              <span className={`admin-badge-pill ${a.is_published ? "is-accepted" : "is-neutral"}`}>{a.is_published ? "published" : "draft"}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{a.type} · {a.delivery} · {fmtDateTime(a.created_at)}</div>
            {canManage && (
              <div className="admin-row-actions" style={{ justifyContent: "flex-start" }}>
                {!a.is_published && <button className="admin-icon-btn" onClick={() => publish(a)}><Icon name="check" size={15} /></button>}
                <button className="admin-icon-btn" onClick={() => openEdit(a)}><Icon name="edit" size={15} /></button>
                <button className="admin-icon-btn danger" onClick={() => remove(a)}><Icon name="trash" size={15} /></button>
              </div>
            )}
          </div>
        )}
        page={page}
        totalPages={pages}
        onPage={setPage}
        summary={`${total} total`}
      />

      {editor && (
        <div onClick={() => setEditor(null)} style={{ position: "fixed", inset: 0, background: "rgba(11,15,26,.45)", zIndex: 200, display: "grid", placeItems: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{editor.id ? "Edit announcement" : "New announcement"}</h2>
              <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => setEditor(null)}><Icon name="x" size={16} /></button>
            </div>
            <div className="field"><label>Title</label><input value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} maxLength={200} /></div>
            <div className="field">
              <label>Body</label>
              <textarea value={editor.body} onChange={(e) => setEditor({ ...editor, body: e.target.value })} rows={4} style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13.5, outline: "none", background: "var(--surface)", color: "var(--ink)", resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Type</label><select value={editor.type} onChange={(e) => setEditor({ ...editor, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div className="field"><label>Delivery</label><select value={editor.delivery} onChange={(e) => setEditor({ ...editor, delivery: e.target.value })}>{DELIVERIES.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Visibility</label><select value={editor.visibility} onChange={(e) => setEditor({ ...editor, visibility: e.target.value })}>{VISIBILITIES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></div>
              <div className="field"><label>Expires at (optional)</label><input type="datetime-local" value={editor.expires_at} onChange={(e) => setEditor({ ...editor, expires_at: e.target.value })} /></div>
            </div>
            {!editor.id && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, marginBottom: 8 }}>
                <input type="checkbox" checked={editor.publish_now} onChange={(e) => setEditor({ ...editor, publish_now: e.target.checked })} />
                Publish immediately
              </label>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setEditor(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
