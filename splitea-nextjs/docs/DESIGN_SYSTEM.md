# Splitea — Design System & Page-Building Contract

> **Read this before building or editing any page or component.**
> Goal: every screen feels like **one product**, scoring **7–8/10 UX/UI**.
> Product is an **expense-sharing app** (Splitwise-style). Never personal-finance / wallet / budgeting.

---

## 0. The One Rule

Every screen must answer, within 5 seconds:
> **"Who owes what, and what do I do next?"**

If a UI element doesn't help answer that, it's noise — cut it.

---

## 1. Non-Negotiables (do these every time)

1. **Reuse, never reinvent.** Use the shared primitives below. Do **not** create a new stat-card / header / dropdown style per page.
2. **Currency:** always format money with `fmt(amount, currency)` from `@/lib/format`. Fallback is **always `"MAD"`** — never `"USD"`.
3. **Colors come from CSS variables only.** Never hardcode hex (`#2563eb`, etc.). Use the tokens in §2.
4. **Two radii only:** `var(--radius)` (14px) for cards/inputs, `999px` for pills/avatars.
5. **One page header pattern** (§4). One stat-card pattern (§5).
6. **Mobile-first:** every table needs a mobile card fallback. Touch targets ≥ 44px.
7. **Loading = skeletons**, never a blank screen or spinner-only.
8. **Empty states** always have an icon + one-line explanation + a CTA.

---

## 2. Design Tokens (from `globals.css`)

### Colors — use the variable, never the hex
| Token | Meaning | Use for |
|-------|---------|---------|
| `--primary` / `--primary-2` | Brand violet | Primary CTAs, active states, links |
| `--primary-soft` | Violet tint | Active backgrounds, soft fills |
| `--success` / `--success-soft` | Green | **"You are owed" / positive / settled** |
| `--rose` / `--rose-soft` | Red | **"You owe" / negative / destructive** |
| `--teal` | Teal | **Settlements only** (payments between members) |
| `--warn` / `--warn-soft` | Amber | Pending / attention / unsettled |
| `--ink`, `--ink-2`, `--ink-3`, `--ink-4` | Text scale | Title → muted → faint |
| `--line`, `--line-2` | Borders | Card borders, dividers |
| `--surface`, `--surface-2`, `--bg` | Backgrounds | Cards, insets, page |

**Color semantics are sacred — keep them consistent everywhere:**
- 🟢 Green = money coming **to** you (owed to you, lent, settled)
- 🔴 Red = money going **out** (you owe, debt, delete)
- 🔵 Teal = a settlement / payment record
- 🟠 Amber = pending / needs attention

> ⚠️ Color must never be the *only* signal (colorblind users). Always pair color with a text label or icon.

### Radius
- Cards, panels, inputs, buttons: **`var(--radius)` = 14px**
- Pills, badges, avatars, toggles: **`999px`**
- Nothing else. (No 16px, 18px, 20px.)

### Spacing
- Card padding: **18px** (`.card`, `.dash-panel`)
- Grid gaps: **14–18px** between cards, **10–12px** inside
- Section gap on a page: **20px**

### Shadows
- Resting cards: `var(--shadow-sm)`
- Hover / floating: `var(--shadow)`
- Modals / popovers: `var(--shadow-lg)`

### Typography
| Element | Size | Weight |
|---------|------|--------|
| Page title (h1) | **26px** | 600 |
| Panel/section title (h2/h3) | 15px | 700–800 |
| Body | 13–13.5px | 400–500 |
| Stat value | 20–21px | 800 |
| Labels / meta | 11.5–12.5px | 500–700 |
| Money | use `font-variant-numeric: tabular-nums` |

---

## 3. Layout Skeleton (every list/data page)

```
Breadcrumb (if nested)
PageHeader   ← title + subtitle + primary actions (§4)
StatRow      ← 1 shared StatCard pattern (§5), responsive grid
Card {
  FilterRow  ← shared FilterDropdown + .search (§6)
  Table (desktop) + mobile cards (§7)
  Pagination ← ellipsis pattern (§8)
}
[Optional rail / panels]
```

Page root wrappers: use existing `.card` / `.dash-panel` containers. Don't invent new container shells.

---

## 4. Page Header — ONE component

Use **`<PageHeader>`** from `@/components/ui/PageHeader`:
```tsx
<PageHeader
  title="Groups"
  subtitle="Manage shared expenses"
  breadcrumbs={[{ label: "Groups", href: "/groups" }, { label: group.name }]}
  actions={<button className="btn btn-primary"><Icon name="plus" size={14}/> Add</button>}
/>
```
- Renders `.page-head` (h1 = 26px/600). **No eyebrow labels, no 28px titles.**
- Primary action = one `btn-primary`; everything else `btn-secondary`.
- On mobile, collapse non-essential actions into a `⋯` menu; keep the primary CTA visible.

---

## 5. Stat Card — ONE component

Use **`<StatCard>`** from `@/components/ui/StatCard` for **every** stat:
```tsx
<div className="ui-stat-grid cols-4">          {/* or cols-5 */}
  <StatCard icon="upload" tone="success" label="You Are Owed"
            value={amount} currency={userCurrency}
            colorValue={amount > 0} sub="3 people owe you" />
</div>
```
- `tone`: `primary | success | danger | warn | info | neutral` → drives icon + value color.
- `value` accepts a **number** (+ `currency` → auto `fmt`) or a preformatted node.
- Clickable variant: pass `onClick` + `active` (e.g. summary-bar filters).
- Skeleton: `SkeletonStatCard` from `@/components/Skeleton` while loading.
- **Never** create `.dash-stat-card` / `.gx-stat` / `.groups-summary` variants again.

---

## 6. Filters & Search — ONE component

- Dropdown filters: **`<FilterDropdown>`** from `@/components/ui/FilterDropdown`
  (active state = primary border + soft bg + dot). **Never** bare native `<select>`.
- Search: `.search` wrapper with a leading `<Icon name="search">`.
- On mobile, collapse filters into a single **"Filters (N)"** chip → bottom sheet.
- Reset page to 1 whenever a filter changes.

---

## 7. Data Tables → ONE pattern

- Desktop: `.exp-table` (uppercase `th`, row hover, `.tbl-act` icon actions on the right).
- Mobile (≤768px): hide the table, render `.gx-exp-card` mobile cards. **Every table page must have both.**
- Row actions: View (`search` icon) · Edit (`edit`) · Delete (`trash` + `.danger`). Keep this order.
- Settlement-type rows: teal left border + single-colspan layout. Never repurpose expense columns to mean different things.

---

## 8. Pagination — ONE component

Use **`<Pagination>`** from `@/components/ui/Pagination` (ellipsis `1 … 4 5 6 … 20`, max ~7 buttons):
```tsx
<Pagination page={page} totalPages={totalPages} onChange={setPage}
            summary={`${from}–${to} of ${total} items`} />
```
Never hand-roll page-number loops again.

---

## 9. Buttons, Pills, Modals

- **Buttons:** `.btn.btn-primary` (one per view), `.btn.btn-secondary`, destructive = secondary + rose color/border.
- **Pills/badges:** `999px` radius, `--*-soft` background + matching text color. Always include a word, not just color.
- **Modals:** `.modal-backdrop` + `.modal` (`modal-sm`/`md`/`lg`). Header `.modal-h`, body `.modal-b`, footer `.modal-f`. On mobile, full-screen or bottom-sheet — never a tiny floating box.
- **Confirms:** use SweetAlert2 (`Swal.fire`), never native `confirm()`. Destructive confirms spell out consequences.
- **Toasts:** `react-toastify`. Destructive actions get an **undo toast** (5s) instead of (or in addition to) a hard confirm — pick one, don't double up.

---

## 10. Accessibility Minimums

- Touch targets ≥ **44px** on mobile.
- Visible focus rings on all interactive elements.
- Menus: `role="menu"` / `role="menuitem"`, Escape closes, click-outside closes.
- Decorative images/icons: `aria-hidden`. Meaningful ones: `aria-label`.
- 404 / error states: `role="alert"`.
- Input font ≥ **16px on mobile** (prevents iOS zoom-on-focus).

---

## 11. Anti-Patterns (auto-reject in review)

- ❌ Hardcoded hex colors (`#2563eb`) → use tokens
- ❌ `"USD"` fallback → always `"MAD"`
- ❌ New stat-card / header / dropdown style → reuse the shared one
- ❌ Native `confirm()` / `alert()` → Swal / toast
- ❌ Radius values other than 14px or 999px
- ❌ A table with no mobile card fallback
- ❌ Personal-finance language: "net worth", "savings", "wallet balance", "budget", "wealth", income deltas
- ❌ Fake/decorative data presented as real (static sparklines, hardcoded "+12.5% vs last month")
- ❌ Empty state that's just plain text with no icon/CTA
- ❌ Blank screen while loading (must skeleton)

---

## 12. New-Page Checklist (paste into every PR)

```
[ ] Uses .page-head header (26px h1, one primary CTA)
[ ] Stats use the shared .card.stat-c pattern
[ ] Money via fmt(amount, currency), MAD fallback
[ ] Colors from CSS tokens only (no hex)
[ ] Radius is 14px (cards) or 999px (pills) — nothing else
[ ] Filters use FilterDropdown + .search
[ ] Table has a mobile .gx-exp-card fallback
[ ] Pagination uses the ellipsis pattern
[ ] Loading shows skeletons
[ ] Empty state has icon + message + CTA
[ ] Touch targets ≥44px, focus rings, ARIA on menus/alerts
[ ] No personal-finance language or fake data
[ ] Answers "who owes what & what next" in 5 seconds
```

---

## 13. Shared Component Library — `components/ui/`

| Component | Import | Use for |
|-----------|--------|---------|
| `PageHeader` | `@/components/ui/PageHeader` | Every page title + actions + breadcrumbs |
| `StatCard` | `@/components/ui/StatCard` | Every stat (with `.ui-stat-grid cols-4/5` wrapper) |
| `FilterDropdown` | `@/components/ui/FilterDropdown` | Every filter dropdown |
| `Pagination` | `@/components/ui/Pagination` | Every paginated list |
| `EmptyState` | `@/components/ui/EmptyState` | Every empty / no-results state |

**These are the source of truth. Do not re-implement them per page.**

Reference pages already migrated: `app/dashboard`, `app/groups`, `app/groups/[id]`, `app/expenses`.
Page docs: `docs/dashboard-page.md`, `docs/groups-page.md`, `docs/group-detail-page.md`.
