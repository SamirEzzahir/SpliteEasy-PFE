# SplitEasy — Mobile (React Native + Expo)

Native port of the `splitea-nextjs/` web app, built with **Expo Router** (file-based
routing, same mental model as the Next.js App Router).

## Architecture

| Concern | Implementation | Web equivalent |
|---|---|---|
| Routing | Expo Router v6 (`app/`) | Next.js App Router |
| Auth/session | React Context (`lib/auth/AuthContext.tsx`) | same |
| Global state | React Context (`lib/store.tsx`) | `lib/store.tsx` |
| HTTP | Axios + JWT interceptor (`lib/api/client.ts`) | same |
| Token storage | **AsyncStorage** (`spliteasy.token`) | localStorage |
| Theme | token object + `useTheme()` (`lib/theme.tsx`), persisted to `spliteasy.theme` | CSS custom properties |
| Real-time | shared `WebSocket` context (`lib/ws-context.tsx`) + 5-min poll | same |
| Toasts | in-context state + `<Toast>` overlay | react-toastify |

> The earlier scaffold (Zustand + react-query + expo-secure-store) was replaced
> per the migration plan with the web app's Context-based patterns so logic ports
> 1:1. All `lib/api/*`, `lib/format.ts`, `lib/types.ts`, `mappers.ts`, `data.ts`,
> `jars.ts`, `people-cache.ts` are direct ports of their web counterparts.

## Routes (folder mapping)

```
app/_layout.tsx            root layout: Theme→Auth→WS→App providers + AuthGuard + Toast
app/login.tsx              ← app/login/page.tsx
app/signup.tsx             ← app/signup/page.tsx
app/(tabs)/_layout.tsx     bottom tab bar + center FAB action sheet
app/(tabs)/dashboard.tsx   ← app/dashboard/page.tsx
app/(tabs)/groups.tsx      ← app/groups/page.tsx
app/(tabs)/expenses.tsx    ← app/expenses/page.tsx
app/(tabs)/friends.tsx     ← app/friends/page.tsx
app/(tabs)/jars.tsx        ← app/jars/page.tsx
app/(tabs)/settlements.tsx ← app/settlements/page.tsx
app/(tabs)/settings.tsx    ← app/settings/page.tsx
app/groups/[id].tsx        ← app/groups/[id]/page.tsx (+ floating GroupChat)
```

**Tab bar:** 4 primary tabs (Home, Groups, Expenses, Friends) with a raised center
**FAB** → action sheet (Add Expense, Create Group, Record Settlement, Add Income).
Jars & Settings are reached from the Dashboard quick actions (kept off the bar to
avoid crowding; all routes remain navigable).

## Configure the backend URL

Edit `lib/config.ts` → `BASE_URL`:

- Android emulator: `http://10.0.2.2:8800`
- iOS simulator: `http://127.0.0.1:8800`
- **Expo Go on a real device:** `http://<your-LAN-IP>:8800` (phone must reach your PC)

## Run

```bash
cd mobile
npm install --legacy-peer-deps   # scaffold pins react 19.1 vs react-dom 19.2
npx expo start                   # scan QR with Expo Go
```

Typecheck: `npx tsc --noEmit` (clean).

## Status

- ✅ Auth flow (login/register/logout, token persistence, 401 → login), theming
  (light/dark/system), all tab screens, group detail, FAB modals, group chat over
  WebSocket, notifications hook.
- ✅ `tsc --noEmit` passes; Metro resolves all modules.

### Known caveat
`npx expo export` (optimized **production** bundle) currently fails at the Hermes
AOT compile with "private properties are not supported" — a SDK-54/Hermes-on-Windows
toolchain issue from a transitive dependency, unrelated to app code. It does **not**
affect `expo start` / Expo Go (dev bundle transforms per-module). For production
builds use EAS Build (cloud Hermes) or a newer local Hermes.

### Not yet ported (web parity backlog)
Balances / Activity / Reports tabs, expense **edit/detail** modals, member
management modal, settlement record/accept/reject UI, currency/password editing in
Settings, SVG donut charts (`react-native-svg` is installed and ready).
