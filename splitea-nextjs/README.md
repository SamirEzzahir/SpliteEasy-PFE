# SplitEasy — Next.js Frontend

Full-stack expense-splitting app. Next.js 14 (App Router) + TypeScript frontend backed by a FastAPI + SQLAlchemy (async) API.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict) |
| Styling | Plain CSS custom properties (`globals.css`) + Tailwind v3 for new components |
| State | React Context (`lib/store.tsx`, `lib/auth/AuthContext.tsx`) |
| HTTP | Axios with JWT interceptor (`lib/api/client.ts`) |
| Real-time | WebSocket (notifications), fallback to 5-min polling |
| Backend | FastAPI + SQLAlchemy async + MySQL |

---

## Run Locally

```bash
# 1. Start the FastAPI backend (defaults to http://127.0.0.1:8000)
# See backend/README.md

# 2. Frontend
cp .env.example .env.local   # optional — defaults work for localhost
npm install
npm run dev
# Open http://localhost:3000 → redirects to /login
```

---

## Environment Variables

```bash
NEXT_PUBLIC_API_URL=                              # blank = /api proxy in dev; set full URL in prod
BACKEND_PROXY_TARGET=http://127.0.0.1:8000        # dev proxy target
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000            # optional; defaults to same host as NEXT_PUBLIC_API_URL
```

---

## Folder Layout

```
splitea-nextjs/
├── app/
│   ├── layout.tsx                  # ConditionalShell — auth vs public chrome
│   ├── globals.css                 # full design-system (CSS custom props, dark mode, responsive)
│   ├── page.tsx                    # redirects → /jars
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── dashboard/page.tsx          # summary stats, recent expenses, quick actions
│   ├── jars/page.tsx               # Économé jar dashboard (6-jar budgeting system)
│   ├── expenses/page.tsx           # full expense table, filters, pagination, category donut
│   ├── groups/page.tsx             # group cards/list, preview panel, member avatars
│   ├── groups/[id]/page.tsx        # single group detail view
│   ├── friends/page.tsx            # friend list, pending requests, balances
│   ├── settlements/page.tsx        # settlement history and recording
│   ├── balances/page.tsx           # net balance overview
│   ├── activity/page.tsx           # activity feed
│   ├── reports/page.tsx            # spending reports and charts
│   └── settings/page.tsx           # profile, preferences, security, currency, theme
├── components/
│   ├── shell/
│   │   ├── AppShell.tsx            # layout wrapper — sidebar + topbar + mobile nav + global modals
│   │   ├── Sidebar.tsx             # desktop left nav, profile, dark mode toggle
│   │   ├── Topbar.tsx              # search, notifications bell, profile dropdown (logout)
│   │   ├── MobileBottomNav.tsx     # fixed bottom nav (≤1024px) with FAB action sheet
│   │   ├── NotificationsBell.tsx   # real-time bell with badge
│   │   └── Toast.tsx
│   ├── modals/
│   │   ├── AddExpenseFullModal.tsx
│   │   ├── CreateGroupModal.tsx
│   │   ├── EditGroupModal.tsx
│   │   ├── ManageGroupMembersModal.tsx
│   │   ├── LogIncomeModal.tsx
│   │   ├── ManageStrategyModal.tsx
│   │   ├── AddFriendModal.tsx
│   │   └── CelebrateOverlay.tsx
│   ├── jars/                       # CardsView, StackedView, IllustratedView, TreemapView
│   ├── expenses/
│   │   └── CategoryDonut.tsx       # SVG donut with gap segments
│   ├── Skeleton.tsx                # reusable skeleton loading blocks
│   ├── Icon.tsx                    # lucide-react name shim
│   ├── Avatar.tsx + AvatarStack
│   └── RequireAuth.tsx
├── lib/
│   ├── api/
│   │   ├── client.ts               # axios instance, JWT interceptor, 401 handler, WS base URL
│   │   ├── types.ts                # raw backend response shapes (ApiUser, ApiGroup, ApiExpense…)
│   │   ├── mappers.ts              # backend → UI types (ids → string, group currency, expense currency…)
│   │   ├── auth.ts                 # login, register, /me
│   │   ├── users.ts                # profile update, password, preferred currency, settlement mode
│   │   ├── groups.ts               # CRUD groups
│   │   ├── expenses.ts             # CRUD expenses + splits
│   │   ├── friends.ts              # friend requests, accepted friends
│   │   ├── settle.ts               # settlement record + history
│   │   ├── econome.ts              # jar strategies, balances, income logs, distribute, spend
│   │   ├── notifications.ts        # REST + WS notifications
│   │   ├── activity.ts             # activity feed
│   │   └── dashboard.ts            # dashboard summary stats
│   ├── auth/AuthContext.tsx         # user session, login, logout, register, refresh
│   ├── store.tsx                   # global AppProvider — all domain state + mutations
│   ├── format.ts                   # fmt(amount, currency), fmt0, arc (SVG), todayStr
│   ├── types.ts                    # UI domain types (Group, Expense, FriendRow…)
│   ├── data.ts                     # static seed data — categories, fallback people
│   ├── jars.ts                     # jar presets + metadata
│   └── people-cache.ts             # runtime user id → display name cache
└── hooks/
    └── useNotifications.ts         # REST poll + WebSocket with auto-reconnect
```

---

## How Auth Works

| Step | Detail |
|---|---|
| Login | `POST /auth/login` (form-encoded `OAuth2PasswordRequestForm`) |
| Token | Stored in `localStorage` as `spliteasy.token` |
| Every request | Axios interceptor adds `Authorization: Bearer <token>` |
| 401 | Token cleared → `onUnauthorized` event → `AuthContext` redirects to `/login` |
| Logout | Clear token + `router.replace('/login')` — available in Topbar, Settings page |

---

## API ↔ Page Mapping

| Page | Key Endpoints |
|---|---|
| `/login` `/signup` | `POST /auth/login`, `POST /auth/register`, `GET /auth/me` |
| `/dashboard` | `GET /auth/me`, groups + expenses from store |
| `/jars` | `GET/POST/PUT /econome/strategies`, `GET /econome/balances`, `POST /econome/distribute`, `POST /econome/spend` |
| `/expenses` | `GET /groups/`, `GET /expenses/group/{id}`, `POST /expenses/` |
| `/groups` | `GET /groups/`, `POST /groups/`, `GET /memberships/{group_id}` |
| `/groups/[id]` | `GET /groups/{id}`, `GET /expenses/group/{id}`, `GET /memberships/{id}` |
| `/friends` | `GET /friends/`, `GET /friends/requests/pending`, `POST /friends/request`, `GET /settle/global/balances` |
| `/settlements` | `GET/POST /settle/`, `PUT /settle/{id}/confirm` |
| `/settings` | `PUT /users/{id}`, `PUT /users/user/me/preferred-currency`, `PUT /users/user/me/global-settlement-mode`, `POST /users/user/me/change-password` |
| Notifications | `GET /Notifications/`, `PUT /Notifications/{id}/read`, WS `/Notifications/ws/{user_id}` |

---

## Currency System

Each **group** stores its own currency (`EUR`, `MAD`, `USD`, etc.) — set when creating or editing a group. Amounts are always displayed in the group's own currency using the correct symbol.

The **user** has a `preferred_currency` field (set in Settings → Preferences) used for:
- Dashboard totals
- Cross-group summary stats
- Sidebar wallet label

**Future:** a global "display currency" toggle in Settings will convert all amounts to one target currency before display (requires exchange rates API).

**Currency → symbol mapping** lives in `lib/format.ts` (`currencySymbol(code)`). Supported: USD, EUR, GBP, MAD, SAR, AED, DZD, TND, EGP, JPY, CAD, AUD, CHF, INR, BRL, MXN, TRY, KWD, QAR, CNY.

---

## Theme System

- CSS custom properties on `:root` and `[data-theme="dark"]` — defined in `globals.css`
- Theme choice: `"light" | "dark" | "system"` — stored in `localStorage` as `spliteasy.theme`
- Toggle in Sidebar (desktop) and Settings page
- `AppShell` applies the theme on mount and listens for `spliteasy:theme-change` custom events

---

## Mobile & Responsive

- **≤ 1024px**: sidebar hidden, fixed bottom navigation bar appears (`MobileBottomNav.tsx`)
- Bottom nav has a center FAB button that opens an action sheet: Add Expense, Create Group, Record Settlement, Add Income
- Safe area insets applied for iPhone notch (`env(safe-area-inset-bottom)`)
- All pages have bottom padding to clear the nav bar

---

## Loading States

Pages use **skeleton loading** (`components/Skeleton.tsx`) instead of fake placeholder data. Skeleton blocks match the real layout — cards, rows, avatars — and disappear once data arrives from the API.

---

## State Model

| Concern | Location |
|---|---|
| Auth (user, token, login/logout/refresh) | `lib/auth/AuthContext.tsx` |
| Domain state (groups, expenses, friends, jars, income) | `lib/store.tsx` — fetches on mount when user is set, refetches after mutations |
| Toasts | `lib/store.tsx` → `AppShell` renders `<Toast>` |
| Celebration overlay | `lib/store.tsx` → `AppShell` renders `<CelebrateOverlay>` |
| Notifications | `hooks/useNotifications.ts` (REST + WebSocket, auto-reconnect with backoff) |
| People cache | `lib/people-cache.ts` — resolves user ids to display names at render time |

---

## Backend Notes

- `POST /auth/login` expects **form-encoded** body (`OAuth2PasswordRequestForm`) — not JSON
- The notifications router is `/Notifications` (capital N) — kept verbatim in the API client
- Backend migrations run automatically on startup (`backend/core/migrations.py` → `run_migrations()`)
- Backend ids are integers; the frontend converts all to **strings** in mappers to avoid `===` bugs with React keys

---

## Current Features

- Authentication (login, register, logout, session refresh)
- Groups — create, edit, delete, manage members, per-group currency
- Expenses — add, list, filter by group/category/paid-by, pagination, category donut chart
- Friends — send/accept/reject requests, view balances
- Settlements — record, confirm, history
- Économé (Jar budgeting) — 6-jar strategy, income distribution, jar spending
- Notifications — real-time bell with WebSocket + REST fallback
- Settings — profile edit, password change, theme, currency preference, settlement mode
- Dark mode — full dark theme via CSS custom properties
- Mobile — responsive layout with bottom nav bar and FAB action sheet
- Skeleton loading — all pages show skeleton states while fetching data

---

## Planned / Future Features

- **Global display currency** — convert all amounts to a chosen currency before display (exchange rates API)
- **Expense currency conversion** — show each expense in the user's preferred currency
- **Group chat** — WebSocket-based per-group messaging (backend endpoint exists: `/groups/{id}/messages`)
- **Wallets** — personal wallet management and transaction history
- **Debts & Loans** — personal debt tracking separate from group expenses
- **Reports** — advanced spending charts, monthly trends, export to PDF/CSV
- **Activity feed** — full chronological audit log of all group and friend actions
- **Balances page** — visual net balance breakdown across all friends and groups
- **Profile photo upload** — currently disabled; backend field exists
- **Push notifications** — mobile push via PWA or Capacitor
- **Import expenses** — CSV/bank statement import
- **Recurring expenses** — scheduled automatic expense creation
- **Multi-currency group** — individual expenses in different currencies within one group
- **Admin panel** — user management, role assignment (backend `/admin` router exists)
- **PWA / Mobile app** — Capacitor wrapper already scaffolded in `/mobile`
