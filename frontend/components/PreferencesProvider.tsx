"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { loadLocalPreferences, setPreferredCurrency } from "@/lib/preferences";

export default function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  useEffect(() => {
    loadLocalPreferences();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || ["spliteasy.dateFormat", "spliteasy.numberFormat"].includes(event.key)) loadLocalPreferences();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => { setPreferredCurrency(user?.preferred_currency); }, [user?.id, user?.preferred_currency]);
  return <>{children}</>;
}
