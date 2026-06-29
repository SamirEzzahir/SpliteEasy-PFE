"use client";
// components/shell/ConditionalShell.tsx — show AppShell + RequireAuth on protected
// routes, render children plain on /login and /signup.

import { usePathname } from "next/navigation";
import AppShell from "./AppShell";
import RequireAuth from "@/components/RequireAuth";

const PUBLIC_PREFIXES = ["/login", "/signup"];

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isPublic) return <>{children}</>;
  // The admin area ships its own shell + guard (app/admin/layout.tsx). Render it
  // bare here so it isn't wrapped in the regular user sidebar/topbar.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return <>{children}</>;
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
