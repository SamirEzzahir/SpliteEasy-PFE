# SplitEasy — Next.js + Tailwind (with FastAPI backend)

Next.js 14 (App Router) frontend for the SplitEasy FastAPI backend. TypeScript, Tailwind v3, plain React Context for state, axios for the API, `lucide-react` icons.

## Run locally

1. Start the FastAPI backend (see the backend README in your other repo). It defaults to `http://127.0.0.1:8000`.

2. In this folder:

   ```bash
   cp .env.example .env.local   # optional — defaults work for localhost
   npm install
   npm run dev
   ```

   Open <http://localhost:3000>. You'll land on `/login`; create an account on `/signup`, then you're redirected to `/jars`.

## How the frontend talks to the backend

| Concern | Where |
|---|---|
| Base URL | `NEXT_PUBLIC_API_URL` env (defaults to `/api`, which `next.config.mjs` proxies to `BACKEND_PROXY_TARGET`, default `http://127.0.0.1:8000`). |
| JWT storage | `localStorage` key `spliteasy.token`. |
| Auth header | Attached to every request by an axios interceptor (`lib/api/client.ts`). |
| 401 handling | Token is cleared and a global `onUnauthorized` event fires — `AuthContext` listens and redirects to `/login`. |
| WebSocket | Notifications subscribe to `/Notifications/ws/{user_id}`. Auto-reconnect with backoff, falls back to 5-min polling after 5 failed attempts. |

## What's wired to which endpoints

| Page | Endpoints |
|---|---|
| `/login`, `/signup` | `POST /login` (form-encoded — `OAuth2PasswordRequestForm`), `POST /register`, `GET /me`. |
| `/jars` (Économé) | `GET/POST/PUT /econome/strategies`, `GET /econome/balances`, `GET /econome/income-logs`, `GET /econome/ledger`, `POST /econome/distribute`, `POST /econome/spend`. |
| `/expenses` | `GET /groups/`, `GET /memberships/{group_id}`, `GET /expenses/group/{group_id}`, `POST /expenses/`. |
| `/groups` | `GET /groups/`, `POST /groups/`, `GET /memberships/{group_id}`. |
| `/friends` | `GET /friends/`, `GET /friends/requests/pending`, `POST /friends/request`, `GET /settle/global/balances`, `POST /settle/global/record`. |
| Notifications bell | `GET /Notifications/`, `PUT /Notifications/{id}/read`, `PUT /Notifications/read-all`, WS `/Notifications/ws/{user_id}`. |
| Sign out | clears the token + redirects to `/login`. |

Routes that don't have a backed page yet (`/dashboard`, `/settlements`, `/balances`, `/wallets`, `/debts`, `/reports`, `/activity`, `/settings`) render the existing **ComingSoon** placeholder — wire them up next.

## Backend → UI shape mappers (`lib/api/mappers.ts`)

Backend numeric ids become string ids client-side. Users get a deterministic color pair based on their id. Group `type` is normalized to one of `trip | home | social | work`. Expense categories are pattern-matched onto your existing UI category set. The six Économé jar codes (`NEC / FFA / EDU / LTSS / PLAY / GIVE`) map to the UI jar metadata (icon, color, soft) — the dashboard reads strategy percentages straight from the backend.

## State model

| Concern | Where |
|---|---|
| Auth (user, token, login/logout) | `lib/auth/AuthContext.tsx` |
| Domain state (jars, expenses, groups, friends) | `lib/store.tsx` — fetches on mount when `user` is set, refetches on mutation. |
| Toasts, celebration overlay | also in `lib/store.tsx`. |
| People cache | `lib/people-cache.ts` — registered by mappers so `personById(id)` resolves real users by their id. |
| Notifications | `hooks/useNotifications.ts` (REST + WS). |
| Tweaks panel | `components/tweaks/TweaksPanel.tsx` — purely client-side, no backend. |

## Folder layout

```
splitea-nextjs/
├── app/
│   ├── layout.tsx              # ConditionalShell decides auth vs public chrome
│   ├── globals.css             # full design-system stylesheet + auth styles
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── page.tsx                # redirects to /jars
│   ├── jars/page.tsx           # Économé dashboard
│   ├── expenses/page.tsx
│   ├── groups/page.tsx
│   ├── friends/page.tsx
│   └── {dashboard,settlements,balances,wallets,debts,reports,activity,settings}/page.tsx
├── components/
│   ├── shell/                  # Sidebar, Topbar, AppShell, ConditionalShell, NotificationsBell
│   ├── jars/                   # CardsView, StackedView, IllustratedView, TreemapView, donuts, stats
│   ├── modals/                 # LogIncome, ManageStrategy, AddJarExpense, AddExpenseFull, CreateGroup, AddFriend, Celebrate
│   ├── expenses/CategoryDonut.tsx
│   ├── tweaks/TweaksPanel.tsx
│   ├── Icon.tsx                # lucide-react name shim
│   ├── Avatar.tsx
│   ├── ComingSoon.tsx
│   └── RequireAuth.tsx
├── lib/
│   ├── api/
│   │   ├── client.ts           # axios + JWT + 401 listener + WS URL
│   │   ├── types.ts            # backend response shapes
│   │   ├── mappers.ts          # backend → UI types
│   │   ├── auth.ts, groups.ts, expenses.ts, friends.ts,
│   │   │ settle.ts, econome.ts, notifications.ts, dashboard.ts
│   ├── auth/AuthContext.tsx
│   ├── store.tsx               # global AppProvider — fetches & mutates
│   ├── data.ts                 # seed people/groups/categories (used as fallbacks + for ComingSoon)
│   ├── jars.ts                 # presets + initial jars
│   ├── format.ts               # fmt, fmt0, arc, todayStr
│   ├── types.ts                # UI domain types
│   └── people-cache.ts         # runtime user cache
├── hooks/useNotifications.ts
├── tailwind.config.ts          # design tokens (colors, radii, shadows, fonts)
├── next.config.mjs             # /api/* → backend rewrite for development
└── .env.example
```

## Env vars

```bash
NEXT_PUBLIC_API_URL=            # leave blank for /api proxy in dev; set in prod
BACKEND_PROXY_TARGET=http://127.0.0.1:8000   # dev only
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000       # optional; defaults to same host
```

## Notes

- The backend expects `POST /login` to be **form-encoded** (`OAuth2PasswordRequestForm`) — `authApi.login` handles that.
- The notifications router on the backend is `/Notifications` (capital N) — kept verbatim in the client.
- Tailwind v3 is configured with your design tokens (`bg-primary`, `text-ink-3`, `shadow-lg`, etc.). The full rich design lives as classic CSS in `app/globals.css` — rewriting all of it as Tailwind utilities would lose fidelity, so use Tailwind for **new** components.
- A few backend endpoints aren't yet wired into the UI (wallets, transactions, debts/loans, dashboard summary, group settle balances, group chat WS, admin). They'd plug into the existing endpoint wrappers without changes to the API client.
