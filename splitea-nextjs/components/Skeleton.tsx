"use client";
// components/Skeleton.tsx — shimmer skeleton building blocks

import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

/** Single skeleton shimmer block */
export default function Skeleton({ width = "100%", height = 16, borderRadius = 8, className = "", style }: SkeletonProps) {
  return (
    <div
      className={"sk-block " + className}
      style={{ width, height, borderRadius, ...style }}
      aria-hidden="true"
    />
  );
}

/** Skeleton card matching the group grid card */
export function SkeletonGroupCard() {
  return (
    <div className="sk-group-card" aria-hidden="true">
      <div className="sk-group-hero" />
      <div className="sk-group-body">
        <Skeleton width="60%" height={18} borderRadius={6} />
        <Skeleton width="40%" height={13} borderRadius={5} style={{ marginTop: 6 }} />
        <Skeleton width="50%" height={13} borderRadius={5} style={{ marginTop: 4 }} />
        <div className="sk-group-footer">
          <Skeleton width="80%" height={10} borderRadius={4} />
          <Skeleton width="40px" height={28} borderRadius={8} />
        </div>
      </div>
    </div>
  );
}

/** Skeleton row for the expense table */
export function SkeletonExpenseRow() {
  return (
    <tr className="sk-expense-row" aria-hidden="true">
      <td><div className="sk-exp-ic" /></td>
      <td><Skeleton width="55%" height={14} borderRadius={5} /><Skeleton width="35%" height={11} borderRadius={4} style={{ marginTop: 5 }} /></td>
      <td><Skeleton width="70px" height={22} borderRadius={10} /></td>
      <td><div className="sk-avatar-sm" /></td>
      <td><Skeleton width="80px" height={14} borderRadius={5} /></td>
      <td><Skeleton width="60px" height={14} borderRadius={5} /></td>
      <td><Skeleton width="24px" height={24} borderRadius={6} /></td>
    </tr>
  );
}

/** Skeleton stat card (for dashboard / expenses stats row) */
export function SkeletonStatCard() {
  return (
    <div className="sk-stat-card" aria-hidden="true">
      <div className="sk-stat-ic" />
      <div className="sk-stat-body">
        <Skeleton width="50%" height={13} borderRadius={5} />
        <Skeleton width="70%" height={26} borderRadius={7} style={{ marginTop: 8 }} />
        <Skeleton width="40%" height={11} borderRadius={4} style={{ marginTop: 6 }} />
      </div>
    </div>
  );
}

/** Skeleton row for the group detail expense table (8 columns) */
export function SkeletonGroupExpenseRow() {
  return (
    <tr className="sk-expense-row" aria-hidden="true">
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="sk-exp-ic" />
          <div style={{ flex: 1 }}>
            <Skeleton width="70%" height={13} borderRadius={5} />
            <Skeleton width="45%" height={11} borderRadius={4} style={{ marginTop: 5 }} />
          </div>
        </div>
      </td>
      <td><Skeleton width="70px" height={22} borderRadius={10} /></td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="sk-avatar-sm" />
          <Skeleton width="50px" height={13} borderRadius={5} />
        </div>
      </td>
      <td><div className="sk-avatar-sm" /></td>
      <td><Skeleton width="80px" height={14} borderRadius={5} /></td>
      <td>
        <Skeleton width="55px" height={12} borderRadius={4} />
        <Skeleton width="65px" height={14} borderRadius={5} style={{ marginTop: 4 }} />
      </td>
      <td>
        <Skeleton width="70px" height={13} borderRadius={5} />
        <Skeleton width="45px" height={11} borderRadius={4} style={{ marginTop: 4 }} />
      </td>
      <td>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <Skeleton width={28} height={28} borderRadius={7} />
          <Skeleton width={28} height={28} borderRadius={7} />
          <Skeleton width={28} height={28} borderRadius={7} />
        </div>
      </td>
    </tr>
  );
}

/** Skeleton stat card for the group detail 5-stat grid */
export function SkeletonGroupStat() {
  return (
    <div className="gx-stat sk-block" style={{ minHeight: 80, display: "flex", flexDirection: "column", gap: 8, padding: 16, background: "var(--surface)", borderRadius: 12 }} aria-hidden="true">
      <Skeleton width="55%" height={12} borderRadius={4} />
      <Skeleton width="70%" height={22} borderRadius={6} />
      <Skeleton width="40%" height={11} borderRadius={4} />
    </div>
  );
}

/** Skeleton dashboard recent expense row */
export function SkeletonDashRow() {
  return (
    <div className="sk-dash-row" aria-hidden="true">
      <div className="sk-avatar-sm" />
      <div style={{ flex: 1 }}>
        <Skeleton width="55%" height={13} borderRadius={5} />
        <Skeleton width="35%" height={11} borderRadius={4} style={{ marginTop: 5 }} />
      </div>
      <Skeleton width="60px" height={14} borderRadius={5} />
    </div>
  );
}
