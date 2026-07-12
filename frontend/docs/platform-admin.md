# Platform Administration (Phase 2)

Phase 2 adds a platform-governance layer on top of the Phase 1 admin panel. It is
built incrementally; this document tracks each module as it lands.

| Module | Route | Status |
|---|---|---|
| System Settings (+ feature flags + maintenance) | `/admin/settings` | ✅ Shipped |
| Moderation Center | `/admin/moderation` | ✅ Shipped |
| Announcement Center | `/admin/announcements` | ✅ Shipped |
| Platform Analytics | `/admin/analytics` | ✅ Shipped |
| Platform Health | `/admin/system` | ✅ Shipped |

New permissions (all under the **Platform** group in the roles editor):
`view_settings · manage_settings · view_moderation · manage_moderation ·
view_announcements · manage_announcements · view_analytics · view_system`.

> **Role permission re-sync:** seeded roles (Super Admin / Admin / Moderator / Support
> Agent / Viewer) get their permission sets **re-applied on every startup**
> (`sync_seeded_role_permissions` in [core/migrations.py](../../backend/core/migrations.py)),
> so new permissions propagate to existing roles automatically. Custom roles are untouched.

---

## ① System Settings — `/admin/settings`

Edit platform configuration; reads need `view_settings`, writes need `manage_settings`.

### Settings groups
- **General** — app name, description, logo/favicon URL, default language & timezone.
- **Authentication** — allow registration, require email verification (stored), session
  timeout (minutes), minimum password length.
- **Maintenance** — maintenance mode, message, allow-admins-during-maintenance.
- **Uploads** — max size (MB), allowed types (stored, enforced once uploads exist).
- **Feature flags** — Group Chat, Notifications, Budget (Économé), Reports, Support Center.

### How settings are stored & served
- **Table** `app_settings` (key/value). The schema is defined by `DEFAULTS` in
  [backend/core/settings_store.py](../../backend/core/settings_store.py) — a typed map that
  doubles as the fallback when a row is absent.
- **In-process cache.** Settings load into memory once at startup
  (`load_settings`) and refresh on write (`update_settings`). Reads are cache hits — **no
  per-request DB query**.
- **Endpoints:** `GET/PUT /admin/settings` (admin, audited) and a public
  `GET /settings/public` exposing only the safe subset (identity, feature flags,
  maintenance status) for the frontend.

### Maintenance mode
A `@app.middleware("http")` in [backend/main.py](../../backend/main.py) checks the cached
flag. When ON, any request outside the allow-list (`/admin`, `/auth`, `/settings`,
`/docs`) gets **503** with the maintenance message — unless it carries an admin token and
`maintenance_allow_admins` is on. Admins keep full access; the app shows a banner.

### Feature flags & enforcement (frontend)
`PublicSettingsProvider` ([lib/public-settings.tsx](../lib/public-settings.tsx)) fetches
`/settings/public` once and exposes `feature(name)`. The user sidebar hides flagged nav
(e.g. **Support** when `feature_support` is off); flags default to ON while loading so
nothing flickers.

### Backend enforcement
- `registration_enabled` → blocks `POST /auth/register` (403) when off.
- `password_min_length` → enforced in registration.
- `session_timeout_minutes` → feeds JWT expiry at login.
- Email verification & upload limits are **stored and surfaced** but not yet enforced (no
  email/upload subsystem) — documented as deferred.

---

## ② Moderation Center — `/admin/moderation`

Users report content via `POST /reports` (target: user/group/expense/message; reason:
spam/abuse/fake_account/inappropriate/other) — wired into the **Friends** page (report a
user). Moderators (`view_moderation`/`manage_moderation`) work the queue at
`/admin/moderation` + detail: change status (open → reviewing → dismissed/actioned),
add internal notes, **warn** the user (notification), or jump to the user page to
suspend/ban — **reusing** the Phase-1 user-status actions (no duplicated logic). New
reports notify all moderators.

## ③ Announcement Center — `/admin/announcements`

Create maintenance/release/feature/security/emergency announcements with visibility
(everyone / admins) and delivery (**notification** / **banner** / **popup**), optional
expiry, publish-now or save-as-draft. `notification` delivery fans out via the existing
`send_notification` at publish time (once). `banner`/`popup` are served by
`GET /announcements/active` and rendered app-wide by `AnnouncementBanner` (banners are
dismissible per-user; the first popup shows once per session).

## ④ Platform Analytics — `/admin/analytics`

`GET /admin/analytics?from=&to=&granularity=day|week|month` returns zero-filled time
series + totals for users, expenses, groups, settlements, tickets, and reports
(generalized from the Phase-1 `_daily_series`). The page renders date-range +
granularity controls, StatCard totals, and one inline-SVG `LineChart` per metric.

## ⑤ Platform Health — `/admin/system`

`GET /admin/system` reports backend status, DB (`SELECT 1`), WebSocket (live connection
count), app/build version, and uptime. CPU/RAM/disk come from **`psutil`** when
installed, otherwise the cards read "unavailable" (set `BUILD_VERSION` env to surface a
build tag). The page auto-refreshes every 15s.
