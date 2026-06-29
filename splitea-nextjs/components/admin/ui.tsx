"use client";
// components/admin/ui.tsx — small shared bits for the admin pages:
// status badges, date helpers, and SweetAlert2 confirm/prompt wrappers.

import Swal from "sweetalert2";

const PRIMARY = "#5b4ef0";
const DANGER = "#e5484d";

export function UserAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = (name || "?")
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        display: "grid", placeItems: "center",
        fontSize: Math.round(size * 0.4), fontWeight: 600, color: "#fff",
        background: "linear-gradient(135deg, var(--primary), var(--primary-2))",
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function fmtDate(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active" ? "is-active" :
    status === "suspended" ? "is-suspended" :
    status === "banned" ? "is-banned" : "is-neutral";
  return <span className={`admin-badge-pill ${cls}`}>{status}</span>;
}

export function ReportStatusBadge({ status }: { status: string }) {
  const cls =
    status === "open" ? "is-pending" :
    status === "reviewing" ? "is-pending" :
    status === "actioned" ? "is-accepted" : "is-neutral";
  return <span className={`admin-badge-pill ${cls}`}>{status}</span>;
}

export function SettlementBadge({ status }: { status: string }) {
  const cls =
    status === "accepted" ? "is-accepted" :
    status === "rejected" ? "is-rejected" : "is-pending";
  return <span className={`admin-badge-pill ${cls}`}>{status}</span>;
}

export async function confirmAction(opts: {
  title: string;
  text?: string;
  confirmText?: string;
  danger?: boolean;
}): Promise<boolean> {
  const res = await Swal.fire({
    title: opts.title,
    text: opts.text,
    icon: opts.danger ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? "Confirm",
    cancelButtonText: "Cancel",
    confirmButtonColor: opts.danger ? DANGER : PRIMARY,
    cancelButtonColor: "#9aa0ac",
    reverseButtons: true,
  });
  return res.isConfirmed;
}

export async function promptText(opts: {
  title: string;
  label?: string;
  inputType?: "text" | "password";
  placeholder?: string;
  confirmText?: string;
}): Promise<string | null> {
  const res = await Swal.fire({
    title: opts.title,
    input: opts.inputType ?? "text",
    inputLabel: opts.label,
    inputPlaceholder: opts.placeholder,
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? "Save",
    confirmButtonColor: PRIMARY,
    cancelButtonColor: "#9aa0ac",
    reverseButtons: true,
    inputValidator: (v: string) => (!v ? "This field is required" : undefined),
  });
  return res.isConfirmed ? (res.value as string) : null;
}

export async function promptSelect(opts: {
  title: string;
  options: Record<string, string>;
  confirmText?: string;
}): Promise<string | null> {
  const res = await Swal.fire({
    title: opts.title,
    input: "select",
    inputOptions: opts.options,
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? "Apply",
    confirmButtonColor: PRIMARY,
    cancelButtonColor: "#9aa0ac",
    reverseButtons: true,
  });
  return res.isConfirmed ? (res.value as string) : null;
}
