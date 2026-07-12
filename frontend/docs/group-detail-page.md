# Group Detail Page — `/groups/[id]`

> **Route:** `http://localhost:3000/groups/179`
> **File:** `frontend/app/groups/[id]/page.tsx`
> **Type:** Client Component (`"use client"`)
> **Dynamic segment:** `[id]` — numeric group ID from the URL

---

## Table of Contents

1. [Overview](#1-overview)
2. [Page Layout](#2-page-layout)
3. [Desktop Layout](#3-desktop-layout)
4. [Mobile Layout](#4-mobile-layout)
5. [Features](#5-features)
6. [State Management](#6-state-management)
7. [Data Flow & API Calls](#7-data-flow--api-calls)
8. [Unified Row System](#8-unified-row-system)
9. [Stat Cards](#9-stat-cards)
10. [Filter Bar](#10-filter-bar)
11. [Expense Table (Desktop)](#11-expense-table-desktop)
12. [Expense Cards (Mobile)](#12-expense-cards-mobile)
13. [Settlement Rows](#13-settlement-rows)
14. [Row Actions](#14-row-actions)
15. [Delete Flow](#15-delete-flow)
16. [Modals](#16-modals)
17. [Group Chat](#17-group-chat)
18. [Header Actions — Desktop vs Mobile](#18-header-actions--desktop-vs-mobile)
19. [Share Calculations](#19-share-calculations)
20. [Balance Calculations](#20-balance-calculations)
21. [Components Used](#21-components-used)
22. [Types & Interfaces](#22-types--interfaces)
23. [CSS Classes Reference](#23-css-classes-reference)
24. [Responsive Breakpoints](#24-responsive-breakpoints)
25. [Known Limitations](#25-known-limitations)
26. [Related Pages](#26-related-pages)

---

## 1. Overview

The Group Detail page is the operational heart of a group — it shows every expense and settlement in a single unified feed, with full CRUD capabilities for expenses, real-time settlement tracking, financial stat cards, and a floating group chat.

It combines two types of records in one chronological table:
- **Expenses** — regular group expenses (food, transport, etc.)
- **Settlements** — payment records between members (shown with teal styling)

The page adapts completely between desktop (full data table) and mobile (card-based layout) using a CSS show/hide approach with no JavaScript switching.

---

## 2. Page Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Breadcrumb: Groups > Group Name                                 │
├──────────────────────────────────────────────────────────────────┤
│  Page Header                                                     │
│  "Expenses"  ·  subtitle       [Export] [Import] [+Add] [Members│
│                                 [Settle]   (desktop only)        │
│                                 [⋯]        (mobile only)         │
├──────────────────────────────────────────────────────────────────┤
│  5 Stat Cards (inline, no card wrapper)                         │
│  Total │ You Owe │ You Are Owed │ Unsettled │ Settled           │
├──────────────────────────────────────────────────────────────────┤
│  Card: Filters + Table/Cards + Pagination                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [Date ▼] [Category ▼] [Paid By ▼] [↔ Settlements] [🔍] │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ DESKTOP TABLE (hidden on mobile)                         │   │
│  │ Expense │ Category │ Paid By │ Participants │ Amount │   │   │
│  │ Your Share │ Date │ Actions                              │   │
│  │ ─── or ───                                               │   │
│  │ MOBILE CARDS (hidden on desktop)                         │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ Pagination                                               │   │
│  └──────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│  [💬 Chat bubble — fixed bottom-right, always visible]          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Desktop Layout

On desktop (≥769px):

- `.exp-table` is visible (`display: table`)
- `.gx-exp-cards` is hidden (`display: none`)
- All 5 action buttons in the header are visible
- Mobile `⋯` menu (`gx-more-wrap`) is hidden via `.gx-hide-mobile`
- Stat grid shows 5 columns (3 at ≤1100px, 2 at ≤720px)

**Table columns:**

| Column | Content |
|--------|---------|
| Expense | Icon + title + subtitle |
| Category | Colored pill |
| Paid By | Avatar + first name |
| Participants | AvatarStack (up to 3) |
| Amount | Total amount, bold |
| Your Share | Label (You lent/owe/Even) + amount |
| Date | Relative date + time |
| Actions | Icon buttons: View 👁 · Edit ✏️ · Delete 🗑 |

---

## 4. Mobile Layout

On mobile (≤768px):

- `.exp-table` is hidden (`display: none`)
- `.gx-exp-cards` is visible (`display: flex, flex-direction: column`)
- Header action buttons collapse into a single `⋯` button (`.gx-more-wrap.gx-show-mobile`)
- `⋯` opens a floating menu (`.gx-more-menu`) with all 4 secondary actions
- Only "Add Expense" button always remains visible in the header
- Stat grid collapses: 5col → 3col → 2col → 1col across breakpoints

**Mobile card structure (`.gx-exp-card`):**

```
┌─────────────────────────────────────────┐
│  [Category icon]  Title       MAD XX.XX │  ← .gx-exp-card-top
│                   Date · Time           │
├─────────────────────────────────────────┤
│  Paid by: [avatar] Name   Category: 🍔  │  ← .gx-exp-card-meta (2-col grid)
│  Your share: You lent 30  Participants: │
├─────────────────────────────────────────┤
│  [👁 View]  [✏️ Edit]  [🗑 Delete]       │  ← .gx-exp-card-actions
└─────────────────────────────────────────┘
```

**Settlement mobile card:**

```
┌─────────────────────────────────────────┐  ← teal left border
│  [💱 icon]  Settlement    MAD XX.XX     │
│             Jun 1                       │
├─────────────────────────────────────────┤
│  From: [avatar] Samir    To: [avatar]   │
│  Status: 🕐 Pending      Direction: Paid│
├─────────────────────────────────────────┤
│  [👁 View]                               │
└─────────────────────────────────────────┘
```

### Mobile ⋯ Menu

```
state: showMoreMenu = true
  └── renders:
        <div class="gx-more-backdrop" />  ← click outside to close
        <div class="gx-more-menu">
          Export Excel
          Import Excel
          Members
          Settle Up
        </div>
```

The backdrop is `position: fixed; inset: 0; z-index: 40` — clicking it closes the menu without a global event listener.

---

## 5. Features

| Feature | Description |
|---------|-------------|
| **Unified feed** | Expenses and settlements sorted chronologically newest-first |
| **Settlement toggle** | Button to show/hide settlement rows in the table |
| **5 stat cards** | Total, You Owe, You Are Owed, Unsettled, Settled |
| **Date filter** | All Dates / This Month |
| **Category filter** | Dynamic list from all expense categories in this group |
| **Paid By filter** | Dynamic list of payers who appear in this group |
| **Search** | Filters expenses by title/subtitle AND settlements by username |
| **Pagination** | 7 rows per page, prev/next + numbered buttons |
| **Add expense** | Opens AddExpenseFullModal |
| **Edit expense** | Opens EditExpenseFullModal with pre-filled data |
| **View expense** | Opens ExpenseDetailModal (read-only) |
| **Delete expense** | Swal confirm + 5s undo toast + API delete |
| **View settlement** | Opens SettlementDetailModal |
| **Accept settlement** | From SettlementDetailModal (recipient only) |
| **Reject settlement** | Swal textarea + API call (recipient only) |
| **Settle Up** | Navigates to `/groups/{id}/settle` |
| **Manage members** | Opens ManageGroupMembersModal |
| **Group chat** | Floating chat bubble, fixed bottom-right |
| **Skeleton loading** | 5 stat skeletons + 7 table row skeletons |
| **404 state** | Group not found screen with back link |
| **Export/Import** | Stub buttons (show toast "coming next") |

---

## 6. State Management

All state is local to the page component.

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `query` | `string` | `""` | Search input |
| `monthFilter` | `string` | `"all"` | Date filter: "all" or "this" |
| `categoryFilter` | `string` | `"all"` | Category filter by category ID |
| `paidByFilter` | `string` | `"all"` | Paid-by filter by user ID string |
| `page` | `number` | `1` | Current pagination page |
| `balances` | `ApiBalanceEntry[]` | `[]` | Per-member balance data from settle API |
| `settlementHistory` | `ApiSettlement[]` | `[]` | Settlement records for this group |
| `showSettlements` | `boolean` | `true` | Whether settlement rows are visible in feed |
| `showAddExpense` | `boolean` | `false` | AddExpenseFullModal open |
| `showMembers` | `boolean` | `false` | ManageGroupMembersModal open |
| `viewExpense` | `string \| null` | `null` | Expense ID being viewed in ExpenseDetailModal |
| `viewSettlement` | `ApiSettlement \| null` | `null` | Settlement being viewed in SettlementDetailModal |
| `editExpenseId` | `string \| null` | `null` | Expense ID being edited in EditExpenseFullModal |
| `showMoreMenu` | `boolean` | `false` | Mobile ⋯ menu open state |

### Global State (from `useApp`)

| Value | Purpose |
|-------|---------|
| `groups` | Used to find current group by numeric ID |
| `expenses` | Full expense list, filtered to this group |
| `loading` | Global loading state for skeleton display |
| `addExpense` | Store action to add and refetch |
| `refetchSplitting` | Full data refresh after edits/deletes |
| `showToast` | App-wide toast |

### Auth (from `useAuth`)

| Value | Purpose |
|-------|---------|
| `user.id` | Used as `currentUserId` for share calculations and settlement direction |

---

## 7. Data Flow & API Calls

```
App Store (groups[], expenses[], loading)
    │
    ├── groups.find(g => Number(g.id) === groupId)  → group
    └── expenses.filter(e => e.groupId === id)      → groupExpenses

Side data (fetched independently, not in store)
    ├── settleApi.groupBalances(groupId)   → balances[]
    └── settleApi.groupHistory(groupId)   → settlementHistory[]

Both fetched in parallel via Promise.allSettled() in fetchSideData()
fetchSideData is called:
  - On mount (useEffect on groupId)
  - After accept/reject settlement (from SettlementDetailModal callbacks)
```

### API Calls Summary

| Trigger | API | Endpoint |
|---------|-----|---------|
| Page mount | `settleApi.groupBalances` | `GET /settle/{id}/balances` |
| Page mount | `settleApi.groupHistory` | `GET /settle/{id}/history` |
| Delete expense confirmed | `expensesApi.remove` | `DELETE /expenses/{id}` |
| Accept settlement | `settleApi.acceptSettlement` | `POST /settle/{id}/accept` |
| Reject settlement | `settleApi.rejectSettlement` | `POST /settle/{id}/reject` |
| After delete | `refetchSplitting` | Full store refresh |
| After accept/reject | `fetchSideData` | Balance + history refresh only |

> **Note:** `fetchSideData` uses `Promise.allSettled` not `Promise.all` — if one endpoint fails, the other still succeeds independently. Each failure shows its own error toast.

### Group Resolution

```ts
const groupId = Number(params.id);
const group = groups.find((g) => Number(g.id) === groupId);
```

Both sides are cast to number to avoid string/number comparison mismatch (the store's `g.id` is a string).

---

## 8. Unified Row System

The page merges expenses and settlement records into one chronologically sorted feed.

### Type Definition

```ts
type UnifiedRow =
  | { kind: "expense";    data: Expense;        ts: number }
  | { kind: "settlement"; data: ApiSettlement;  ts: number }
```

### Build Pipeline

```
groupExpenses[]     → map to UnifiedRow { kind: "expense",    ts: e._rawDate }
settlementHistory[] → map to UnifiedRow { kind: "settlement", ts: s.created_at }
                      ↓
            if showSettlements: combine both arrays
            else: expenses only
                      ↓
            sort by ts descending (newest first)
                      ↓
            filtered[] (apply query + date + category + paidBy)
                      ↓
            paged[] (slice by page × pageSize)
```

### Timestamp Parsing

```ts
const toTs = (iso?: string) =>
  iso ? new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime() : 0;
```

The `+ "Z"` suffix ensures backend datetimes without timezone info are parsed as UTC rather than local time, preventing wrong sort order.

### Settlement Filtering

Settlements are only filtered by the search query (not by date, category, or payer):

```ts
if (row.kind === "settlement") {
  if (!q.trim()) return true;
  return `settlement ${from_username} ${to_username}`.toLowerCase().includes(q);
}
```

This means date/category/paidBy filters only affect expense rows.

---

## 9. Stat Cards

Five inline stat cards using `.gx-stat` inside `.stat-grid-5`.

| Card | Value Source | Color |
|------|-------------|-------|
| Total Expenses | `groupExpenses.reduce(sum, e.amount)` | Purple (primary) |
| You Owe | `currentNet < 0 ? Math.abs(currentNet) : 0` | Rose |
| You Are Owed | `currentNet > 0 ? currentNet : 0` | Green |
| Unsettled | Sum of positive balances across all members | Amber |
| Settled | `Math.max(0, total - unsettled)` | Green |

### Balance Source

```ts
const currentRow = balances.find((b) => b.user_id === user?.id);
const currentNet = currentRow?.net ?? currentRow?.balance ?? group?.balance ?? 0;
```

Priority: `net` field → `balance` field → group-level balance → 0.

The `balances` array comes from `settleApi.groupBalances()` and is fetched separately from the main store data.

### Responsive Grid

| Viewport | Columns |
|----------|---------|
| > 1100px | 5 columns |
| 720–1100px | 3 columns |
| 480–720px | 2 columns |
| < 480px | 1 column |

---

## 10. Filter Bar

The filter bar (`.filter-row`) contains:

1. **Date dropdown** — "All Dates" / "This Month"
2. **Category dropdown** — "All Categories" + dynamic list from `CATEGORIES` constant
3. **Paid By dropdown** — "All Paid By" + dynamic list of unique payers in this group's expenses
4. **Show/Hide Settlements button** — toggles `showSettlements` state. Teal border + color when on. Shows count badge when `settlementHistory.length > 0`
5. **Search input** — 280px wide, filters by title/subtitle for expenses, by username for settlements

All filters reset pagination to page 1 via:
```ts
useEffect(() => { setPage(1); }, [query, monthFilter, categoryFilter, paidByFilter]);
```

> **Note:** The settlement toggle does not reset pagination — it's intentional to avoid scroll jump when toggling.

---

## 11. Expense Table (Desktop)

Class: `.exp-table` (visible ≥769px, hidden below)

### Column Details

**Expense cell** (`.exp-cell`):
- 40×40px category icon with soft background color
- Title (`.nm`) — 13.5px bold
- Subtitle (`.ds`) — 11.5px muted

**Your Share cell:**
- Label row: "You lent" (green) / "You owe" (rose) / "Even" / "Not split" (both grey)
- Amount row: calculated share amount

**Actions cell:**
- Three icon buttons (`.tbl-act`): View 👁, Edit ✏️, Delete 🗑
- Delete button has `.danger` class — rose on hover
- Settlement rows show only View 👁

---

## 12. Expense Cards (Mobile)

Class: `.gx-exp-cards` (hidden ≥769px, visible below)

Each card (`.gx-exp-card`) renders the same data as the desktop table row but in a vertical card format:

- **Top section** (`.gx-exp-card-top`): icon + title + date + amount
- **Meta section** (`.gx-exp-card-meta`): 2-column grid with Paid By, Category, Your Share, Participants
- **Actions section** (`.gx-exp-card-actions`): same icon buttons as desktop, separated by a top border

Mobile cards use the same underlying data logic as the desktop table — the share calculation is re-run inline (not DRY'd into a shared function, which is a known limitation).

---

## 13. Settlement Rows

Settlement records appear inline in the expense feed with distinct visual treatment.

### Visual Differentiation

| Property | Value |
|----------|-------|
| Left border | `3px solid var(--teal)` |
| Background | `rgba(20,184,166,0.03)` (very subtle teal tint) |
| Icon background | `rgba(20,184,166,0.12)` teal |
| Amount color | `var(--teal)` |
| Title color | `var(--teal)` |
| Category pill | "Payment" — teal background |

### Settlement Direction Label

```ts
const isPayer = s.from_user_id === user?.id;
// Card subtitle:
isPayer ? `You paid ${s.to_username}` : `${s.from_username} paid you`
```

### Status Pills

| Status | Class | Emoji |
|--------|-------|-------|
| `pending` | `.st-pill.pending` | 🕐 |
| `accepted` | `.st-pill.accepted` | ✅ |
| `rejected` | `.st-pill.rejected` | ❌ |

### Desktop table mapping

In the desktop table, settlement rows repurpose table columns:
| Column | Settlement content |
|--------|--------------------|
| Expense | Settlement icon + "Settlement" title + direction subtitle |
| Category | "Payment" pill (teal) |
| Paid By | From-user avatar + name |
| Participants | To-user avatar + name with "→" prefix |
| Amount | Settlement amount (teal) |
| Your Share | Status pill |
| Date | Formatted date + time |
| Actions | View icon only |

---

## 14. Row Actions

### Expense Row Actions

| Button | Class | Trigger |
|--------|-------|---------|
| View | `.tbl-act` | `setViewExpense(e.id)` → opens ExpenseDetailModal |
| Edit | `.tbl-act` | `setEditExpenseId(e.id)` → opens EditExpenseFullModal |
| Delete | `.tbl-act danger` | `deleteExpense(e.id, e.title)` → Swal confirm flow |

### Settlement Row Actions

| Button | Class | Trigger |
|--------|-------|---------|
| View | `.tbl-act` | `setViewSettlement(s)` → opens SettlementDetailModal |

Accept/Reject actions are inside `SettlementDetailModal` — not inline on the row.

---

## 15. Delete Flow

The delete flow uses a two-step pattern: confirm first, then a 5-second undo window.

```
User clicks Delete
    │
    ▼
Swal.fire confirm dialog
    ├── Cancel → nothing
    └── Confirmed
           │
           ▼
       Start 5-second timer (doDelete)
       Show warning toast with "Undo" button
           │
           ├── User clicks "Undo"
           │     → clearTimeout(timer)
           │     → toast.info("Delete cancelled")
           │
           └── Timer fires (5s)
                 → expensesApi.remove(Number(expenseId))
                 → refetchSplitting()
                 → toast.error on failure
```

**Key implementation detail:** The `undone` flag is a mutable variable captured in the closure — not React state. This avoids stale closure issues when the timer fires.

---

## 16. Modals

### AddExpenseFullModal

- **File:** `components/modals/AddExpenseFullModal.tsx`
- **Trigger:** "+ Add Expense" button (always visible in header)
- **Props:** `defaultGroupId={group.id}`, `onClose`, `onSubmit`
- **On submit:** calls `addExpense(expense)` from store → `refetchSplitting()` inside store action

### EditExpenseFullModal

- **File:** `components/modals/EditExpenseFullModal.tsx`
- **Trigger:** Edit icon on expense row/card
- **Props:** `expense`, `onClose`, `onSaved`, `showToast`
- **On save:** `onSaved` calls `refetchSplitting()`
- **Guard:** Opens only when `expenses.find(e.id === editExpenseId)` returns a value

### ExpenseDetailModal

- **File:** `components/modals/ExpenseDetailModal.tsx`
- **Trigger:** View icon on expense row/card
- **Props:** `expense`, `group`, `onClose`, `onEdit`
- **`onEdit`:** closes detail modal and opens edit modal for same expense

### SettlementDetailModal

- **File:** `components/modals/SettlementDetailModal.tsx`
- **Trigger:** View icon on settlement row/card
- **Props:** `settlement`, `myId`, `currency`, `onClose`, `onAccept`, `onReject`
- **Accept:** `settleApi.acceptSettlement(id)` → `fetchSideData()` (balance + history refresh)
- **Reject:** Swal textarea → `settleApi.rejectSettlement(id, reason)` → `fetchSideData()`
- **Guard:** Shows Accept/Reject only when `status === "pending" && to_user_id === myId`

### ManageGroupMembersModal

- **File:** `components/modals/ManageGroupMembersModal.tsx`
- **Trigger:** "Members" button (desktop header) or ⋯ menu (mobile)
- **Props:** `group`, `onClose`, `onChanged`, `onToast`
- **On change:** calls `refetchSplitting()` to reload member lists

---

## 17. Group Chat

A floating chat widget mounted at the bottom of the page — always visible while on this page.

```tsx
{group && (
  <GroupChat groupId={groupId} groupName={group.name} />
)}
```

- **File:** `components/chat/GroupChat.tsx`
- **Position:** `fixed bottom-right` — does not scroll with page content
- **Desktop:** `width: 340px, height: 460px` panel above the bubble
- **Mobile:** Full-width bottom sheet, `height: 72vh`, positioned above nav bar (`bottom: 144px`)
- **Messages:** Loaded from `GET /groups/{id}/messages` on component mount
- **Real-time:** Receives `new_chat_message` and `typing` events via shared `WSProvider` WebSocket
- **Unread badge:** Increments when messages arrive while chat is closed

See [Group Chat documentation](../components/chat/README.md) for full detail.

---

## 18. Header Actions — Desktop vs Mobile

The page header uses a visibility split pattern:

```tsx
// Desktop — hidden on mobile via .gx-hide-mobile
<button className="btn btn-secondary gx-hide-mobile">Export Excel</button>
<button className="btn btn-secondary gx-hide-mobile">Import Excel</button>
<button className="btn btn-primary">Add Expense</button>  // always visible
<button className="btn btn-secondary gx-hide-mobile">Members</button>
<button className="btn btn-secondary gx-hide-mobile">Settle</button>

// Mobile — shown only on mobile via .gx-show-mobile
<div className="gx-more-wrap gx-show-mobile">
  <button>⋯</button>
  {showMoreMenu && <div className="gx-more-menu">...</div>}
</div>
```

### CSS Visibility Classes

| Class | Desktop (≥769px) | Mobile (≤768px) |
|-------|-----------------|-----------------|
| `.gx-hide-mobile` | `display: visible` | `display: none` |
| `.gx-show-mobile` | `display: none` | `display: visible` |

The mobile `⋯` menu contains all 4 secondary actions from the desktop header. The "Add Expense" button is always visible on both breakpoints as it's the primary CTA.

---

## 19. Share Calculations

Every expense row calculates the current user's financial position relative to that expense.

```ts
const currentUserId = String(user?.id || "");
const yourShare = e.amount / Math.max(1, e.splitIds.length || group?.memberIds.length || 1);
const youArePayer = e.paidBy === currentUserId;
const youParticipate = e.splitIds.length === 0 || e.splitIds.includes(currentUserId);
const notInvolved = !youArePayer && !youParticipate;
const onlyYou = youArePayer && (e.splitIds.length === 0 || (e.splitIds.length === 1 && e.splitIds[0] === currentUserId));
```

### Share Label Logic

| Condition | Label | Color |
|-----------|-------|-------|
| `notInvolved` | "Not split" | Grey |
| `onlyYou` | "Even" | Grey |
| `youArePayer` | "You lent" | Green |
| else | "You owe" | Rose |

### Share Amount Logic

| Condition | Amount shown |
|-----------|-------------|
| `notInvolved` | "—" |
| `onlyYou` | Full expense amount |
| `youArePayer` | `amount - yourShare` (what others owe you) |
| else | `yourShare` (your portion to pay) |

### Split Count

```ts
// Priority: explicit splitIds → group memberIds → 1 (fallback)
e.splitIds.length || group?.memberIds.length || 1
```

If `splitIds` is empty, the expense is assumed to be split equally among all group members.

---

## 20. Balance Calculations

The 5 stat cards derive financial data from two sources: the `balances` array (from settle API) and `groupExpenses` (from store).

```ts
// Total: purely from expense amounts
const total = groupExpenses.reduce((s, e) => s + e.amount, 0);

// Personal balance: from settle API balance entry
const currentRow = balances.find((b) => b.user_id === user?.id);
const currentNet = currentRow?.net ?? currentRow?.balance ?? group?.balance ?? 0;
const youOwe     = currentNet < 0 ? Math.abs(currentNet) : 0;
const youAreOwed = currentNet > 0 ? currentNet : 0;

// Group unsettled: sum of all POSITIVE balance entries
const unsettled = balances
  .filter((b) => (b.net ?? b.balance ?? 0) > 0)
  .reduce((sum, b) => sum + (b.net ?? b.balance ?? 0), 0);

// Settled (estimated): total - unsettled
const settled = Math.max(0, total - unsettled);
```

> ⚠️ The "Settled" stat is an approximation. It assumes `total - unsettled_balances = settled`, which may not precisely match accepted settlement records.

---

## 21. Components Used

| Component | File | Purpose |
|-----------|------|---------|
| `Icon` | `components/Icon.tsx` | All icons |
| `Avatar` | `components/Avatar.tsx` | Payer + settlement participant avatars |
| `AvatarStack` | `components/Avatar.tsx` | Expense participants (up to 3) |
| `AddExpenseFullModal` | `components/modals/AddExpenseFullModal.tsx` | Create expense |
| `EditExpenseFullModal` | `components/modals/EditExpenseFullModal.tsx` | Edit expense |
| `ExpenseDetailModal` | `components/modals/ExpenseDetailModal.tsx` | Read-only expense view |
| `SettlementDetailModal` | `components/modals/SettlementDetailModal.tsx` | Settlement view + accept/reject |
| `ManageGroupMembersModal` | `components/modals/ManageGroupMembersModal.tsx` | Add/remove members |
| `GroupChat` | `components/chat/GroupChat.tsx` | Floating group chat |
| `SkeletonGroupExpenseRow` | `components/Skeleton.tsx` | Table row loading placeholder |
| `SkeletonGroupStat` | `components/Skeleton.tsx` | Stat card loading placeholder |

---

## 22. Types & Interfaces

```ts
// Local discriminated union for the unified feed
type UnifiedRow =
  | { kind: "expense";    data: Expense;        ts: number }
  | { kind: "settlement"; data: ApiSettlement;  ts: number }

// From lib/types.ts
interface Expense {
  id: string;
  title: string;
  subtitle: string;
  groupId: string;
  paidBy: string;           // user ID as string
  categoryId: string;
  amount: number;
  currency?: string;
  date: string;             // formatted display date
  time: string;
  splitIds: string[];       // user IDs as strings
  addedByUsername?: string;
  _rawDate?: string;        // original ISO string for sorting
}

// From lib/api/types.ts
interface ApiBalanceEntry {
  user_id: number;
  username?: string;
  balance?: number;
  net?: number;
  original_net?: number | null;
  global_adjustment?: number | null;
}

interface ApiSettlement {
  id: number;
  group_id?: number;
  from_user_id: number;
  from_username?: string;
  to_user_id: number;
  to_username?: string;
  amount: number;
  status: "pending" | "accepted" | "rejected";
  created_at?: string;
  message?: string | null;
  description?: string | null;
  rejected_reason?: string | null;
}
```

---

## 23. CSS Classes Reference

| Class | Description |
|-------|-------------|
| `.breadcrumb` | Navigation path at top of page |
| `.page-head` | Flex header with title + action buttons |
| `.page-actions` | Flex container for header buttons |
| `.gx-hide-mobile` | Hidden on ≤768px |
| `.gx-show-mobile` | Visible only on ≤768px |
| `.gx-more-wrap` | Relative wrapper for mobile ⋯ menu |
| `.gx-more-backdrop` | Fixed full-screen click-outside overlay |
| `.gx-more-menu` | Floating action menu (mobile only) |
| `.stat-grid-5` | 5-column responsive stat grid |
| `.gx-stat` | Individual stat card (no card wrapper — inline) |
| `.filter-row` | Horizontal filter bar with wrapping |
| `.exp-table` | Main data table (desktop) |
| `.exp-cell` | Icon + text cell layout |
| `.cat-pill` | Colored category label pill |
| `.tbl-actions` | Action button group (flex) |
| `.tbl-act` | Individual icon action button |
| `.tbl-act.danger` | Red hover state for delete |
| `.gx-exp-cards` | Mobile card list container |
| `.gx-exp-card` | Individual mobile expense card |
| `.gx-exp-card-top` | Card header row |
| `.gx-exp-card-meta` | 2-column metadata grid |
| `.gx-exp-card-actions` | Card action buttons row |
| `.st-pill` | Settlement status pill |
| `.st-pill.pending` | Yellow pending pill |
| `.st-pill.accepted` | Green accepted pill |
| `.st-pill.rejected` | Red rejected pill |
| `.pag` | Pagination row |
| `.pag-pages` | Page number buttons |
| `.pag-btn` | Individual page button |
| `.pag-btn.active` | Current page button (primary color) |

---

## 24. Responsive Breakpoints

| Breakpoint | Layout changes |
|-----------|---------------|
| **≥ 769px** | Desktop table visible, mobile cards hidden, all header buttons visible |
| **≤ 768px** | Mobile cards visible, desktop table hidden, header collapses to ⋯ menu |
| **≤ 1100px** | Stat grid: 5 → 3 columns |
| **≤ 720px** | Stat grid: 3 → 2 columns |
| **≤ 480px** | Stat grid: 2 → 1 column |
| **≤ 768px** | Group chat panel: full-width bottom sheet instead of 340px popup |

### Key CSS Pattern — Table/Cards Switch

```css
/* Desktop: show table, hide cards */
@media(min-width: 769px) {
  .gx-exp-cards { display: none; }
}

/* Mobile: hide table, show cards */
@media(max-width: 768px) {
  .exp-table    { display: none; }
  .gx-exp-cards { display: flex; flex-direction: column; }
}
```

This is a CSS-only switch — no JavaScript state or window resize listener involved.

---

## 25. Known Limitations

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Export/Import are stubs** — both show `showToast("coming next")`. These are prominent header buttons. | Medium |
| 2 | **Share logic duplicated** — the `yourShare` / `shareLabel` / `shareColor` / `shareAmt` calculation block appears identically in both the desktop table render and the mobile card render (inside `paged.map`). Should be extracted to a utility function. | Low (tech debt) |
| 3 | **`fmtMad` is hardcoded to MAD** — the page-local `fmtMad` function always formats as MAD regardless of `group.currency`. The global `fmt(amount, currency)` function exists and should be used instead. | Medium |
| 4 | **Pagination has no truncation** — with 50+ expenses, all page buttons render. Smart ellipsis pagination exists in `app/expenses/page.tsx` but not here. | Low |
| 5 | **Settlement filters don't apply date/category/payer** — settlements pass through all filters except search. A settlement from last month is still visible when "This Month" filter is active. | Low |
| 6 | **`balances` and `settlementHistory` are not in the global store** — they are fetched locally with `fetchSideData`. If the user navigates away and back, they re-fetch. No caching. | Low |
| 7 | **No optimistic UI on delete** — the expense row stays visible for up to 5 seconds (the undo window) before actually disappearing. The row doesn't grey out during this window. | Low |
| 8 | **Group not found state lacks ARIA** — the 404-style "Group not found" screen has no `role="alert"` or live region. | Low |

---

## 26. Related Pages

| Page | Route | Relationship |
|------|-------|-------------|
| Groups list | `/groups` | Parent — breadcrumb links here |
| Group Settlements | `/groups/[id]/settle` | "Settle" button navigates here |
| Global Expenses | `/expenses` | Shows same expenses across all groups |
| Group Chat (component) | — | Embedded as `<GroupChat>` on this page |
