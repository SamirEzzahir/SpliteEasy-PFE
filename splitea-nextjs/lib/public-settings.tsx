"use client";
// lib/public-settings.tsx — fetches /settings/public once and exposes platform
// identity, feature flags, and maintenance status to the whole app. Feature flags
// default to ON while loading so nothing flickers/hides prematurely.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";

export interface PublicSettings {
  app_name: string;
  app_description: string;
  logo_url: string;
  favicon_url: string;
  default_language: string;
  default_timezone: string;
  maintenance_mode: boolean;
  maintenance_message: string;
  registration_enabled: boolean;
  email_verification_enabled: boolean;
  feature_chat: boolean;
  feature_notifications: boolean;
  feature_budget: boolean;
  feature_reports: boolean;
  feature_support: boolean;
}

const DEFAULTS: PublicSettings = {
  app_name: "SplitEasy",
  app_description: "",
  logo_url: "",
  favicon_url: "",
  default_language: "en",
  default_timezone: "UTC",
  maintenance_mode: false,
  maintenance_message: "",
  registration_enabled: true,
  email_verification_enabled: false,
  feature_chat: true,
  feature_notifications: true,
  feature_budget: true,
  feature_reports: true,
  feature_support: true,
};

type FeatureKey = "chat" | "notifications" | "budget" | "reports" | "support";

interface Ctx {
  settings: PublicSettings;
  loading: boolean;
  feature: (name: FeatureKey) => boolean;
  refresh: () => Promise<void>;
}

const PublicSettingsCtx = createContext<Ctx | null>(null);

export function PublicSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<Partial<PublicSettings>>("/settings/public", { skipAuthRedirect: true });
      setSettings({ ...DEFAULTS, ...data });
    } catch {
      setSettings(DEFAULTS); // never block the app on settings
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const feature = useCallback(
    (name: FeatureKey) => settings[`feature_${name}` as keyof PublicSettings] !== false,
    [settings],
  );

  return (
    <PublicSettingsCtx.Provider value={{ settings, loading, feature, refresh }}>
      {children}
    </PublicSettingsCtx.Provider>
  );
}

export function usePublicSettings(): Ctx {
  const ctx = useContext(PublicSettingsCtx);
  if (!ctx) {
    // Tolerant fallback so components can call this outside the provider in tests.
    return { settings: DEFAULTS, loading: false, feature: () => true, refresh: async () => {} };
  }
  return ctx;
}
