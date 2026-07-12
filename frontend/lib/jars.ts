// lib/jars.ts — initial 6-jar state, strategy presets, donut math

import type { Jar, Tx, Preset } from "./types";

export const INITIAL_JARS: Jar[] = [
  { id: "necessities", name: "Necessities", desc: "Rent, food, bills, transport",
    icon: "home",   color: "#f97316", soft: "#fff1e6", pct: 55, kind: "spend",
    spent: 5248.09, saved: 0 },
  { id: "financial", name: "Financial Freedom", desc: "Investments, passive income",
    icon: "coin",   color: "#10b981", soft: "#dcfce7", pct: 10, kind: "save",
    spent: 0, saved: 1254.07, _celebrated: true },
  { id: "savings", name: "Long-term Savings", desc: "Big purchases, emergencies",
    icon: "target", color: "#f43f5e", soft: "#ffe4e6", pct: 10, kind: "save",
    spent: 0, saved: 1125.50, _celebrated: true },
  { id: "education", name: "Education", desc: "Books, courses, growth",
    icon: "book",   color: "#0ea5e9", soft: "#e0f2fe", pct: 10, kind: "spend",
    spent: 203.83, saved: 0 },
  { id: "play", name: "Play", desc: "Fun, entertainment, dining",
    icon: "party",  color: "#ec4899", soft: "#fce7f3", pct: 10, kind: "spend",
    spent: 408.68, saved: 0 },
  { id: "give", name: "Give", desc: "Charity, gifts, donations",
    icon: "gift",   color: "#8b5cf6", soft: "#ede9fe", pct: 5,  kind: "spend",
    spent: 258.92, saved: 0 },
];

export const INITIAL_TX: Tx[] = [
  { id: 1, date: "May 16, 2026", desc: "Grocery Shopping", jarId: "necessities", type: "expense", amount: 76.80 },
  { id: 2, date: "May 15, 2026", desc: "Stock Investment", jarId: "financial",   type: "expense", amount: 500.00 },
  { id: 3, date: "May 14, 2026", desc: "Online Course",    jarId: "education",   type: "expense", amount: 120.00 },
  { id: 4, date: "May 13, 2026", desc: "Movie Night",      jarId: "play",        type: "expense", amount: 45.00 },
  { id: 5, date: "May 12, 2026", desc: "Charity Donation", jarId: "give",        type: "expense", amount: 30.00 },
  { id: 6, date: "May 1, 2026",  desc: "Salary May 2026",  jarId: null,          type: "income",  amount: 8420.00 },
];

export const INITIAL_INCOME = 8420.00;

export const PRESETS: Preset[] = [
  { id: "default", name: "6-Jar Default", desc: "T. Harv Eker's classic",
    pcts: { necessities: 55, financial: 10, savings: 10, education: 10, play: 10, give: 5 } },
  { id: "503020", name: "50/30/20", desc: "Needs · Wants · Save",
    pcts: { necessities: 50, financial: 10, savings: 10, education: 5, play: 20, give: 5 } },
  { id: "aggressive", name: "Aggressive Save", desc: "Heavy into FI",
    pcts: { necessities: 40, financial: 25, savings: 20, education: 5, play: 5, give: 5 } },
  { id: "balanced", name: "Balanced Growth", desc: "Education-forward",
    pcts: { necessities: 45, financial: 15, savings: 10, education: 15, play: 10, give: 5 } },
];

export const buildDonutSegments = (jars: Jar[]) => {
  let acc = 0;
  return jars.map((j) => {
    const angle = (j.pct / 100) * 360;
    const start = acc;
    acc += angle;
    return { ...j, start, angle };
  });
};
