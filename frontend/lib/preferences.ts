export type DateFormat = "dmy" | "mdy" | "iso";
export type NumberFormat = "dot" | "comma" | "space";
export interface Preferences {
  currency: string;
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
}

export const DEFAULT_PREFERENCES: Preferences = { currency: "MAD", dateFormat: "dmy", numberFormat: "dot" };
let current = DEFAULT_PREFERENCES;
const listeners = new Set<() => void>();

export const getServerPreferences = () => DEFAULT_PREFERENCES;
export const getPreferences = () => typeof window === "undefined" ? DEFAULT_PREFERENCES : current;
export function subscribePreferences(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function publish(next: Preferences) {
  if (Object.keys(next).every(key => next[key as keyof Preferences] === current[key as keyof Preferences])) return;
  current = next;
  listeners.forEach(listener => listener());
}

export function loadLocalPreferences() {
  try {
    const date = localStorage.getItem("spliteasy.dateFormat");
    const number = localStorage.getItem("spliteasy.numberFormat");
    publish({ ...current,
      dateFormat: date === "mdy" || date === "iso" ? date : "dmy",
      numberFormat: number === "comma" || number === "space" ? number : "dot",
    });
  } catch { /* Keep session preferences when browser storage is unavailable. */ }
}

export function setDisplayPreference(key: "dateFormat" | "numberFormat", value: string) {
  if (key === "dateFormat" && !["dmy", "mdy", "iso"].includes(value)) return;
  if (key === "numberFormat" && !["dot", "comma", "space"].includes(value)) return;
  publish({ ...current, [key]: value });
  try { localStorage.setItem(`spliteasy.${key}`, value); } catch { /* Apply for this session. */ }
}

// Currency comes from the signed-in profile, never a previous user's browser cache.
export function setPreferredCurrency(currency?: string | null) {
  publish({ ...current, currency: currency?.toUpperCase() || "MAD" });
}
