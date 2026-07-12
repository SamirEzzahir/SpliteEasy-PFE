"use client";
// components/admin/Forbidden.tsx — 403 shown when a signed-in user lacks admin access.

import Link from "next/link";
import Icon from "@/components/Icon";

export default function Forbidden() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 420, width: "100%", padding: 32, textAlign: "center" }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
            display: "grid", placeItems: "center",
            background: "var(--rose-soft)", color: "var(--rose)",
          }}
        >
          <Icon name="lock" size={26} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>403 — Access denied</h1>
        <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "0 0 20px" }}>
          You don&apos;t have permission to view the admin panel. If you believe this is a
          mistake, contact a Super Admin.
        </p>
        <Link href="/dashboard" className="btn btn-primary" style={{ textDecoration: "none" }}>
          <Icon name="dashboard" size={15} /> Back to app
        </Link>
      </div>
    </div>
  );
}
