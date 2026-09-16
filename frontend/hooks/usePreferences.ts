"use client";

import { useSyncExternalStore } from "react";
import { getPreferences, getServerPreferences, subscribePreferences } from "@/lib/preferences";

// Subscribe wherever shared formatters are rendered, including memoized components.
export function usePreferences() {
  return useSyncExternalStore(subscribePreferences, getPreferences, getServerPreferences);
}
