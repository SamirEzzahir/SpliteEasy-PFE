"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/Icon";

interface Props {
  onAddExpense: () => void;
  onCreateGroup: () => void;
  onAddIncome: () => void;
}

const NAV_ITEMS = [
  { label: "Home",     icon: "home",    href: "/dashboard" },
  { label: "Groups",   icon: "groups",  href: "/groups" },
  { label: "Expenses", icon: "expense",  href: "/expenses" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

export default function MobileBottomNav({ onAddExpense, onCreateGroup, onAddIncome }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef  = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/" || pathname === "/dashboard"
      : pathname === href || pathname.startsWith(href + "/");

  // close sheet on outside tap
  useEffect(() => {
    if (!sheetOpen) return;
    const handler = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setSheetOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") setSheetOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [sheetOpen]);

  function trigger(action: () => void) {
    setSheetOpen(false);
    // slight delay so sheet closes before modal opens
    setTimeout(action, 80);
  }

  return (
    <>
      {/* Action sheet backdrop */}
      {sheetOpen && (
        <div
          className="mob-sheet-backdrop"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav className="app-mobile-nav" aria-label="Primary navigation" ref={sheetRef as any}>
        {/* Left two items */}
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={"mob-nav-item" + (isActive(item.href) ? " active" : "")}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </Link>
        ))}

        {/* Center FAB */}
        <div className="mob-fab-wrap">
          {/* Action sheet */}
          {sheetOpen && (
            <div className="mob-action-sheet" role="menu" aria-label="Quick actions">
              <button
                role="menuitem"
                onClick={() => trigger(onAddExpense)}
              >
                <span className="mob-action-ic" style={{ background: "#eeecff", color: "#5b4ef0" }}>
                  <Icon name="expense" size={18} />
                </span>
                Add Expense
              </button>
              <button
                role="menuitem"
                onClick={() => trigger(onCreateGroup)}
              >
                <span className="mob-action-ic" style={{ background: "#dcfce7", color: "#10b981" }}>
                  <Icon name="groups" size={18} />
                </span>
                Create Group
              </button>
              <button
                role="menuitem"
                onClick={() => trigger(() => router.push("/settlements"))}
              >
                <span className="mob-action-ic" style={{ background: "#fce7f3", color: "#ec4899" }}>
                  <Icon name="settle" size={18} />
                </span>
                Record Settlement
              </button>
              <button
                role="menuitem"
                onClick={() => trigger(onAddIncome)}
              >
                <span className="mob-action-ic" style={{ background: "#fff7ed", color: "#f97316" }}>
                  <Icon name="wallet" size={18} />
                </span>
                Add Income
              </button>
            </div>
          )}

          <button
            className={"mob-fab" + (sheetOpen ? " open" : "")}
            onClick={() => setSheetOpen((v) => !v)}
            aria-label="Quick actions"
            aria-expanded={sheetOpen}
            aria-haspopup="menu"
          >
            <Icon name="plus" size={26} />
          </button>
        </div>

        {/* Right two items */}
        {NAV_ITEMS.slice(2).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={"mob-nav-item" + (isActive(item.href) ? " active" : "")}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
