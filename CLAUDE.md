# SplitEasy — Project Guide for AI Assistants

## What this product is
SplitEasy is an **expense-sharing app** (Splitwise / Tricount style). The core is:
**Groups · Expenses · Balances · Settlements · Members · Group Chat.**

It is **NOT** a personal-finance / wallet / budgeting / savings app. Never add
"net worth", "savings", "wallet balance", "budget", or income-tracking concepts.

Every screen must answer in 5 seconds: **"Who owes what, and what do I do next?"**

The app lives in `splitea-nextjs/` (Next.js App Router + TypeScript). Backend is
FastAPI in `backend/`.

## 🎨 Design contract — READ BEFORE BUILDING UI
Before creating or editing ANY page/component, follow the design system:
**`splitea-nextjs/docs/DESIGN_SYSTEM.md`** — it is the source of truth for unified UI.

### Non-negotiable rules (summary — full detail in the doc)
1. **Reuse shared primitives** — do NOT invent a new stat-card, page-header, or
   dropdown style per page. One `.page-head`, one `.card.stat-c`, one `FilterDropdown`.
2. **Money:** always `fmt(amount, currency)` from `@/lib/format`; fallback is
   **`"MAD"`**, never `"USD"`.
3. **Colors:** CSS variables only (`--primary`, `--success`, `--rose`, `--teal`,
   `--warn`, `--ink*`, `--line`, `--surface`). Never hardcode hex.
   Semantics: green = owed to you · red = you owe · teal = settlement · amber = pending.
4. **Radii:** only `var(--radius)` (14px) for cards/inputs, `999px` for pills.
5. **Mobile-first:** every table needs a `.gx-exp-card` mobile fallback; touch targets ≥44px; input font ≥16px.
6. **Loading = skeletons.** **Empty states = icon + message + CTA.**
7. **Confirms:** SweetAlert2 (`Swal.fire`) or undo-toast — never native `confirm()`.
8. **Pagination:** ellipsis pattern (max ~7 buttons).

### Reference implementations
- Best components (filters, pagination, empty states): `splitea-nextjs/app/expenses/page.tsx`
- Best table + mobile cards + settlement rows: `splitea-nextjs/app/groups/[id]/page.tsx`
- Page-level docs: `splitea-nextjs/docs/*.md`

## Workflow notes
- After UI changes, run `npx tsc --noEmit` in `splitea-nextjs/` to typecheck.
  The tree should be type-clean — `next build` (and the Docker image) fails on any TS error.
- Use the New-Page Checklist at the bottom of `DESIGN_SYSTEM.md` for every new page.
