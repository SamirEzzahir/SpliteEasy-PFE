"use client";
// app/activity/page.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { personById } from "@/lib/data";
import { registerUsers } from "@/lib/people-cache";
import { activityApi, type ApiActivityLog } from "@/lib/api/activity";

const PAGE = 20;

type Kind = "all" | "expense" | "settlement" | "group" | "friend";

// ── helpers ──────────────────────────────────────────────────────────────────

function toDate(value: string): Date {
  // Backend timestamps are naive UTC — normalize like the rest of the app.
  return new Date(value.endsWith("Z") ? value : value + "Z");
}

function timeAgo(value: string): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Meta { kind: Exclude<Kind, "all">; icon: string; color: string; soft: string; label: string }

function activityMeta(a: ApiActivityLog): Meta {
  const text = `${a.target_type || ""} ${a.action}`.toLowerCase();
  if (text.includes("expense"))
    return { kind: "expense", icon: "expense", color: "var(--primary)", soft: "var(--primary-soft)", label: "Expense" };
  if (text.includes("settle") || text.includes("paid"))
    return { kind: "settlement", icon: "settle", color: "var(--teal)", soft: "rgba(20,184,166,0.14)", label: "Settlement" };
  if (text.includes("group") || text.includes("member"))
    return { kind: "group", icon: "groups", color: "var(--warn)", soft: "var(--warn-soft)", label: "Group" };
  if (text.includes("friend") || text.includes("request"))
    return { kind: "friend", icon: "userPlus", color: "var(--rose)", soft: "var(--rose-soft)", label: "Friend" };
  return { kind: "expense", icon: "activity", color: "var(--ink-3)", soft: "var(--line)", label: a.target_type || "Activity" };
}

// Human date-bucket for section headers (Today / Yesterday / weekday / date).
function bucketLabel(value: string): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  if (days < 30) return "This month";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const [items, setItems] = useState<ApiActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [kind, setKind] = useState<Kind>("all");

  const fetchPage = useCallback(async (offset: number) => {
    const batch = await activityApi.list(PAGE, offset);
    registerUsers(batch.map((it) => it.user));
    setHasMore(batch.length === PAGE);
    return batch;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchPage(0)
      .then((batch) => { if (!cancelled) setItems(batch); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchPage]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const batch = await fetchPage(items.length);
      setItems((prev) => [...prev, ...batch]);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  // Counts per kind (over everything loaded so far).
  const counts = useMemo(() => {
    const c: Record<Kind, number> = { all: items.length, expense: 0, settlement: 0, group: 0, friend: 0 };
    for (const a of items) c[activityMeta(a).kind]++;
    return c;
  }, [items]);

  const filtered = useMemo(
    () => (kind === "all" ? items : items.filter((a) => activityMeta(a).kind === kind)),
    [items, kind],
  );

  // Group filtered items into ordered date buckets (input is already newest-first).
  const grouped = useMemo(() => {
    const out: { label: string; rows: ApiActivityLog[] }[] = [];
    for (const a of filtered) {
      const label = bucketLabel(a.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(a);
      else out.push({ label, rows: [a] });
    }
    return out;
  }, [filtered]);

  const filters: { id: Kind; label: string }[] = [
    { id: "all", label: "All" },
    { id: "expense", label: "Expenses" },
    { id: "settlement", label: "Settlements" },
    { id: "group", label: "Groups" },
    { id: "friend", label: "Friends" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p>A timeline of everything happening across your groups.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="tabs">
          {filters.map((f) => (
            <button
              key={f.id}
              className={"tab" + (kind === f.id ? " active" : "")}
              onClick={() => setKind(f.id)}
            >
              {f.label}
              {counts[f.id] > 0 && (
                <span
                  className="tab-badge"
                  style={kind !== f.id ? { background: "var(--line)", color: "var(--ink-3)" } : undefined}
                >
                  {counts[f.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="act-row">
                <div className="ic sk-block" style={{ borderRadius: 9 }} />
                <div className="body" style={{ flex: 1 }}>
                  <div className="sk-block" style={{ width: "70%", height: 12, borderRadius: 4, marginBottom: 6 }} />
                  <div className="sk-block" style={{ width: "30%", height: 10, borderRadius: 4 }} />
                </div>
                <div className="sk-block" style={{ width: 40, height: 10, borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-3)" }}>
            <Icon name="activity" size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Couldn&apos;t load activity</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Please try again in a moment.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: "var(--primary-soft)", color: "var(--primary)",
              display: "grid", placeItems: "center", margin: "0 auto 16px",
            }}>
              <Icon name="activity" size={24} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
              {kind === "all" ? "No activity yet" : "Nothing here yet"}
            </div>
            <div style={{ color: "var(--ink-3)", fontSize: 13 }}>
              {kind === "all"
                ? "Add an expense or settle up and it'll show up here."
                : "Switch filters to see other activity."}
            </div>
          </div>
        ) : (
          <>
            {grouped.map((section) => (
              <div key={section.label} style={{ marginTop: 6 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em",
                  color: "var(--ink-4)", padding: "14px 0 6px",
                }}>
                  {section.label}
                </div>
                {section.rows.map((a) => {
                  const meta = activityMeta(a);
                  const person = personById(String(a.user_id));
                  return (
                    <div key={a.id} className="act-row">
                      <div className="ic" style={{ background: meta.soft, color: meta.color }}>
                        <Icon name={meta.icon} size={15} />
                      </div>
                      <div className="body">
                        <div className="nm">
                          <b>{person.you ? "You" : person.name}</b> {a.action}
                        </div>
                        <div className="ds">{meta.label}</div>
                      </div>
                      <div className="when">{timeAgo(a.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            ))}

            {hasMore && kind === "all" && (
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 18 }}>
                <button className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
