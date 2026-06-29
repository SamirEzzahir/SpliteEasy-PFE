"use client";
// components/admin/AdminShell.tsx — back-office layout: admin sidebar + page.
// Reuses the app's .app/.main/.page shell classes and the same theme handling
// as the main AppShell so dark mode is shared via localStorage.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth/AuthContext";
import { parsePermissions, hasPermission } from "@/lib/api/admin";
import AdminSidebar from "./AdminSidebar";

type ThemeChoice = "system" | "light" | "dark";

function effectiveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice;
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(choice: ThemeChoice) {
  const effective = effectiveTheme(choice);
  document.documentElement.setAttribute("data-theme", effective);
  localStorage.setItem("spliteasy.theme", choice);
  window.dispatchEvent(new CustomEvent("spliteasy:theme-change", { detail: { choice, effective } }));
}

const MOBILE_NAV = [
  { label: "Dashboard",   href: "/admin/dashboard",   perm: "view_dashboard" },
  { label: "Users",       href: "/admin/users",       perm: "view_users" },
  { label: "Groups",      href: "/admin/groups",      perm: "view_groups" },
  { label: "Expenses",    href: "/admin/expenses",    perm: "view_expenses" },
  { label: "Settlements", href: "/admin/settlements", perm: "view_settlements" },
  { label: "Support",     href: "/admin/support",     perm: "view_support" },
  { label: "Roles",       href: "/admin/roles",       perm: "view_roles" },
  { label: "Audit",       href: "/admin/audit-logs",  perm: "view_audit_logs" },
  { label: "Moderation",  href: "/admin/moderation",  perm: "view_moderation" },
  { label: "Announcements", href: "/admin/announcements", perm: "view_announcements" },
  { label: "Analytics",   href: "/admin/analytics",   perm: "view_analytics" },
  { label: "System",      href: "/admin/system",      perm: "view_system" },
  { label: "Settings",    href: "/admin/settings",    perm: "view_settings" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const perms = parsePermissions(user?.role);
  const mobileItems = MOBILE_NAV.filter((it) => hasPermission(perms, it.perm));

  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("light");

  useEffect(() => {
    const stored = (localStorage.getItem("spliteasy.theme") as ThemeChoice | null) || "light";
    setThemeChoice(stored);
    applyTheme(stored);
    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ choice?: ThemeChoice }>).detail;
      if (detail?.choice) setThemeChoice(detail.choice);
    };
    window.addEventListener("spliteasy:theme-change", onThemeChange);
    return () => window.removeEventListener("spliteasy:theme-change", onThemeChange);
  }, []);

  const toggleDarkMode = () => {
    const next = effectiveTheme(themeChoice) === "dark" ? "light" : "dark";
    setThemeChoice(next);
    applyTheme(next);
  };

  return (
    <div className="app">
      <AdminSidebar dark={effectiveTheme(themeChoice) === "dark"} onToggleDark={toggleDarkMode} />
      <div className="main">
        {/* Mobile-only top nav (the sidebar is hidden under 1024px). */}
        <div className="admin-mtop">
          <div className="admin-mtop-brand">
            <span className="brand-mark" style={{ width: 26, height: 26, fontSize: 14 }}>$</span>
            <span>Admin</span>
          </div>
          <nav className="admin-mtop-nav">
            {mobileItems.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + "/");
              return (
                <Link key={it.href} href={it.href} className={"admin-mtop-link" + (active ? " active" : "")}>
                  {it.label}
                </Link>
              );
            })}
            <Link href="/dashboard" className="admin-mtop-link">
              <Icon name="chevR" size={13} style={{ transform: "rotate(180deg)" }} /> App
            </Link>
          </nav>
        </div>
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
