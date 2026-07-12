# Dashboard Page — `/dashboard`

> **Route:** `http://localhost:3000/dashboard`
> **File:** `frontend/app/dashboard/page.tsx`
> **Type:** Client Component (`"use client"`)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Page Layout](#2-page-layout)
3. [Desktop Layout](#3-desktop-layout)
4. [Mobile Layout](#4-mobile-layout)
5. [Features](#5-features)
6. [Data Sources](#6-data-sources)
7. [Derived Calculations](#7-derived-calculations)
8. [Sections Breakdown](#8-sections-breakdown)
9. [Sparkline Component](#9-sparkline-component)
10. [Donut Chart](#10-donut-chart)
11. [Quick Actions](#11-quick-actions)
12. [Components Used](#12-components-used)
13. [Responsive Breakpoints](#13-responsive-breakpoints)
14. [CSS Classes Reference](#14-css-classes-reference)
15. [Mock / Placeholder Data](#15-mock--placeholder-data)
16. [Known Limitations](#16-known-limitations)
17. [Related Pages](#17-related-pages)

---

## 1. Overview

The Dashboard is the landing page after login (`/` and post-auth redirect both route here in current builds, though the app currently sends users to `/groups`). It gives a financial snapshot across the whole app: net balance, income, expenses, savings, spending by category, recent activity, settlement summary, and quick navigation.

It is **read-only** — every interactive element is either a navigation link to another page or a "coming next" toast. No data is mutated here.

The page maintains **two parallel layouts**: a desktop grid layout and a separate set of mobile-only sections (hero card, summary chips, mobile header). CSS `display` toggles between them at the 720px breakpoint — there is no JavaScript branching.

---

## 2. Page Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  [Mobile header]  ☰  SplitEasy  🔔     (mobile only)            │
├──────────────────────────────────────────────────────────────────┤
│  Dashboard                              [📅 This Month ▼]        │
│  Welcome back, {name}!                                           │
├──────────────────────────────────────────────────────────────────┤
│  [Mobile hero: Net Balance gradient card]   (mobile only)       │
├──────────────────────────────────────────────────────────────────┤
│  4 Stat Cards (with sparklines)                                 │
│  Net Balance │ Total Income │ Total Expenses │ Total Saved      │
├──────────────────────────────────────────────────────────────────┤
│  [Mobile summary chips: Groups│Friends│Expenses│Settlements]    │
├──────────────────────────────────────────────────────────────────┤
│  Main Grid (2 columns desktop)                                  │
│  ┌─ Expenses Overview ──────────┐  ┌─ Recent Expenses ───────┐  │
│  │  Donut chart + category list │  │  Last 5 expenses        │  │
│  └──────────────────────────────┘  └─────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  Bottom Grid (3 columns desktop)                                │
│  ┌─ Top Categories ─┐ ┌─ Settlements ─┐ ┌─ Quick Actions ──┐   │
│  │  Horizontal bars │ │  Lent/Owe/Net │ │  6-action grid    │   │
│  └──────────────────┘ └───────────────┘ └───────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│  Reminders banner                            [View all]         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Desktop Layout

On desktop (>720px), the mobile-only sections (`dash-mobile-head`, `dash-mobile-hero`, `dash-mobile-summary`) are hidden via `display: none`. The layout uses CSS grid:

| Section | Grid |
|---------|------|
| `dash-stats-grid` | 4 columns (`repeat(4, 1fr)`) |
| `dash-main-grid` | 2 columns (`1.25fr` / `0.9fr`) — overview + recent |
| `dash-bottom-grid` | 3 columns (`1fr / 0.95fr / 0.95fr`) |
| `dash-donut-wrap` | 2 columns (`280px` donut + flexible legend) |

At ≤1280px, stats collapse to 2 columns and the main/bottom grids stack to a single column.

---

## 4. Mobile Layout

On mobile (≤720px), the page transforms significantly:

| Element | Behaviour |
|---------|-----------|
| `dash-head` (title + filter) | Hidden (`display: none`) |
| `dash-mobile-head` | Shown — hamburger ☰, "SplitEasy" logo, bell with notification dot |
| `dash-mobile-hero` | Shown — purple gradient Net Balance card with sparkline |
| `dash-stats-grid` | 2 columns, sparklines + icons hidden, compact values |
| `dash-mobile-summary` | Shown — 4 mini stat chips (Groups / Friends / Expenses / Settlements) |
| `dash-main-grid` / `dash-bottom-grid` | Single column |
| `dash-donut` | Shrinks to 170px, centered |
| `dash-mobile-nav` | A fixed bottom navigation bar with a center FAB (defined in CSS) |

The mobile hero duplicates the Net Balance stat in a more prominent gradient card — a mobile-first emphasis pattern.

---

## 5. Features

| Feature | Description |
|---------|-------------|
| **4 stat cards** | Net Balance, Total Income, Total Expenses, Total Saved — each with a sparkline |
| **Expenses Overview donut** | Conic-gradient donut of spending by category with a legend |
| **Recent Expenses** | Last 5 expenses, each linking to `/expenses` |
| **Top Spending Categories** | Horizontal bar chart of category spend |
| **Settlements Overview** | You lent / You owe / Net / Pending count |
| **Quick Actions** | 6-tile navigation grid |
| **Reminders banner** | Static placeholder ("3 upcoming reminders") |
| **Mobile hero** | Prominent Net Balance gradient card |
| **Mobile summary chips** | Counts for groups, friends, expenses, settlements |
| **Date filter** | "This Month" button (currently non-functional) |

---

## 6. Data Sources

All data comes from the global app store and auth context. The dashboard performs **no API calls of its own** — it reads already-loaded store slices.

### From `useApp()`

| Value | Type | Used for |
|-------|------|----------|
| `expenses` | `Expense[]` | Total expenses, category breakdown, recent list, count |
| `groups` | `Group[]` | Group count, expense → group name resolution |
| `friends` | `FriendRow[]` | You lent / You owe / pending settlements / friend count |
| `income` | `number` | Total income, net balance, total saved |
| `showToast` | `fn` | Reminders "coming next" toast |

### From `useAuth()`

| Value | Used for |
|-------|----------|
| `user.full_name` / `user.username` | Display name greeting (falls back to "Samir") |
| `user.preferred_currency` | Currency formatting (falls back to "USD") |

---

## 7. Derived Calculations

All calculations run inline on every render (no memoization):

```ts
const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
const netBalance    = income - totalExpenses;
const totalSaved    = Math.max(0, income * 0.2);   // ⚠️ hardcoded 20% assumption

const youLent = friends
  .filter((f) => f.balance > 0)
  .reduce((sum, f) => sum + f.balance, 0);

const youOwe = Math.abs(
  friends.filter((f) => f.balance < 0).reduce((sum, f) => sum + f.balance, 0)
);

const pendingSettlements = friends
  .filter((f) => f.balance !== 0 && f.status === "friend").length;
```

### Category Totals

```ts
const categoryTotals = CATEGORIES
  .map((c) => ({ ...c, amount: expenses.filter(e => e.categoryId === c.id).reduce(...) }))
  .filter((c) => c.amount > 0)
  .sort((a, b) => b.amount - a.amount);
```

If no categories have spend, a **fallback demo set** is used (accom 600, food 250.5, transport 120) so the donut never renders empty.

---

## 8. Sections Breakdown

### Stat Cards (`dash-stats-grid`)

Four cards rendered from an inline array. Each has a label, value, meta (delta), icon, and tone color:

| Card | Value | Meta | Tone |
|------|-------|------|------|
| Net Balance | `income - totalExpenses` | "Income - Expenses" | violet |
| Total Income | `income` | "12.5% vs last month" ⚠️ hardcoded | green |
| Total Expenses | `totalExpenses` | "8.3% vs last month" ⚠️ hardcoded | red |
| Total Saved | `income * 0.2` | "15.2% vs last month" ⚠️ hardcoded | blue |

### Expenses Overview (`dash-overview-panel`)

- Conic-gradient donut with total in the center
- Category legend: color dot, name, percentage, amount (top 5)

### Recent Expenses (`dash-recent-panel`)

- `expenses.slice(0, 5)` — first 5 in array order (⚠️ not sorted by date)
- Each row links to `/expenses`
- Shows category icon, title, subtitle/group name, amount, date

### Top Spending Categories (`dash-bars`)

- Top 5 categories as horizontal bars
- Bar width = `Math.max(pct, 8)%` (minimum 8% so tiny categories stay visible)

### Settlements Overview (`dash-settle-list`)

- You lent (green) / You owe (red) / Net balance / Pending count
- Links to `/settlements`

### Quick Actions (`dash-actions-grid`)

- 6 navigation tiles (see [Quick Actions](#11-quick-actions))

### Reminders (`dash-reminder`)

- Static "You have 3 upcoming reminders" banner
- "View all" → `showToast("Reminders coming next")` (stub)

---

## 9. Sparkline Component

```tsx
function Sparkline({ tone }: { tone: "violet" | "green" | "red" | "blue" }) { ... }
```

⚠️ **The sparkline is a static decorative SVG** — the path data is hardcoded and identical for every card regardless of tone or actual data. The `tone` prop only changes the stroke/fill color via CSS class (`.dash-spark.green`, `.dash-spark.red`, etc.).

It does **not** reflect any real trend. On mobile, sparklines inside stat cards are hidden (`display: none`); only the hero card keeps its sparkline.

---

## 10. Donut Chart

Built with a pure CSS `conic-gradient` — no charting library:

```ts
let cursor = 0;
const conicStops = visibleCategories.map((c) => {
  const start = cursor;
  cursor += (c.amount / chartTotal) * 100;
  return `${c.color} ${start}% ${cursor}%`;
}).join(", ");
```

```tsx
<div className="dash-donut" style={{ background: `conic-gradient(${conicStops})` }}>
  <div><strong>{money(totalExpenses || chartTotal)}</strong><span>Total</span></div>
</div>
```

The inner white circle (`dash-donut > div`) creates the donut hole and displays the total. The center value uses `totalExpenses || chartTotal` so the fallback demo total shows when there is no real data.

---

## 11. Quick Actions

```ts
const quickActions = [
  { label: "Add Expense",       icon: "plus",     href: "/expenses" },
  { label: "Create Group",      icon: "groups",   href: "/groups" },
  { label: "Record Settlement", icon: "settle",   href: "/settlements" },
  { label: "Add Income",        icon: "wallet",   href: "/reports" },
  { label: "Import Expenses",   icon: "download",  href: "/expenses" },
  { label: "View Reports",      icon: "reports",   href: "/reports" },
];
```

> ⚠️ These are plain navigation links — they route to the page but don't pre-open a modal or pre-fill an action. e.g. "Add Expense" lands on `/expenses` but doesn't auto-open the add-expense modal.

---

## 12. Components Used

| Component | File | Purpose |
|-----------|------|---------|
| `Icon` | `components/Icon.tsx` | All icons |
| `Link` | `next/link` | Navigation (recent rows, quick actions, settlements link) |
| `Sparkline` | inline (this file) | Decorative trend SVG |
| `fmt` | `lib/format.ts` | Currency formatting via `money()` helper |
| `CATEGORIES` / `categoryById` | `lib/data.ts` | Category metadata + fallback resolution |
| `personById` | `lib/data.ts` | Imported but **not used** in current code |

---

## 13. Responsive Breakpoints

| Breakpoint | Changes |
|-----------|---------|
| **> 1280px** | Full desktop: 4-col stats, 2-col main, 3-col bottom |
| **≤ 1280px** | Stats → 2 col; main + bottom grids → 1 col; donut wrap → `240px + 1fr` |
| **≤ 1024px** | Sidebar hidden, app mobile nav appears (global app shell) |
| **≤ 720px** | Mobile mode: desktop header hidden, mobile header/hero/summary shown, stats 2-col (sparklines + icons hidden), donut shrinks to 170px, bottom nav with FAB |

---

## 14. CSS Classes Reference

| Class | Description |
|-------|-------------|
| `.dashboard-page` | Root flex column container |
| `.dash-mobile-head` | Mobile top bar (hidden on desktop) |
| `.dash-mobile-icon` | Hamburger / bell buttons; `.with-dot` adds notification badge |
| `.dash-head` | Desktop title + filter row |
| `.dash-filter` | "This Month" date filter button |
| `.dash-mobile-hero` | Mobile gradient Net Balance card |
| `.dash-stats-grid` | 4-stat responsive grid |
| `.dash-stat-card` | Individual stat card; `.green/.red/.blue` tones |
| `.dash-stat-icon` | Circular tinted icon |
| `.dash-spark` | Sparkline SVG; tone classes set color |
| `.dash-mobile-summary` | Mobile 4-chip summary row |
| `.dash-quick-mini` | Individual mobile summary chip |
| `.dash-main-grid` | Overview + recent 2-col grid |
| `.dash-bottom-grid` | Categories + settlements + actions 3-col grid |
| `.dash-panel` | Generic card panel |
| `.dash-panel-head` | Panel header with title + action |
| `.dash-donut-wrap` | Donut + legend layout |
| `.dash-donut` | Conic-gradient donut |
| `.dash-category-list` / `.dash-category-row` | Donut legend rows |
| `.dash-recent-list` / `.dash-recent-row` | Recent expense rows |
| `.dash-bars` / `.dash-bar-row` / `.dash-bar-track` | Category bar chart |
| `.dash-settle-list` | Settlements overview rows |
| `.dash-actions-grid` / `.dash-action` | Quick actions grid + tiles |
| `.dash-reminder` | Bottom reminder banner |
| `.dash-mobile-nav` | Fixed mobile bottom nav with FAB |

---

## 15. Mock / Placeholder Data

The dashboard currently contains several hardcoded/placeholder values that are **not** derived from real data:

| Item | Current value | Should be |
|------|--------------|-----------|
| Stat deltas | "12.5%", "8.3%", "15.2% vs last month" | Computed month-over-month comparison |
| Total Saved | `income * 0.2` (flat 20%) | Real savings figure (jars/savings data) |
| Sparklines | Static SVG path | Actual 6-month/30-day trend |
| Reminders | "You have 3 upcoming reminders" | Real reminders feed |
| Mobile notification dot | CSS `content: "3"` | Real unread count |
| Name fallback | "Samir" | Generic fallback or skipped |
| Fallback categories | accom 600 / food 250.5 / transport 120 | Empty state |

---

## 16. Known Limitations

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Date filter is non-functional** — the "This Month" button (and panel "This Month" buttons) do nothing. All figures are all-time, not month-scoped. | High |
| 2 | **Hardcoded deltas** — "12.5% vs last month" etc. are fake and never change. Misleading on a financial dashboard. | High |
| 3 | **Total Saved is a flat 20% of income** — not real savings data. | High |
| 4 | **Sparklines are decorative** — identical static path on every card, no real trend. | Medium |
| 5 | **Recent expenses not sorted by date** — `expenses.slice(0, 5)` takes the first 5 in array order, which may not be the newest. | Medium |
| 6 | **No memoization** — all reduces/maps recompute on every render. Fine at current scale, but `expenses` can be large. | Low |
| 7 | **No loading state** — unlike other pages, the dashboard has no skeletons; it renders fallback demo data until the store populates. | Medium |
| 8 | **`personById` imported but unused** — dead import. | Low |
| 9 | **Quick Actions don't deep-link** — "Add Expense" routes to `/expenses` but doesn't open the add modal; "Add Income" points to `/reports`. | Low |
| 10 | **Reminders banner is fully static** — count and "View all" are placeholders. | Low |
| 11 | **Mobile notification dot hardcoded to "3"** via CSS content. | Low |
| 12 | **`pendingSettlements` uses friend balances, not real settlement records** — counts friends with non-zero balance, not actual pending settlement requests. | Medium |

---

## 17. Related Pages

| Page | Route | Relationship |
|------|-------|-------------|
| Expenses | `/expenses` | Recent rows + "Add Expense" + "View all" link here |
| Groups | `/groups` | "Create Group" quick action |
| Settlements | `/settlements` | Settlements panel + "Record Settlement" link here |
| Reports | `/reports` | "Add Income" + "View Reports" quick actions |
| Friends | `/friends` | Source of lent/owe/pending data (not directly linked) |
