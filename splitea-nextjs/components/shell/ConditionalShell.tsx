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
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
