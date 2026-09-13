"use client";
// components/shell/Topbar.tsx

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import Icon from "@/components/Icon";
import NotificationsBell from "./NotificationsBell";
import { useAuth } from "@/lib/auth/AuthContext";

export default function Topbar() {
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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setProfileOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
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
      <Link href="/dashboard" className="topbar-brand" aria-label="SplitEasy home">Split<span>Easy</span></Link>
      <div className="topbar-spacer" />

      <NotificationsBell />

      <div ref={profileRef} style={{ position: "relative" }}>
        <button
          className="profile"
          aria-expanded={profileOpen}
          aria-label="Account menu"
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
            <Link href="/settings" className="profile-pop-item" onClick={() => setProfileOpen(false)}>Account settings</Link>
            <button className="profile-pop-item" onClick={logout}>
              <Icon name="settle" size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
