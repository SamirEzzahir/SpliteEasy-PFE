"use client";
// components/admin/usePerms.ts — convenience hook for permission checks in pages.

import { useAuth } from "@/lib/auth/AuthContext";
import { parsePermissions, hasPermission } from "@/lib/api/admin";

export function usePerms() {
  const { user } = useAuth();
  const perms = parsePermissions(user?.role);
  return {
    perms,
    has: (perm: string) => hasPermission(perms, perm),
    userId: user?.id,
  };
}
