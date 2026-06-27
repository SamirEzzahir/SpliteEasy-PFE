// lib/data.ts — people, categories, groups, expenses, friends, settlements

import type {
  Person, Category, Group, Expense, FriendRow, Suggestion, ActivityItem, Settlement,
} from "./types";
import { lookupPerson } from "./people-cache";

export const PEOPLE: Person[] = [
  { id: "samir",   name: "Samir Ali",       you: true,                              color: "#f59e0b", color2: "#ec4899" },
  { id: "ahmed",   name: "Ahmed Khaled",    email: "ahmed.khaled@example.com",     color: "#0ea5e9", color2: "#2563eb" },
  { id: "youssef", name: "Youssef Mohamed", email: "youssef.m@example.com",        color: "#5b4ef0", color2: "#7c3aed" },
  { id: "sara",    name: "Sara Ali",        email: "sara.ali@example.com",         color: "#ec4899", color2: "#f43f5e" },
  { id: "omar",    name: "Omar Hassan",     email: "omar.hassan@example.com",      color: "#10b981", color2: "#14b8a6" },
  { id: "lina",    name: "Lina Ben",        email: "lina.ben@example.com",         color: "#f97316", color2: "#f59e0b" },
  { id: "mehdi",   name: "Mehdi Karim",     email: "mehdi.karim@example.com",      color: "#8b5cf6", color2: "#a855f7" },
  { id: "hicham",  name: "Hicham Belkadi",  email: "hicham.b@example.com",         color: "#06b6d4", color2: "#0ea5e9" },
  { id: "nadia",   name: "Nadia Tahiri",    email: "nadia.t@example.com",          color: "#d946ef", color2: "#a855f7" },
  { id: "amine",   name: "Amine Riad",      email: "amine.r@example.com",          color: "#84cc16", color2: "#10b981" },
  { id: "imane",   name: "Imane El Amrani", email: "imane.e@example.com",          color: "#f43f5e", color2: "#be123c" },
  { id: "karim",   name: "Karim Ait Ahmed", email: "karim.a@example.com",          color: "#22c55e", color2: "#0ea5e9" },
];

export const personById = (id: string): Person => {
  // Prefer the live API-populated cache; fall back to the seed PEOPLE list so
  // the design still renders without a backend connection.
  const fromCache = lookupPerson(id);
  if (fromCache) return fromCache;
  const seed = PEOPLE.find((p) => p.id === id);
  if (seed) return seed;
  // Synthesize a stub Person so pages don't crash on unknown ids.
  return {
    id,
    name: "Unknown",
    color: "#94a3b8",
    color2: "#64748b",
  };
};

export const CATEGORIES: Category[] = [
  { id: "food",          name: "Food & Drinks",  icon: "fork",       color: "#5b4ef0", soft: "#eeecff", pillBg: "#fef3c7", pillFg: "#92400e" },
  { id: "transport",     name: "Transport",      icon: "car",        color: "#0ea5e9", soft: "#e0f2fe", pillBg: "#dbeafe", pillFg: "#1e40af" },
  { id: "shopping",      name: "Shopping",       icon: "bag",        color: "#10b981", soft: "#dcfce7", pillBg: "#dcfce7", pillFg: "#065f46" },
  { id: "entertainment", name: "Entertainment",  icon: "controller", color: "#f97316", soft: "#fff1e6", pillBg: "#ffedd5", pillFg: "#9a3412" },
  { id: "bills",         name: "Bills",          icon: "bill",       color: "#ec4899", soft: "#fce7f3", pillBg: "#fce7f3", pillFg: "#9d174d" },
  { id: "accom",         name: "Accommodation",  icon: "bed",        color: "#8b5cf6", soft: "#ede9fe", pillBg: "#ede9fe", pillFg: "#5b21b6" },
  { id: "other",         name: "Others",         icon: "more",       color: "#64748b", soft: "#f1f5f9", pillBg: "#f1f5f9", pillFg: "#334155" },
];

export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export const GROUP_TYPES = [
  { id: "trip",   label: "Trip",   icon: "briefcase" },
  { id: "home",   label: "Home",   icon: "home" },
  { id: "social", label: "Social", icon: "groups" },
  { id: "work",   label: "Work",   icon: "office" },
] as const;

export const SUGGESTIONS: Suggestion[] = [
  { personId: "hicham", mutuals: 10 },
  { personId: "nadia",  mutuals: 9 },
  { personId: "amine",  mutuals: 7 },
  { personId: "imane",  mutuals: 6 },
  { personId: "karim",  mutuals: 5 },
];
