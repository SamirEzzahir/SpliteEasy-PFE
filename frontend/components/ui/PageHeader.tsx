"use client";
// components/ui/PageHeader.tsx — the single canonical page header.
// Replaces .dash-head / .groups-hero-head / ad-hoc .page-head blocks.

import type { ReactNode } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

interface Crumb { label: string; href?: string }

interface Props {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Optional breadcrumb trail rendered above the title. */
  breadcrumbs?: Crumb[];
}

export default function PageHeader({ title, subtitle, actions, breadcrumbs }: Props) {
  return (
    <>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="breadcrumb">
          {breadcrumbs.map((c, i) => (
            <span key={i} style={{ display: "contents" }}>
              {c.href ? <Link href={c.href}>{c.label}</Link> : <span className="cur">{c.label}</span>}
              {i < breadcrumbs.length - 1 && <Icon name="chevR" size={12} className="sep" />}
            </span>
          ))}
        </div>
      )}
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </>
  );
}
