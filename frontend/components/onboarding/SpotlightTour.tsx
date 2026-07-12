"use client";
// components/onboarding/SpotlightTour.tsx — interactive spotlight tour.
// Dims the screen, cuts a "hole" around each target element (via a big box-shadow),
// and shows a tooltip. Targets are matched by data-tour selectors on the page.

import { useEffect, useLayoutEffect, useState } from "react";
import Icon from "@/components/Icon";

export interface TourStep {
  selector: string;
  title: string;
  body: string;
}

interface Props {
  steps: TourStep[];
  labels: { next: string; back: string; done: string; skip: string };
  rtl?: boolean;
  onClose: () => void;
}

const PAD = 8; // breathing room around the highlighted element

export default function SpotlightTour({ steps, labels, rtl, onClose }: Props) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];
  const isLast = i === steps.length - 1;

  // Locate + track the current target element
  useLayoutEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    // keep the spotlight glued to the element during scroll/resize
    const id = window.setInterval(update, 100);
    const stop = window.setTimeout(() => window.clearInterval(id), 700);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!step) return null;

  // Tooltip placement: below the target, or above if the target sits low on screen
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const placeAbove = rect ? rect.bottom > vh * 0.62 : false;
  const tooltipStyle: React.CSSProperties = rect
    ? placeAbove
      ? { top: Math.max(12, rect.top - PAD - 12), left: rect.left + rect.width / 2, transform: "translate(-50%,-100%)" }
      : { top: rect.bottom + PAD + 12, left: rect.left + rect.width / 2, transform: "translate(-50%,0)" }
    : { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };

  return (
    <div className="ob-tour" dir={rtl ? "rtl" : "ltr"}>
      {/* Spotlight hole (or full dim if target missing) */}
      {rect ? (
        <div
          className="ob-tour-hole"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className="ob-tour-dim" />
      )}

      {/* Tooltip */}
      <div className="ob-tour-tip" style={tooltipStyle}>
        <div className="ob-tour-tip-title">{step.title}</div>
        <div className="ob-tour-tip-body">{step.body}</div>
        <div className="ob-tour-tip-foot">
          <div className="ob-tour-dots">
            {steps.map((_, idx) => <span key={idx} className={idx === i ? "active" : ""} />)}
          </div>
          <div className="ob-tour-btns">
            {i > 0 && (
              <button className="btn btn-secondary" onClick={() => setI((v) => v - 1)}>{labels.back}</button>
            )}
            {isLast ? (
              <button className="btn btn-primary" onClick={onClose}>{labels.done}</button>
            ) : (
              <button className="btn btn-primary" onClick={() => setI((v) => v + 1)}>
                {labels.next} <Icon name="chevR" size={13} />
              </button>
            )}
          </div>
        </div>
        <button className="ob-tour-skip" onClick={onClose} aria-label={labels.skip}>
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}
