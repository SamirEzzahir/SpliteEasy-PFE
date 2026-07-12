"use client";
// components/onboarding/OnboardingHelpButton.tsx — "?" replay trigger.
// Dispatches an event the OnboardingGuide listens for, so the two stay decoupled.

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { getOnboardingStrings } from "./strings";

export default function OnboardingHelpButton() {
  const [lang, setLang] = useState("en");
  useEffect(() => { setLang(localStorage.getItem("spliteasy.lang") || "en"); }, []);
  const t = getOnboardingStrings(lang);

  return (
    <button
      className="btn btn-secondary"
      onClick={() => window.dispatchEvent(new Event("spliteasy:open-guide"))}
      title={t.replay}
    >
      <Icon name="info" size={14} /> {t.replay}
    </button>
  );
}
