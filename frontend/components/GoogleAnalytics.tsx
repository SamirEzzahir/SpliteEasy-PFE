"use client";

import { useEffect, useRef } from "react";
import { usePublicSettings } from "@/lib/public-settings";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean;
};

/** GA's enhanced page measurement handles client-side history navigation. */
export default function GoogleAnalytics() {
  const { settings } = usePublicSettings();
  const configured = useRef(new Set<string>());
  const id = settings.google_analytics_measurement_id?.trim().toUpperCase() || "";

  useEffect(() => {
    if (!/^G-[A-Z0-9]{4,20}$/.test(id)) return;
    const target = window as unknown as AnalyticsWindow;
    target[`ga-disable-${id}`] = false;
    target.dataLayer ||= [];
    target.gtag ||= function () { target.dataLayer!.push(arguments); };
    if (!document.getElementById("google-analytics-tag")) {
      target.gtag("js", new Date());
      const script = document.createElement("script");
      script.id = "google-analytics-tag";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
      document.head.appendChild(script);
    }
    if (!configured.current.has(id)) {
      target.gtag("config", id);
      configured.current.add(id);
    }
    return () => { target[`ga-disable-${id}`] = true; };
  }, [id]);

  return null;
}
