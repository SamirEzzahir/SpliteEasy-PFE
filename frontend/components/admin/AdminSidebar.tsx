"use client";
// components/admin/AdminSidebar.tsx — admin back-office left nav.
// Reuses the app's .sidebar / .nav / .nav-item design-system classes. Nav items
// are filtered by the signed-in admin's permissions.

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth/AuthContext";
import { parsePermissions, hasPermission } from "@/lib/api/admin";

interface AdminNavItem { id: string; label: string; icon: string; href: string; perm: string; }

const NAV: AdminNavItem[] = [
  { id: "dashboard",   label: "Dashboard",   icon: "dashboard", href: "/admin/dashboard",   perm: "view_dashboard" },
  { id: "users",       label: "Users",       icon: "friends",   href: "/admin/users",       perm: "view_users" },
  { id: "groups",      label: "Groups",      icon: "groups",    href: "/admin/groups",      perm: "view_groups" },
  { id: "expenses",    label: "Expenses",    icon: "expense",   href: "/admin/expenses",    perm: "view_expenses" },
  { id: "settlements", label: "Settlements", icon: "settle",    href: "/admin/settlements", perm: "view_settlements" },
  { id: "support",     label: "Support",     icon: "chat",      href: "/admin/support",     perm: "view_support" },
  { id: "roles",       label: "Roles",       icon: "shield",    href: "/admin/roles",       perm: "view_roles" },
  { id: "audit",       label: "Audit Logs",  icon: "activity",  href: "/admin/audit-logs",  perm: "view_audit_logs" },
  { id: "moderation",  label: "Moderation",  icon: "alertTriangle", href: "/admin/moderation", perm: "view_moderation" },
  { id: "announce",    label: "Announcements", icon: "bell",    href: "/admin/announcements", perm: "view_announcements" },
  { id: "analytics",   label: "Analytics",   icon: "reports",   href: "/admin/analytics",   perm: "view_analytics" },
  { id: "system",      label: "System",      icon: "info",      href: "/admin/system",      perm: "view_system" },
  { id: "settings",    label: "Settings",    icon: "settings",  href: "/admin/settings",    perm: "view_settings" },
];

interface Props {
  dark: boolean;
  onToggleDark: () => void;
}

export default function AdminSidebar({ dark, onToggleDark }: Props) {
  const pathname = usePathname();
  const { user } = useAuth();
  const perms = parsePermissions(user?.role);
  const items = NAV.filter((it) => hasPermission(perms, it.perm));
  const displayName = user?.full_name || user?.username || "Admin";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">$</div>
        <div className="brand-name">
          Split<em>Easy</em>
          <span className="admin-badge">Admin</span>
        </div>
      </div>

      <nav className="nav">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link key={it.id} href={it.href} className={"nav-item" + (active ? " active" : "")}>
              <Icon name={it.icon} size={17} />
              <span>{it.label}</span>
            </Link>
          );
        })}

        <div className="nav-spacer" />
        <Link href="/dashboard" className="nav-item">
          <Icon name="chevR" size={17} style={{ transform: "rotate(180deg)" }} />
          <span>Back to app</span>
        </Link>
      </nav>

      <div className="sb-bottom">
        <div className="sb-profile">
          <div className="sb-profile-img">{(displayName[0] || "A").toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="nm">{displayName}</div>
            <div className="sub">{user?.role?.name || "Administrator"}</div>
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
