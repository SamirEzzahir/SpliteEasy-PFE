# Groups Page — `/groups`

> **Route:** `http://localhost:3000/groups`
> **File:** `splitea-nextjs/app/groups/page.tsx`
> **Type:** Client Component (`"use client"`)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Page Layout](#2-page-layout)
3. [Features](#3-features)
4. [Components Used](#4-components-used)
5. [State Management](#5-state-management)
6. [Data Flow](#6-data-flow)
7. [Group Card](#7-group-card)
8. [Detail Panel (Desktop)](#8-detail-panel-desktop)
9. [Mobile Preview Sheet](#9-mobile-preview-sheet)
10. [Modals](#10-modals)
11. [Group Actions](#11-group-actions)
12. [Filtering & Sorting](#12-filtering--sorting)
13. [Pagination](#13-pagination)
14. [Balance Logic](#14-balance-logic)
15. [Group Visuals](#15-group-visuals)
16. [Types & Interfaces](#16-types--interfaces)
17. [API Calls](#17-api-calls)
18. [Known Limitations](#18-known-limitations)
19. [Related Pages](#19-related-pages)

---

## 1. Overview

The Groups page is the central hub for managing shared expense groups. It allows users to:

- View all their groups at a glance with balance summaries
- Create, edit, and delete groups
- Manage group members
- Preview a group's expenses and financial status without leaving the page
- Navigate to the full group expense list

The page follows a **master-detail layout**: a scrollable list of group cards on the left, and a persistent detail panel on the right (desktop) or a bottom sheet (mobile).

---

## 2. Page Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Hero Header                                                     │
│  "Groups"  ·  subtitle  ·  [+ Create Group]                      │
├──────────────────────────────────────────────────────────────────┤
│  Summary Bar                                                     │
│  Active Groups │ Total Spending │ You Are Owed │ You Owe         │
├──────────────────────────────────────────────────────────────────┤
│  Toolbar                                                         │
│  [🔍 Search]  [Type ▼]  [Sort ▼]           [Grid|List toggle]   │
├──────────────────────────────┬───────────────────────────────────┤
│  Main: Group Cards           │  Detail Panel (desktop only)      │
│  ┌──────────┐ ┌──────────┐   │  ┌─────────────────────────────┐  │
│  │ Card     │ │ Card     │   │  │  Hero image + group info    │  │
│  │ (grid)   │ │ (grid)   │   │  │  Balance card               │  │
│  └──────────┘ └──────────┘   │  │  Actions                    │  │
│  ┌──────────┐ ┌──────────┐   │  ├─────────────────────────────┤  │
│  │ Card     │ │ Card     │   │  │  Members (up to 6)          │  │
│  └──────────┘ └──────────┘   │  ├─────────────────────────────┤  │
│                              │  │  Recent Expenses (up to 4)  │  │
│  [Pagination]                │  └─────────────────────────────┘  │
└──────────────────────────────┴───────────────────────────────────┘
```

On **mobile (≤720px)**, the detail panel is replaced by a bottom sheet that slides up when a group card is tapped.

---

## 3. Features

| Feature | Description |
|---------|-------------|
| **Grid / List view** | Toggle between card grid (6 per page) and horizontal list (7 per page) |
| **Search** | Filters by group name or member name/email |
| **Type filter** | Filter by group type: All, Trip, Home, Social, Work |
| **Sorting** | Sort by: Recently Updated, Name A–Z, Highest Spend, Biggest Balance |
| **Summary bar** | Shows aggregate stats: active count, total spending, you are owed, you owe |
| **Detail panel** | Right-side panel updates live as group cards are clicked |
| **Mobile bottom sheet** | Full group preview in a modal sheet on small screens |
| **Create group** | Opens `CreateGroupModal` |
| **Edit group** | Opens `EditGroupModal` (backend groups only) |
| **Delete group** | Browser confirm dialog + API call + refetch |
| **Leave group** | Browser confirm dialog + API call + refetch |
| **Manage members** | Opens `ManageGroupMembersModal` |
| **Settlement progress bar** | Visual bar showing % of total expenses that are settled |
| **Balance pill** | Color-coded pill: green = owed, red = you owe, grey = settled |
| **Skeleton loading** | 6 skeleton cards shown while data loads |
| **Empty states** | Separate states for "no groups" and "no search results" |
| **Pagination** | Page through groups with prev/next + numbered buttons |

---

## 4. Components Used

| Component | Path | Purpose |
|-----------|------|---------|
| `Icon` | `components/Icon.tsx` | All icons throughout the page |
| `Avatar` | `components/Avatar.tsx` | Member avatars in detail panel |
| `AvatarStack` | `components/Avatar.tsx` | Stacked member avatars on cards |
| `CreateGroupModal` | `components/modals/CreateGroupModal.tsx` | Create new group |
| `EditGroupModal` | `components/modals/EditGroupModal.tsx` | Edit existing group name/type |
| `ManageGroupMembersModal` | `components/modals/ManageGroupMembersModal.tsx` | Add/remove group members |
| `SkeletonGroupCard` | `components/Skeleton.tsx` | Loading placeholder per card |

---

## 5. State Management

All state is local to the page component. No external state library is used.

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `selectedId` | `string \| null` | `null` | Which group is shown in the detail panel |
| `query` | `string` | `""` | Search input value |
| `view` | `"grid" \| "list"` | `"grid"` | Card layout toggle |
| `typeFilter` | `TypeFilter` | `"all"` | Group type filter |
| `sort` | `SortMode` | `"recent"` | Sort order |
| `showCreate` | `boolean` | `false` | CreateGroupModal visibility |
| `showMembers` | `boolean` | `false` | ManageGroupMembersModal visibility |
| `editingGroup` | `Group \| null` | `null` | Group being edited (passes to EditGroupModal) |
| `cardMenuFor` | `string \| null` | `null` | Which card's ⋯ menu is open |
| `previewMenuOpen` | `boolean` | `false` | Whether detail panel ⋯ menu is open |
| `mobilePreviewOpen` | `boolean` | `false` | Whether mobile bottom sheet is open |
| `booting` | `boolean` | `true` | 450ms skeleton guard on first load |
| `page` | `number` | `1` | Current pagination page |

### Global State (from `useApp`)

| Value | Type | Source |
|-------|------|--------|
| `groups` | `Group[]` | App store — fetched from `/groups` |
| `expenses` | `Expense[]` | App store — fetched from `/expenses/all` |
| `loading` | `boolean` | App store — true while initial fetch is in progress |
| `createGroup` | `fn` | App store action |
| `refetchSplitting` | `fn` | Triggers full data refresh |
| `showToast` | `fn` | App-wide toast notification |

### Auth (from `useAuth`)

| Value | Type | Purpose |
|-------|------|---------|
| `user` | `ApiUser \| null` | Current user — used for preferred currency |

---

## 6. Data Flow

```
Backend API
    │
    ▼
useApp (store.tsx)
    ├── groups[]         ─────────────────────────────────────────┐
    ├── expenses[]       ──────────────────────────────────────┐  │
    └── loading                                                │  │
                                                               │  │
GroupsPage (page.tsx)                                          │  │
    │                                                          │  │
    ├── filtered (useMemo) ◄──── groups[] + query + typeFilter + sort
    │                                                             │
    ├── pagedGroups ◄──── filtered + page + pageSize             │
    │                                                            │
    ├── selectedExpenses ◄── expenses[] + selected.id ◄──────────┘
    │
    ├── groupStats (useMemo) ◄──── groups[] (aggregate sums)
    │
    └── renders:
          Group cards (pagedGroups)
          Detail panel (selected group)
          Mobile sheet (selected group, mobile only)
```

---

## 7. Group Card

Each group renders as an `<article>` with class `group-card group-card-modern`.

### Grid Card Structure

```
┌─────────────────────────────┐
│  Hero image (CSS background)│  ← groupVisuals[group.type].image
│  [Type pill]  [Selected]    │
│  [⋯ menu]    [Group icon]   │
├─────────────────────────────┤
│  Group name                 │
│  X members · Created ...    │
│  [Balance pill]             │
├─────────────────────────────┤
│  Total Expenses             │
│  MAD XX.XX    [avatars]     │
├─────────────────────────────┤
│  Settlement progress bar    │
│  XX%                        │
├─────────────────────────────┤
│  [View Expenses] [Members]  │
└─────────────────────────────┘
```

### List Card Structure

In list mode (`.group-card-modern.list`), the card uses a 2-column CSS grid:
- Left column: hero image (160px wide)
- Right column: all body content

### Card Interactions

| Interaction | Result |
|-------------|--------|
| Click card body | Selects group (updates detail panel). On mobile: opens bottom sheet |
| Click ⋯ button | Opens card context menu (stopPropagation) |
| Click "View Expenses" | Navigates to `/groups/{id}` (stopPropagation) |
| Click "Members" | Opens ManageGroupMembersModal (stopPropagation) |

> **Note:** `stopPropagation()` is used on button clicks inside the card to prevent the card's `onClick` from also firing.

---

## 8. Detail Panel (Desktop)

The right-side `<aside>` panel (class `groups-detail-panel`) is always visible on desktop and updates when a group card is clicked.

### Panel Sections

**1. Hero Card (`gd-hero-card`)**
- Background image matching the group type
- Group icon (colored)
- Group name + member count
- Balance card grid (Total Expenses / You owe or owed / Settlement %)
- Action buttons: View Expenses, Settle Up, Members

**2. Members (`rail-card`)**
- Up to 6 members shown with avatar, name, role (Admin / Member), status badge
- "Manage members" link opens ManageGroupMembersModal

**3. Recent Expenses (`rail-card`)**
- Up to 4 most recent expenses with category icon, title, date, amount
- "View all" link navigates to `/groups/{id}`

### Detail Panel Menu (⋯)

The `previewMenuOpen` state controls a floating menu with:
- Edit group
- Manage members
- Leave group
- Delete group (red, destructive)

Click outside the menu (`mousedown` global listener on `previewMenuRef`) closes it.

---

## 9. Mobile Preview Sheet

On screens ≤720px, clicking a group card opens a **bottom sheet** instead of updating the detail panel.

```
state: mobilePreviewOpen = true
  └── renders:
        <div class="mobile-preview-backdrop">  ← click to close
          <aside class="mobile-group-preview"
                 role="dialog"
                 aria-modal="true">
            [Sheet handle bar]
            [Close × button]
            [Same content as desktop detail panel]
          </aside>
        </div>
```

The detection uses `window.matchMedia("(max-width: 720px)")` at click time — not a CSS media query — so it works inside the event handler.

---

## 10. Modals

### CreateGroupModal

- **Trigger:** "Create Group" button in page header or empty state
- **Props:** `onClose`, `onSubmit(group: Group)`
- **On submit:** calls `createGroup()` from app store, then closes

### EditGroupModal

- **Trigger:** "Edit group" in card menu or detail panel edit button
- **Guard:** Only backend groups (numeric ID) can be edited. Demo groups show a toast.
- **Props:** `group`, `onClose`, `onSaved`, `onToast`
- **On save:** calls `refetchSplitting()` to update the list

### ManageGroupMembersModal

- **Trigger:** "Members" button on card, "Manage members" in detail panel, or "Manage members" in card menu
- **Props:** `group`, `onClose`, `onChanged`, `onToast`
- **On change:** calls `refetchSplitting()` to reload member lists

---

## 11. Group Actions

### Edit Group

```ts
editGroup(group: Group)
  ├── if demo group → showToast("Demo group editing needs a live backend group")
  └── else → setEditingGroup(group) → opens EditGroupModal
```

### Delete Group

```ts
deleteGroup(group: Group)
  ├── if demo group → showToast(...)
  ├── if !confirm("Delete ...?") → return
  ├── await groupsApi.remove(Number(group.id))
  ├── showToast("Group deleted")
  ├── setSelected(null)
  └── await refetchSplitting()
```

> ⚠️ Uses native `window.confirm` — not a Swal dialog. This is inconsistent with the delete pattern used in the expenses pages which use SweetAlert2 with an undo toast.

### Leave Group

```ts
leaveGroup(group: Group)
  ├── if demo group → showToast(...)
  ├── if !confirm("Leave ...?") → return
  ├── await groupsApi.leave(Number(group.id))
  ├── showToast("You left the group")
  ├── setSelected(null)
  └── await refetchSplitting()
```

---

## 12. Filtering & Sorting

### Search

- Searches group `name` and member names/emails
- Member name lookup uses `personById(id)` from the people cache
- Case-insensitive

### Type Filter

```ts
type TypeFilter = "all" | "trip" | "home" | "social" | "work"
```

Matches `group.type` exactly.

### Sort Modes

| Mode | Sort Key | Direction |
|------|----------|-----------|
| `"recent"` | none (preserves API order) | — |
| `"name"` | `group.name` | A → Z |
| `"total"` | `group.total` | Descending |
| `"balance"` | `Math.abs(group.balance)` | Descending |

### Filter + Sort Pipeline

```
groups[]
  → filter by typeFilter
  → filter by query (name or member)
  → sort by selected mode
  = filtered[]
    → paginate
    = pagedGroups[]
```

All computed in a single `useMemo` — recomputes when `groups`, `query`, `sort`, or `typeFilter` changes.

---

## 13. Pagination

- **Grid mode:** 6 groups per page
- **List mode:** 7 groups per page
- Page size changes trigger a `setPage(1)` reset via `useEffect` on `[query, sort, typeFilter, view]`

Pagination renders only when `totalPages > 1`:
- Previous / Next buttons
- Numbered page buttons (all shown, no truncation)

---

## 14. Balance Logic

### `balanceMeta(balance, currency)`

Returns display metadata for the balance pill on each card.

| `balance` | `className` | `label` | Shows value? |
|-----------|-------------|---------|-------------|
| `> 0` | `"owed"` | "You are owed" | Yes |
| `< 0` | `"you-owe"` | "You owe" | Yes (absolute) |
| `=== 0` | `"settled"` | "Settled" | No |

### `settlementPct(group)`

```ts
function settlementPct(group: Group): number {
  const settled = Math.max(0, group.total - Math.abs(group.balance));
  return group.total ? Math.round((settled / group.total) * 100) : 100;
}
```

Approximates how much of the total has been settled:
- If `total = 100` and `|balance| = 30`, then `settled = 70`, `pct = 70%`
- If `total = 0`, returns `100%` (nothing to settle)

### Summary Bar Stats (`groupStats`)

```ts
{
  active: groups.length,
  owed:   sum of balance where balance > 0,
  owe:    sum of |balance| where balance < 0,
  total:  sum of group.total across all groups
}
```

---

## 15. Group Visuals

Each group type maps to a gradient-overlaid Unsplash background image:

| Type | Image theme | Gradient overlay |
|------|-------------|-----------------|
| `trip` | Airport/travel | Purple + Amber |
| `home` | Home interior | Emerald + Teal |
| `social` | Friends/social | Orange + Pink |
| `work` | Office | Sky blue + Purple |

Images are loaded as CSS `background-image` on `.group-visual` divs. They are public Unsplash URLs with `auto=format&fit=crop&w=900&q=80` params for performance.

---

## 16. Types & Interfaces

```ts
// From lib/types.ts
interface Group {
  id: string;
  name: string;
  type: GroupType;           // "trip" | "home" | "social" | "work"
  currency?: string;
  photo?: string | null;
  description?: string;
  icon: string;
  color: string;
  soft: string;
  heroA: string;
  heroB: string;
  memberIds: string[];       // array of user ID strings
  total: number;             // sum of all expense amounts
  balance: number;           // positive = owed to you, negative = you owe
  updated: string;           // formatted date string
}

// Local to page
type ViewMode   = "grid" | "list";
type SortMode   = "recent" | "name" | "total" | "balance";
type TypeFilter = "all" | GroupType;
```

### `isBackendGroup(group: Group): boolean`

```ts
const isBackendGroup = (group: Group) => Number.isFinite(Number(group.id));
```

Guards against demo/seed groups that have non-numeric IDs. Edit, Delete, and Leave operations only work on backend groups.

---

## 17. API Calls

| Action | API call | On success |
|--------|----------|------------|
| Initial data load | `store.refetchSplitting()` via `useApp` | Groups + expenses populated |
| Delete group | `groupsApi.remove(id)` | `refetchSplitting()` |
| Leave group | `groupsApi.leave(id)` | `refetchSplitting()` |
| Create group | `store.createGroup(group)` | `refetchSplitting()` (inside store) |
| Edit group | handled inside `EditGroupModal` | `refetchSplitting()` via `onSaved` |
| Manage members | handled inside `ManageGroupMembersModal` | `refetchSplitting()` via `onChanged` |

**API file:** `lib/api/groups.ts`
**Methods used:** `groupsApi.remove(id: number)`, `groupsApi.leave(id: number)`

---

## 18. Known Limitations

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Hardcoded creator name** — `"Created by Samir Ali"` in both detail panel and mobile sheet. Should read from group owner data. | Medium |
| 2 | **Delete/Leave use `window.confirm`** — inconsistent with the rest of the app which uses SweetAlert2 with undo toasts. | Low |
| 3 | **"Settle Up" button is a stub** — calls `showToast("Settlement flow coming next")`. Should link to `/groups/{id}/settle`. | Medium |
| 4 | **Balance is absolute group net, not pairwise** — `group.balance` reflects the member's total net in the group, not a pairwise balance with specific members. This is a backend data shape issue. | Low |
| 5 | **No group type icon in balance pill** — the pill shows text only; adding a small icon would improve scannability. | Low |
| 6 | **Pagination has no truncation** — for users with 20+ groups, all page buttons render. Smart ellipsis pagination exists on other pages but not here. | Low |
| 7 | **Mobile detection is imperative** — `window.matchMedia()` called on click. Would be more robust as a CSS-driven approach or React state from a resize hook. | Low |

---

## 19. Related Pages

| Page | Route | Relationship |
|------|-------|-------------|
| Group Expenses | `/groups/[id]` | Drill-down from "View Expenses" button |
| Group Settlements | `/groups/[id]/settle` | Drill-down from group expenses page |
| Global Expenses | `/expenses` | Shows all expenses across all groups |
| Friends | `/friends` | Shows friend-level balances |
| Dashboard | `/dashboard` | Shows cross-group summary |
