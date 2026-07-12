"use client";
// components/admin/AdminGuard.tsx — gates the admin area.
//   loading        → spinner
//   no session     → redirect to /login
//   non-admin user → 403 Forbidden
//   admin          → render children

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { isAdminUser } from "@/lib/api/admin";
import Forbidden from "./Forbidden";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 13 }}>
        Loading…
      </div>
    );
  }
  if (!user) return null;
  if (!isAdminUser(user.role)) return <Forbidden />;
  return <>{children}</>;
}
