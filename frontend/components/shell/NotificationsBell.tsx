"use client";
// components/shell/NotificationsBell.tsx — bell icon with unread badge + popover list.

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationsBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button className="icon-btn" onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        <Icon name="bell" size={16} />
        {unread > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="notif-pop">
          <div className="notif-pop-h">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="rail-link" onClick={() => void markAllRead()}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 ? (
              <div className="notif-empty">You&apos;re all caught up.</div>
            ) : (
              items.slice(0, 12).map((n) => (
                <button
                  key={n.id}
                  className={"notif-row" + (n.isRead ? "" : " unread")}
                  onClick={() => !n.isRead && void markRead(n.id)}
                >
                  <span className="notif-dot" />
                  <div className="body">
                    <div className="nm">{n.message}</div>
                    <div className="ds">{n.type}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
