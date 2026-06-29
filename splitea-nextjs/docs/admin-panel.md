# Admin Panel

SplitEasy ships a dedicated back-office at **`/admin`** for running the platform:
user/group/expense/settlement management, a support center, role-based access
control, and an immutable audit trail. It is built entirely on the existing design
system and API architecture.

> **Status:** Phase 1. Some routes are intentionally deferred — see
> [Roadmap](#roadmap).

---

## Route map

| Route | Page | Required permission |
|---|---|---|
| `/admin` | Redirects to `/admin/dashboard` | any admin permission |
| `/admin/dashboard` | KPIs, 14-day trend charts, recent admin activity | `view_dashboard` |
| `/admin/users` | User directory — search, filter, sort, paginate | `view_users` |
| `/admin/users/[id]` | User detail + actions (status, role, reset password, force logout, delete) | `view_users` (read) / `manage_users` (write) |
| `/admin/groups` | All groups — delete, transfer ownership | `view_groups` / `manage_groups` |
| `/admin/expenses` | All expenses — search, delete | `view_expenses` / `manage_expenses` |
| `/admin/settlements` | All settlements — filter, cancel | `view_settlements` / `manage_settlements` |
| `/admin/support` | Ticket queue — search, filter, drill in | `view_support` |
| `/admin/support/[id]` | Ticket workspace — reply, status, priority, assign, close/reopen | `view_support` (read) / `manage_support` (write) |
| `/admin/roles` | Roles + permission-matrix editor | `view_roles` / `manage_roles` |
| `/admin/audit-logs` | Immutable admin action trail | `view_audit_logs` |
| `/admin/settings` | Platform settings, feature flags, maintenance | `view_settings` (read) / `manage_settings` (write) |
| `/admin/moderation` (+ `/[id]`) | Report queue + review (status, notes, warn) | `view_moderation` / `manage_moderation` |
| `/admin/announcements` | Create/publish announcements (banner/popup/notification) | `view_announcements` / `manage_announcements` |
| `/admin/analytics` | Growth & activity charts (date range + granularity) | `view_analytics` |
| `/admin/system` | Service status, version, uptime, host metrics | `view_system` |

Non-admins who reach any `/admin/*` route get a **403** page; anonymous visitors are
redirected to `/login`.

---

## Architecture

### Frontend

```
app/admin/
├── layout.tsx              # <AdminGuard> + <AdminShell>; imports admin.css
├── admin.css               # scoped styles layered on the design system
├── page.tsx                # redirect → /admin/dashboard
├── dashboard/page.tsx
├── users/page.tsx · users/[id]/page.tsx
├── groups/page.tsx · expenses/page.tsx · settlements/page.tsx
├── support/page.tsx · roles/page.tsx · audit-logs/page.tsx

components/admin/
├── AdminGuard.tsx          # permission gate → Forbidden / redirect
├── AdminShell.tsx          # back-office layout (reuses .app/.main/.page) + theme
├── AdminSidebar.tsx        # nav, filtered by the admin's permissions
├── Forbidden.tsx           # 403
├── DataTable.tsx           # one table: search + filters + pagination + mobile cards
├── MiniChart.tsx           # dependency-free inline-SVG bar chart
├── ui.tsx                  # badges, date helpers, SweetAlert2 confirm/prompt wrappers
└── usePerms.ts             # permission hook

lib/api/admin.ts            # typed client for /admin/* + permission helpers
```

The admin area **reuses** the shared primitives (`PageHeader`, `StatCard`,
`Pagination`, `FilterDropdown`, `EmptyState`, `Skeleton`, `Icon`), the axios `api`
client, `AuthContext`, SweetAlert2 confirms, and react-toastify — so it looks and
behaves like the rest of SplitEasy. `ConditionalShell` skips the normal user shell
for `/admin` so the back-office renders its own chrome.

### Backend

```
backend/
├── models/admin.py            # AdminAuditLog
├── schemas/admin.py           # Paginated[T], AdminUserRead, DashboardStats, …
├── repositories/admin.py      # paginated/searchable queries + dashboard aggregates
├── services/admin.py          # audit logging, status transitions, force-logout, reset
├── routers/admin.py           # all /admin/* endpoints (each write is audited)
└── core/migrations.py         # new columns, audit table, role seeding, bootstrap
```

Every admin **write** endpoint is guarded by `require_permission(...)` and records an
`AdminAuditLog` row (admin, action, target, details, IP, timestamp).

---

## Permission model (RBAC)

Roles live in the `roles` table; `permissions` is a **JSON string array**. A user's
role is returned by `GET /auth/me`, so the frontend gates the whole area client-side
while the backend enforces each endpoint server-side.

- `"*"` is the **wildcard** — grants everything (Super Admin).
- Otherwise a permission is granted if its exact key is in the array.

### Permission catalog

| Group | Keys |
|---|---|
| Dashboard | `view_dashboard` |
| Users | `view_users`, `manage_users` |
| Groups | `view_groups`, `manage_groups` |
| Expenses | `view_expenses`, `manage_expenses` |
| Settlements | `view_settlements`, `manage_settlements` |
| Support | `view_support`, `manage_support` |
| Roles | `view_roles`, `manage_roles` |
| Audit | `view_audit_logs` |
| Platform | `view_settings`, `manage_settings`, `view_moderation`, `manage_moderation`, `view_announcements`, `manage_announcements`, `view_analytics`, `view_system` (Phase 2 — see [platform-admin.md](platform-admin.md)) |

### Seeded roles

Seeded automatically on startup if missing:

| Role | Permissions |
|---|---|
| **Super Admin** | `*` |
| **Admin** | all catalog permissions |
| **Moderator** | view dashboard/users; manage groups/expenses/settlements/support; view audit |
| **Support Agent** | view dashboard/users; view + manage support |
| **Viewer** | all `view_*` permissions (read-only) |

---

## Creating the first administrator

Roles are seeded on every startup. To grant yourself **Super Admin** automatically,
set the `ADMIN_USERNAME` environment variable on the backend to your existing
username:

```env
ADMIN_USERNAME=your_username
```

On startup the migration runner assigns the Super Admin role to that user. After that
you can manage roles entirely from `/admin/roles` and `/admin/users/[id]`.

Alternatively, assign a role to any user from the admin UI (once you have one admin),
or directly in the database:

```sql
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'Super Admin')
WHERE username = 'your_username';
```

> **Note:** Changing a user's password or using **Force logout** bumps their
> `token_version`, which invalidates all their existing JWTs.

---

## Roadmap

Deferred to Phase 2 (not yet built — these routes do **not** exist as placeholders):

- Moderation / user reports
- Announcement center (global messages, maintenance notices)
- Deep analytics dashboards
- System settings page + maintenance mode + registration toggle
- Login-history capture
- Self-serve email verification flow
- Expense / group soft-delete + restore

> **Shipped after Phase 1:** the full two-sided **support ticketing** system
> (user portal + admin queue with threaded replies, assignment, priority, and
> notifications). See [support.md](support.md).
