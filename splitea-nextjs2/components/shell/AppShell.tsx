"use client";
// components/shell/AppShell.tsx — sidebar + topbar + page + global modals + tweaks panel

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Toast from "./Toast";
import { useApp } from "@/lib/store";
import CelebrateOverlay from "@/components/modals/CelebrateOverlay";
import TweaksPanel, { useTweaks } from "@/components/tweaks/TweaksPanel";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { toast, celebrate, closeCelebrate, triggerEmpty, triggerCelebrate, reset } = useApp();
  const [tweaks, setTweak] = useTweaks({
    vizStyle: "cards",
    showDonut: true,
    accent: "#5b4ef0",
    dark: false,
  });

  // expose viz style + donut flag to child pages via a CSS var + global event
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spliteasy:tweaks", { detail: tweaks }));
  }, [tweaks]);

  return (
    <div className="app" style={{ ["--primary" as never]: tweaks.accent }}>
      <Sidebar dark={!!tweaks.dark} onToggleDark={() => setTweak("dark", !tweaks.dark)} />
      <div className="main">
        <Topbar />
        <div className="page">{children}</div>
      </div>
      {celebrate && (
        <CelebrateOverlay jar={celebrate.jar} amount={celebrate.amount} onClose={closeCelebrate} />
      )}
      {toast && <Toast msg={toast} />}
      <TweaksPanel
        tweaks={tweaks}
        setTweak={setTweak}
        onTriggerEmpty={triggerEmpty}
        onTriggerCelebrate={triggerCelebrate}
        onReset={reset}
      />
    </div>
  );
}

// Hook for children to read tweaks
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
