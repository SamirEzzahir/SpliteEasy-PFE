"use client";
// components/onboarding/OnboardingGuide.tsx
// First-time onboarding for new users: a welcome modal + a getting-started checklist.
// - Auto-opens the welcome modal on first login (backend flag onboarding_completed=false).
// - Checklist auto-ticks from real data (groups / members / expenses) and can be dismissed.
// - Replayable anytime via the "spliteasy:open-guide" event (see OnboardingHelpButton).
// - Language follows the user's Settings choice (localStorage "spliteasy.lang").

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp } from "@/lib/store";
import { usersApi } from "@/lib/api/users";
import { getOnboardingStrings } from "./strings";
import SpotlightTour, { type TourStep } from "./SpotlightTour";

// Dashboard elements the tour points at (matched via data-tour attributes).
const TOUR_SELECTORS = ['[data-tour="stats"]', '[data-tour="owes"]', '[data-tour="actions"]', '[data-tour="help"]'];

const HIDE_CHECKLIST_KEY = "spliteasy.onboard.hideChecklist";
// The final "Settle up" step can't be auto-detected from data, so it's marked
// done locally once the user visits it. Key kept as step4Done for continuity.
const SETTLE_STEP_KEY = "spliteasy.onboard.step4Done";
// Key of the manual "Settle up" step (last in the list).
const SETTLE_STEP = 5;

function useLang(): string {
  const [lang, setLang] = useState<string>("en");
  useEffect(() => {
    const read = () => setLang(localStorage.getItem("spliteasy.lang") || "en");
    read();
    window.addEventListener("storage", read);
    window.addEventListener("spliteasy:lang-change", read as EventListener);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("spliteasy:lang-change", read as EventListener);
    };
  }, []);
  return lang;
}

export default function OnboardingGuide() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { groups, expenses, friends } = useApp();
  const lang = useLang();
  const t = useMemo(() => getOnboardingStrings(lang), [lang]);
  const rtl = lang === "ar";

  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [checklistHidden, setChecklistHidden] = useState(true);
  const [settleDone, setSettleDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const tourSteps: TourStep[] = t.tourSteps.map((s, idx) => ({
    selector: TOUR_SELECTORS[idx],
    title: s.title,
    body: s.body,
  }));

  const startTour = () => { setShowWelcome(false); setTimeout(() => setShowTour(true), 150); };

  // Initialise local UI flags
  useEffect(() => {
    setChecklistHidden(localStorage.getItem(HIDE_CHECKLIST_KEY) === "1");
    setSettleDone(localStorage.getItem(SETTLE_STEP_KEY) === "1");
  }, []);

  // Auto-open the welcome modal once, on first login
  useEffect(() => {
    if (user && user.onboarding_completed === false) setShowWelcome(true);
  }, [user]);

  // Allow replay from anywhere
  useEffect(() => {
    const open = () => setShowWelcome(true);
    window.addEventListener("spliteasy:open-guide", open);
    return () => window.removeEventListener("spliteasy:open-guide", open);
  }, []);

  // ── Data-derived checklist state ──────────────────────────────────────────────
  const sFriends = friends.some((f) => f.status === "friend");
  const sGroup = groups.length > 0;
  const sMembers = groups.some((g) => g.memberIds.length > 1);
  const sExpense = expenses.length > 0;
  const steps = [
    { key: 1, done: sFriends, title: t.step1Title, desc: t.step1Desc, icon: "friends", href: "/friends" },
    { key: 2, done: sGroup,   title: t.step2Title, desc: t.step2Desc, icon: "groups",  href: "/groups" },
    { key: 3, done: sMembers, title: t.step3Title, desc: t.step3Desc, icon: "friends", href: "/groups" },
    { key: 4, done: sExpense, title: t.step4Title, desc: t.step4Desc, icon: "expense", href: "/expenses" },
    { key: 5, done: settleDone, title: t.step5Title, desc: t.step5Desc, icon: "settle", href: "/settlements" },
  ];
  const doneCount = steps.filter((x) => x.done).length;

  // Mark the welcome modal as seen (backend flag) — won't auto-open again
  const markSeen = useCallback(async () => {
    setSaving(true);
    try {
      await usersApi.setOnboardingCompleted(true);
      await refresh();
    } catch {
      // Non-fatal: localStorage guard prevents an annoying re-loop this session
      localStorage.setItem("spliteasy.onboard.seen", "1");
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const closeWelcome = async () => { setShowWelcome(false); await markSeen(); };

  const goStep = (href: string, key: number) => {
    if (key === SETTLE_STEP) { localStorage.setItem(SETTLE_STEP_KEY, "1"); setSettleDone(true); }
    setShowWelcome(false);
    router.push(href);
  };

  const dismissChecklist = () => {
    localStorage.setItem(HIDE_CHECKLIST_KEY, "1");
    setChecklistHidden(true);
  };

  if (!user) return null;

  return (
    <div dir={rtl ? "rtl" : "ltr"}>
      {/* ── Welcome modal ── */}
      {showWelcome && (
        <div className="modal-backdrop" onClick={closeWelcome}>
          <div className="modal modal-md ob-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="ob-hero">
              <div className="ob-hero-icon"><Icon name="settle" size={26} style={{ color: "#fff" }} /></div>
              <h2>{t.welcomeTitle}</h2>
              <p>{t.welcomeSubtitle}</p>
            </div>
            <div className="modal-b">
              <p className="ob-intro">{t.intro}</p>
              <div className="ob-steps">
                {steps.map((step, i) => (
                  <div key={step.key} className="ob-step">
                    <div className="ob-step-num">{step.done ? <Icon name="check" size={14} /> : i + 1}</div>
                    <div className="ob-step-body">
                      <div className="ob-step-title">{step.title}</div>
                      <div className="ob-step-desc">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-f" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-secondary" onClick={closeWelcome} disabled={saving}>{t.skip}</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => { void markSeen(); startTour(); }} disabled={saving}>
                  {t.takeTour}
                </button>
                <button className="btn btn-primary" onClick={() => { void markSeen(); goStep("/friends", 1); }} disabled={saving}>
                  {t.start} <Icon name="chevR" size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Getting-started checklist ── */}
      {!checklistHidden && (
        <div className="card ob-checklist">
          <div className="ob-checklist-head">
            <div>
              <h3>{t.checklistTitle}</h3>
              <p>{t.checklistSubtitle}</p>
            </div>
            <div className="ob-progress">
              <span>{t.progress(doneCount, steps.length)}</span>
              <div className="ob-progress-bar"><i style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
            </div>
            <button className="ob-dismiss" onClick={dismissChecklist} aria-label={t.skip}>
              <Icon name="x" size={15} />
            </button>
          </div>
          <div className="ob-checklist-items">
            {steps.map((step) => (
              <button key={step.key} className={"ob-item" + (step.done ? " done" : "")} onClick={() => goStep(step.href, step.key)}>
                <span className="ob-item-check">{step.done ? <Icon name="check" size={14} /> : <Icon name={step.icon} size={16} />}</span>
                <span className="ob-item-body">
                  <span className="ob-item-title">{step.title}</span>
                  <span className="ob-item-desc">{step.desc}</span>
                </span>
                {!step.done && <span className="ob-item-go">{t.go} <Icon name="chevR" size={12} /></span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Interactive spotlight tour ── */}
      {showTour && (
        <SpotlightTour
          steps={tourSteps}
          rtl={rtl}
          labels={{ next: t.tourNext, back: t.tourBack, done: t.tourDone, skip: t.skip }}
          onClose={() => setShowTour(false)}
        />
      )}
    </div>
  );
}
