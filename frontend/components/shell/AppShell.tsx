"use client";
// components/shell/AppShell.tsx — sidebar + topbar + page + global modals + bottom nav

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Toast from "./Toast";
import MobileBottomNav from "./MobileBottomNav";
import { useApp } from "@/lib/store";
import { usePublicSettings } from "@/lib/public-settings";
import Icon from "@/components/Icon";
import AnnouncementBanner from "./AnnouncementBanner";
import CelebrateOverlay from "@/components/modals/CelebrateOverlay";
import AddExpenseFullModal from "@/components/modals/AddExpenseFullModal";
import CreateGroupModal from "@/components/modals/CreateGroupModal";

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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { toast, celebrate, closeCelebrate, addExpense } = useApp();
  const { settings } = usePublicSettings();
  const pathname = usePathname();

  // Detect if we're on a group detail page and extract the group id
  const groupPageMatch = pathname?.match(/^\/groups\/([^/]+)$/);
  const currentGroupId = groupPageMatch?.[1] ?? undefined;

  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("light");

  const [showAddExpense,  setShowAddExpense]  = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("spliteasy.theme") as ThemeChoice | null) || "light";
    setThemeChoice(stored);
    applyTheme(stored);

    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ choice?: ThemeChoice }>).detail;
      if (detail?.choice) setThemeChoice(detail.choice);
    };
    const onSystemChange = () => {
      const latest = (localStorage.getItem("spliteasy.theme") as ThemeChoice | null) || "light";
      if (latest === "system") applyTheme(latest);
    };
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");

    window.addEventListener("spliteasy:theme-change", onThemeChange);
    mq?.addEventListener?.("change", onSystemChange);
    return () => {
      window.removeEventListener("spliteasy:theme-change", onThemeChange);
      mq?.removeEventListener?.("change", onSystemChange);
    };
  }, []);

  const toggleDarkMode = () => {
    const next = effectiveTheme(themeChoice) === "dark" ? "light" : "dark";
    setThemeChoice(next);
    applyTheme(next);
  };

  return (
    <div className="app">
      <Sidebar dark={effectiveTheme(themeChoice) === "dark"} onToggleDark={toggleDarkMode} />
      <div className="main">
        <Topbar />
        {settings.maintenance_mode && (
          <div
            role="status"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              margin: "16px 36px 0", padding: "10px 14px", borderRadius: 12,
              background: "var(--warn-soft)", color: "var(--warn)",
              border: "1px solid var(--warn)", fontSize: 13, fontWeight: 500,
            }}
          >
            <Icon name="alertTriangle" size={16} />
            <span><strong>Maintenance mode is ON.</strong> {settings.maintenance_message || "Only administrators can use the app right now."}</span>
          </div>
        )}
        <AnnouncementBanner />
        <div className="page">{children}</div>
      </div>

      <MobileBottomNav
        onAddExpense={() => setShowAddExpense(true)}
        onCreateGroup={() => setShowCreateGroup(true)}
      />

      {showAddExpense && (
        <AddExpenseFullModal
          defaultGroupId={currentGroupId}
          onClose={() => setShowAddExpense(false)}
          onSubmit={(e) => { addExpense(e); setShowAddExpense(false); }}
        />
      )}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onSubmit={() => setShowCreateGroup(false)}
        />
      )}

      {celebrate && (
        <CelebrateOverlay jar={celebrate.jar} amount={celebrate.amount} onClose={closeCelebrate} />
      )}
      {toast && <Toast msg={toast} />}
    </div>
  );
}

// Hook for children to read tweaks (kept for backward compatibility with pages that import it)
export function useAppTweaks() {
  const [tweaks, setTweaks] = useState({
    vizStyle: "cards" as "cards" | "stacked" | "illustrated" | "treemap",
    showDonut: true,
    accent: "#5b4ef0",
    dark: false,
  });
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setTweaks((prev) => ({ ...prev, ...detail }));
    };
    window.addEventListener("spliteasy:tweaks", onChange);
    return () => window.removeEventListener("spliteasy:tweaks", onChange);
  }, []);
  return tweaks;
}
