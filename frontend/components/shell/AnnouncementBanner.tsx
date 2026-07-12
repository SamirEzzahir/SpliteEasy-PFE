"use client";
// components/shell/AnnouncementBanner.tsx — shows active banner announcements
// (dismissible) and the first active popup (once per session) for signed-in users.

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth/AuthContext";
import { announcementsApi, type ActiveAnnouncement } from "@/lib/api/announcements";

const DISMISS_KEY = "spliteasy.ann.dismissed";
const POPUP_KEY = "spliteasy.ann.popups";

function readIds(storage: Storage, key: string): number[] {
  try { return JSON.parse(storage.getItem(key) || "[]"); } catch { return []; }
}

const TONE: Record<string, { bg: string; fg: string; border: string }> = {
  security: { bg: "var(--rose-soft)", fg: "var(--rose)", border: "var(--rose)" },
  emergency: { bg: "var(--rose-soft)", fg: "var(--rose)", border: "var(--rose)" },
  maintenance: { bg: "var(--warn-soft)", fg: "var(--warn)", border: "var(--warn)" },
  release: { bg: "var(--success-soft)", fg: "var(--success)", border: "var(--success)" },
  feature: { bg: "var(--primary-soft)", fg: "var(--primary)", border: "var(--primary)" },
};

export default function AnnouncementBanner() {
  const { user } = useAuth();
  const [items, setItems] = useState<ActiveAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [popup, setPopup] = useState<ActiveAnnouncement | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    announcementsApi.active().then((list) => {
      if (!alive) return;
      setItems(list);
      setDismissed(readIds(localStorage, DISMISS_KEY));
      const seenPopups = readIds(sessionStorage, POPUP_KEY);
      const nextPopup = list.find((a) => a.delivery === "popup" && !seenPopups.includes(a.id));
      if (nextPopup) {
        setPopup(nextPopup);
        sessionStorage.setItem(POPUP_KEY, JSON.stringify([...seenPopups, nextPopup.id]));
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [user]);

  function dismiss(id: number) {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  }

  if (!user) return null;
  const banners = items.filter((a) => a.delivery === "banner" && !dismissed.includes(a.id));

  return (
    <>
      {banners.map((a) => {
        const t = TONE[a.type] ?? TONE.feature;
        return (
          <div key={a.id} role="status" style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 36px 0", padding: "10px 14px", borderRadius: 12, background: t.bg, color: t.fg, border: `1px solid ${t.border}`, fontSize: 13 }}>
            <Icon name="bell" size={16} />
            <span style={{ flex: 1 }}><strong>{a.title}</strong> — {a.body}</span>
            <button onClick={() => dismiss(a.id)} aria-label="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: t.fg, display: "grid", placeItems: "center" }}>
              <Icon name="x" size={15} />
            </button>
          </div>
        );
      })}

      {popup && (
        <div onClick={() => setPopup(null)} style={{ position: "fixed", inset: 0, background: "rgba(11,15,26,.45)", zIndex: 300, display: "grid", placeItems: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 460, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: (TONE[popup.type] ?? TONE.feature).bg, color: (TONE[popup.type] ?? TONE.feature).fg }}>
                <Icon name="bell" size={18} />
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{popup.title}</h2>
            </div>
            <p style={{ fontSize: 14, color: "var(--ink-2)", whiteSpace: "pre-wrap", margin: "0 0 18px" }}>{popup.body}</p>
            <div style={{ textAlign: "right" }}>
              <button className="btn btn-primary" onClick={() => setPopup(null)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
