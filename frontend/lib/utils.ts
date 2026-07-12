// lib/utils.ts — tiny classname helper (shadcn-style `cn`, dependency-free).
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
