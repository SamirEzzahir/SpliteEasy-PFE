"use client";
// components/shell/Topbar.tsx

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import NotificationsBell from "./NotificationsBell";
import { useAuth } from "@/lib/auth/AuthContext";

const PLACEHOLDERS: Record<string, string> = {
  "/groups": "Search groups, members...",
  "/friends": "Search friends by name or email...",
};

export default function Topbar() {
  const pathname = usePathname() || "/";
  const placeholder = PLACEHOLDERS[pathname] || "Search anything...";
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [profileOpen]);

  const displayName = user?.full_name || user?.username || "Account";
  const initials = (user?.full_name || user?.username || "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  return (
    <header className="topbar">
      <button
        className="icon-btn"
        style={{ border: 0, background: "transparent" }}
        aria-label="Menu"
      >
        <Icon name="filter" size={18} />
      </button>
      <div className="search" style={{ maxWidth: 520 }}>
        <Icon name="search" size={15} />
        <input placeholder={placeholder} />
      </div>
      <div className="topbar-spacer" />

      <NotificationsBell />

      <button className="icon-btn">
        <Icon name="chat" size={16} />
      </button>

      <div ref={profileRef} style={{ position: "relative" }}>
        <button
          className="profile"
          onClick={() => setProfileOpen((v) => !v)}
          style={{ border: "1px solid var(--line)", cursor: "pointer" }}
        >
          <div className="avatar">{initials}</div>
          <span className="profile-name">{displayName}</span>
          <Icon name="chev" size={14} />
        </button>
        {profileOpen && (
          <div className="profile-pop">
            <div className="profile-pop-h">
              <div className="nm">{displayName}</div>
              <div className="sub">{user?.email}</div>
            </div>
            <button className="profile-pop-item" onClick={logout}>
              <Icon name="settle" size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
