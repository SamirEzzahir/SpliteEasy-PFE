// lib/people-cache.ts — runtime map of users encountered via API responses.
// Mappers register users here so personById() can resolve them by id.

import type { Person } from "./types";
import type { ApiUser } from "./api/types";
import { mapUserToPerson } from "./api/mappers";

const cache = new Map<string, Person>();
let currentUserId: number | null = null;

export function setCurrentUserId(id: number | null) {
  currentUserId = id;
  // Refresh any cached entry for the current user so the `you` flag flips.
  if (id != null) {
    const existing = cache.get(String(id));
    if (existing) cache.set(String(id), { ...existing, you: true });
  }
}

export function registerUser(u: ApiUser): Person {
  const p = mapUserToPerson(u, currentUserId ?? undefined);
  cache.set(p.id, p);
  return p;
}

export function registerUsers(users: ApiUser[]) {
  for (const u of users) registerUser(u);
}

export function lookupPerson(id: string): Person | undefined {
  return cache.get(id);
}
