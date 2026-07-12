"use client";
// app/support/page.tsx — user Support Center: list my tickets + create new ones.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import FilterDropdown from "@/components/ui/FilterDropdown";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import Icon from "@/components/Icon";
import Skeleton from "@/components/Skeleton";
import {
  StatusBadge, PriorityBadge, CategoryBadge, fmtWhen,
  STATUS_OPTIONS, CATEGORY_OPTIONS, PRIORITY_OPTIONS,
} from "@/components/support/ui";
import { supportApi, type Ticket } from "@/lib/api/support";
import { apiErrorMessage } from "@/lib/api/client";
import { toast } from "react-toastify";

const STATUS_FILTER = [{ id: "", label: "All statuses" }, ...STATUS_OPTIONS];
const CATEGORY_FILTER = [{ id: "", label: "All categories" }, ...CATEGORY_OPTIONS];

export default function SupportPage() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supportApi.list({ page, page_size: 10, q: debouncedQ || undefined, status: status || undefined, category: category || undefined });
      setRows(res.items); setTotal(res.total); setPages(res.pages);
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [page, debouncedQ, status, category]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Support"
        subtitle="Get help and track your requests"
        actions={<button className="btn btn-primary" onClick={() => setShowCreate(true)}><Icon name="plus" size={15} /> New ticket</button>}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface)", flex: 1, minWidth: 220, maxWidth: 360 }}>
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search my tickets…" style={{ border: 0, outline: 0, background: "transparent", fontSize: 13.5, width: "100%", color: "var(--ink)" }} />
        </div>
        <FilterDropdown icon="filter" label="Status" options={STATUS_FILTER} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
        <FilterDropdown icon="filter" label="Category" options={CATEGORY_FILTER} value={category} onChange={(v) => { setCategory(v); setPage(1); }} />
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <Skeleton width="50%" height={16} /><Skeleton width="30%" height={12} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: 8 }}>
          <EmptyState
            icon="chat"
            title="No tickets yet"
            message="Need help? Open a ticket and our team will get back to you."
            action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>New ticket</button>}
          />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((t) => (
            <Link key={t.id} href={`/support/${t.id}`} className="card" style={{ padding: 16, textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontWeight: 600, color: "var(--ink)" }}>{t.subject}</div>
                <StatusBadge status={t.status} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <CategoryBadge category={t.category} />
                <PriorityBadge priority={t.priority} />
                <span style={{ fontSize: 12, color: "var(--ink-4)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Icon name="chat" size={13} /> {t.reply_count}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-4)", marginLeft: "auto" }}>Updated {fmtWhen(t.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div style={{ marginTop: 16 }}>
          <Pagination page={page} totalPages={pages} onChange={setPage} summary={`${total} ticket${total === 1 ? "" : "s"}`} />
        </div>
      )}

      {showCreate && (
        <NewTicketModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setPage(1); void load(); }}
        />
      )}
    </div>
  );
}

function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("other");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (subject.trim().length < 3) { toast.error("Subject must be at least 3 characters"); return; }
    if (!message.trim()) { toast.error("Please describe your issue"); return; }
    setSaving(true);
    try {
      await supportApi.create({ subject: subject.trim(), message: message.trim(), category, priority });
      toast.success("Ticket created — we'll be in touch");
      onCreated();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,15,26,.45)", zIndex: 200, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>New support ticket</h2>
          <button className="btn btn-ghost" style={{ padding: 8 }} onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITY_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of your issue" maxLength={200} />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe what's happening, steps to reproduce, etc."
            rows={6}
            maxLength={2000}
            style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13.5, outline: "none", background: "var(--surface)", color: "var(--ink)", resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create ticket"}</button>
        </div>
      </div>
    </div>
  );
}
