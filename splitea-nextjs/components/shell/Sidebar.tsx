"use client";
// components/shell/Sidebar.tsx — left navigation

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth/AuthContext";

interface NavItem { id: string; label: string; icon: string; href: string; }

const NAV: NavItem[] = [
  { id: "dashboard",   label: "Dashboard",      icon: "dashboard", href: "/dashboard" },
  { id: "groups",      label: "Groups",         icon: "groups",    href: "/groups" },
  { id: "expenses",    label: "Expenses",       icon: "expense",   href: "/expenses" },
  { id: "settlements", label: "Settlements",    icon: "settle",    href: "/settlements" },
  { id: "balances",    label: "Balances",       icon: "money",     href: "/balances" },
  { id: "friends",     label: "Friends",        icon: "friends",   href: "/friends" },
  { id: "reports",     label: "Reports",        icon: "reports",   href: "/reports" },
  { id: "activity",    label: "Activity",       icon: "activity",  href: "/activity" },
  { id: "settings",    label: "Settings",       icon: "settings",  href: "/settings" },
];

interface SidebarProps {
  dark: boolean;
  onToggleDark: () => void;
}

export default function Sidebar({ dark, onToggleDark }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const displayName = user?.full_name || user?.username || "Account";
  const initials = (user?.full_name || user?.username || "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">$</div>
        <div className="brand-name">
          Split<em>Easy</em>
        </div>
      </div>
      <nav className="nav">
        {NAV.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.id}
              href={it.href}
              className={"nav-item" + (active ? " active" : "")}
            >
              <Icon name={it.icon} size={17} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sb-bottom">
        <div className="sb-profile">
          <div className="sb-profile-img">{initials}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="nm">{displayName}</div>
            <div className="sub">View profile</div>
          </div>
          <Icon name="chev" size={14} className="chev" />
        </div>
        <div className="sb-wallet">
          <div className="sb-wallet-head">
            <span className="sb-wallet-lbl">Wallet Balance</span>
            <span className="sb-wallet-cur">
              {user?.preferred_currency || "USD"} <Icon name="chev" size={10} />
            </span>
          </div>
          <div className="sb-wallet-v num">—</div>
          <div className="sb-wallet-trend">
            ↑ 12.5%{" "}
            <span style={{ color: "#9ea4b2", fontWeight: 400, marginLeft: 2 }}>
              vs last month
            </span>
          </div>
        </div>
        <div className="sb-toggle">
          <span className="sb-toggle-nm">
            <Icon name={dark ? "sun" : "moon"} size={15} />
            Dark mode
          </span>
          <button
            className={"switch" + (dark ? " on" : "")}
            onClick={onToggleDark}
            aria-label="Toggle dark mode"
          />
        </div>
      </div>
    </aside>
  );
}
