# SplitEasy

> **Know who owes what — and what to do next.**

SplitEasy is a full-stack **expense-sharing app** (Splitwise / Tricount style) for
splitting bills inside groups, tracking balances, settling up, and chatting with
group members in real time. It pairs a **Next.js + TypeScript** web client with a
**FastAPI + PostgreSQL** backend.

Every screen is built to answer one question in five seconds:
**"Who owes what, and what do I do next?"**

---

## Features

- **JWT authentication** — register, log in, persistent sessions, protected routes.
- **Groups** — create groups, invite members, set a per-group currency, group chat.
- **Expenses** — add, edit, delete, filter, and paginate shared expenses; Excel
  import/export on the backend; category breakdown donut chart.
- **Expense splitting** — split a bill equally or with custom per-member shares.
- **Balances & settlements** — net balances per member, suggested payments using a
  cash-flow-minimization algorithm, and a record → accept/reject approval flow.
- **Global settlements** — settle cross-group balances directly with a friend.
- **Friends** — search users, send/accept/reject friend requests.
- **Group chat** — per-group real-time messaging over WebSocket.
- **Notifications** — real-time bell via WebSocket with a REST polling fallback.
- **Économé jars** — a 6-jar budgeting module (the one personal-finance feature
  surfaced in the web app).
- **Settings** — profile editing, password change, preferred currency, theme.
- **Support / ticketing** — a two-sided system: users raise & follow tickets at
  `/support` (category, priority, threaded replies, close); staff manage them in the
  admin queue (reply, assign, set priority/status, resolve/reopen). Notifications keep
  both sides in the loop. See [`frontend/docs/support.md`](frontend/docs/support.md).
- **Admin panel** — a dedicated `/admin` back-office: dashboard with KPIs & trend
  charts, user management (suspend/ban, roles, reset password, force logout), group /
  expense / settlement management, a support center, an RBAC roles editor, and an
  immutable audit log. See [`frontend/docs/admin-panel.md`](frontend/docs/admin-panel.md).
- **Platform administration** — `/admin/settings` (app identity, **feature flags**,
  auth/password policy, **maintenance mode** via middleware), `/admin/moderation`
  (user reports → review/warn/suspend), `/admin/announcements` (banner/popup/notification),
  `/admin/analytics` (growth charts), and `/admin/system` (service health, uptime, host
  metrics). See [`frontend/docs/platform-admin.md`](frontend/docs/platform-admin.md).
- **Dark mode** — full light/dark theming via CSS custom properties.
- **Responsive design** — desktop sidebar collapses to a mobile bottom nav with an
  action-sheet FAB; skeleton loading states throughout.

> **Backend-only modules:** the API also exposes wallets, incomes, transactions,
> debts/loans, and stats endpoints. These are functional on the server but are not
> yet surfaced as finished web pages — see [Roadmap](#roadmap).

---

## Tech Stack

### Frontend (`frontend/`)

| Tech | Purpose |
|---|---|
| Next.js 14 (App Router) | React framework & routing |
| TypeScript 5 (strict) | Language |
| Tailwind CSS 3 + CSS custom properties | Styling & design tokens |
| Axios | HTTP client with JWT interceptor |
| lucide-react | Icons |
| SweetAlert2 | Confirm dialogs |
| react-toastify | Toasts |
| geist | Font |
| React Context | State management (`AuthContext`, `store`) |
| WebSocket | Real-time chat & notifications |

### Backend (`backend/`)

| Tech | Purpose |
|---|---|
| FastAPI | Web framework |
| Uvicorn | ASGI server |
| SQLAlchemy 2.0 (async) | ORM |
| asyncpg | PostgreSQL async driver |
| Pydantic v2 | Request/response validation |
| python-jose | JWT creation & verification |
| passlib | Password hashing |
| openpyxl / pandas / xlrd | Excel import/export |
| websockets | Real-time chat & notifications |

### Database

| Tech | Purpose |
|---|---|
| PostgreSQL 16 | Primary data store (`pg_trgm`, `citext` extensions) |

---

## Project Structure

```
SplitEasy/
├── backend/                 # FastAPI service
│   ├── app/                 # Application package (import root: `app`)
│   │   ├── main.py          # App entry — CORS, router registration, startup/shutdown
│   │   ├── core/            # config, db engine/session, auth, security, migrations
│   │   ├── models/          # SQLAlchemy models (one module per domain)
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── repositories/    # Data-access queries & balance logic
│   │   ├── services/        # Domain services (e.g. debt minimization)
│   │   ├── routers/         # API route handlers (auth, groups, expenses, settle, …)
│   │   ├── seed_demo.py     # Optional demo dataset seeder (SEED_DEMO=1)
│   │   └── auth.py, db.py, … # Thin compatibility shims re-exporting from core/
│   ├── alembic/             # DB migrations (async env.py, versions/)
│   ├── alembic.ini
│   ├── tests/               # Backend tests
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/          # Next.js 14 web client
│   ├── app/                 # App Router pages (login, groups, expenses, jars, …)
│   ├── components/          # Shell, modals, UI primitives, charts, chat
│   ├── lib/                 # API client, mappers, types, stores, formatting
│   ├── hooks/               # React hooks (notifications)
│   ├── docs/                # Design system + page-level documentation
│   └── Dockerfile
│
├── database/                # PostgreSQL image + operational artifacts
│   ├── Dockerfile           # postgres:16-alpine
│   ├── init/01-init.sql     # Enables pg_trgm & citext on first init
│   ├── data/                # Live PG data (bind mount — gitignored)
│   └── backups/ seeds/ scripts/
│
├── docker-compose.yml       # Full stack: db + backend + web
├── .env.example             # Copy to .env for Docker Compose
└── README.md
```

> The backend lives in the `app/` package (`app.main:app`). Alongside the sub-packages
> (`core/`, `models/`, `schemas/`, `repositories/`, `services/`, `routers/`), the
> single-file modules in `app/` (`auth.py`, `config.py`, `db.py`, `crud.py`, etc.) are
> **compatibility shims** that re-export from those packages.

---

## Architecture Overview

```
┌─────────────────────────┐
│   Browser (Next.js web) │   React UI, Axios, WebSocket client
└───────────┬─────────────┘
            │  REST (JSON) + WebSocket
            │  Authorization: Bearer <JWT>
            ▼
┌─────────────────────────┐
│   Next.js server        │   /api/* rewrite → BACKEND_PROXY_TARGET
│   (rewrite proxy)        │
└───────────┬─────────────┘
            │  HTTP
            ▼
┌─────────────────────────┐
│   FastAPI backend        │   Routers → repositories/services → SQLAlchemy
│   JWT auth · WebSockets   │
└───────────┬─────────────┘
            │  asyncpg (postgresql+asyncpg)
            ▼
┌─────────────────────────┐
│   PostgreSQL 16          │   Groups · Expenses · Splits · Settlements · …
└─────────────────────────┘
```

- The web client talks to `/api` which Next.js rewrites to the backend (dev) or to a
  full URL via `NEXT_PUBLIC_API_URL` (prod).
- Tables are created on backend startup via `Base.metadata.create_all`, then custom
  Postgres migrations in `backend/app/core/migrations.py` run to reconcile schema drift.
- Real-time features (group chat, notifications) use WebSocket connections straight to
  the backend.

---

## Screenshots

> _Screenshots are not committed to the repository yet. Add images under
> `frontend/public/screenshots/` and update the links below._

| Dashboard | Group detail | Expenses |
|---|---|---|
| _(placeholder)_ | _(placeholder)_ | _(placeholder)_ |

| Settlements | Économé jars | Group chat |
|---|---|---|
| _(placeholder)_ | _(placeholder)_ | _(placeholder)_ |

---

## Installation

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **PostgreSQL** 16 (or use the Docker Compose setup below)

### 1. Get the code from GitHub

Clone the repository and enter it:

```bash
git clone https://github.com/SamirEzzahir/SpliteEasy-PFE.git
cd SpliteEasy-PFE
```

> Using SSH instead of HTTPS? `git clone git@github.com:SamirEzzahir/SpliteEasy-PFE.git`

**To stay up to date** with the latest changes on `main`:

```bash
git checkout main
git pull origin main
```

**To contribute**, fork the repo on GitHub, clone your fork, add the original as
`upstream`, and work on a feature branch:

```bash
git clone https://github.com/<your-username>/SpliteEasy-PFE.git
cd SpliteEasy-PFE
git remote add upstream https://github.com/SamirEzzahir/SpliteEasy-PFE.git
git checkout -b feat/my-change
# …make changes, commit…
git push origin feat/my-change   # then open a Pull Request on GitHub
```

### 2. Configure PostgreSQL

Create a database (defaults used throughout the project):

```sql
CREATE DATABASE spliteasy_db;
```

Enable the extensions used by the schema (also handled automatically by the Docker
image via `database/init/01-init.sql`):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
```

### 3. Backend setup

```bash
# From the project root
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux / macOS

pip install -r backend/requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres123@localhost:5432/spliteasy_db
JWT_SECRET=change-me-in-production
```

Run the API **from the `backend/` folder** (the FastAPI package is `app`):

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8800
```

- API: `http://localhost:8800`
- Interactive docs (Swagger): `http://localhost:8800/docs`

### 4. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local      # optional — localhost defaults work out of the box
npm run dev
```

Open `http://localhost:3000` (redirects to `/login`).

### Environment Variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | backend | `sqlite+aiosqlite:///./splitapp.db` | DB connection string (use the Postgres URL above) |
| `JWT_SECRET` | backend | `samir` | JWT signing secret — **change in production** |
| `ADMIN_USERNAME` | backend | _(unset)_ | If set, the user with this username is granted the **Super Admin** role on startup (first-admin bootstrap) |
| `NEXT_PUBLIC_API_URL` | frontend | _(blank)_ | Blank = use the `/api` dev proxy; set a full URL in production |
| `BACKEND_PROXY_TARGET` | frontend | `http://127.0.0.1:8800` | Dev proxy target for `/api/*` |
| `NEXT_PUBLIC_WS_URL` | frontend | `ws://127.0.0.1:8800` | WebSocket base for chat/notifications |

---

## Docker

The repository ships a full-stack `docker-compose.yml` (PostgreSQL + backend + web).

```bash
# 1. Copy the env template and adjust secrets/credentials as needed
cp .env.example .env

# 2. Build and start everything
docker compose up --build
```

| Service | Container port | Host port | Notes |
|---|---|---|---|
| `db` (PostgreSQL 16) | 5432 | `POSTGRES_PORT` (5432) | Data persists in the `pgdata` volume |
| `backend` (FastAPI) | 8000 | `BACKEND_PORT` (8000) | Waits for the DB healthcheck before starting |
| `web` (Next.js) | 3000 | `WEB_PORT` (3000) | Rewrites `/api/*` to the backend container |

Then open `http://localhost:3000`. The backend creates tables and runs migrations on
first startup. To reset the database completely:

```bash
docker compose down -v && docker compose up --build
```

---

## API Overview

The backend mounts these router modules (full request/response details live in the
interactive docs at `/docs`, and a per-endpoint reference is in
[`backend/README.md`](backend/README.md)):

| Module | Prefix | Responsibility |
|---|---|---|
| Auth | `/` | Register, login, current user |
| Users | `/users` | Profile, password, preferred currency, settlement mode |
| Groups | `/groups` | Group CRUD + WebSocket group chat |
| Memberships | `/memberships` | Add/remove/update members |
| Expenses | `/expenses` | Expense CRUD, splits, Excel import/export, pagination |
| Friends | `/friends` | Friend search & requests |
| Settle | `/settle` | Group & global balances, settlement record/accept/reject |
| Notifications | `/Notifications` | REST + WebSocket notifications |
| Support | `/support` | User support portal — create & follow tickets, reply, close |
| Activity | `/activity` | User activity log |
| Stats | `/stats` | Spending statistics |
| Dashboard | `/dashboard` | Summary totals |
| Économé | `/econome` | 6-jar budgeting, income logs, jar transactions |
| Incomes / Income Types | `/incomes`, `/income-types` | Income tracking (backend) |
| Wallets / Transactions | `/wallets`, `/transactions` | Wallet management (backend) |
| Debts & Loans | `/debts-loans` | Personal debt/loan tracking (backend) |
| Admin | `/admin` | Back-office: dashboard stats, users, groups, expenses, settlements, support, roles & audit logs (RBAC) |

---

## Authentication

SplitEasy uses **JWT bearer authentication**:

1. **Login** — `POST /login` with form-encoded credentials
   (`OAuth2PasswordRequestForm`) returns a signed JWT.
2. **Storage** — the web client stores the token in `localStorage`
   (`spliteasy.token`).
3. **Requests** — an Axios interceptor attaches `Authorization: Bearer <token>` to
   every request.
4. **Protected routes** — backend handlers depend on `get_current_user`; the frontend
   wraps authenticated pages in `RequireAuth`.
5. **Expiry / 401** — a 401 clears the token and redirects to `/login`.
6. **RBAC** — admin endpoints are guarded by a `require_permission` dependency that
   checks the permission keys stored on the user's role.

---

## Main Features

| Feature | Status | Notes |
|---|---|---|
| Authentication | ✅ Implemented | JWT login/register/session, protected routes |
| Friends | ✅ Implemented | Search, request, accept/reject |
| Groups | ✅ Implemented | CRUD, members, per-group currency |
| Expenses | ✅ Implemented | CRUD, filters, pagination, category donut, Excel I/O |
| Expense splitting | ✅ Implemented | Equal or custom shares |
| Settlements | ✅ Implemented | Group balances, suggested payments, approval flow |
| Global settlements | ✅ Implemented | Cross-group balances with friends |
| Group chat | ✅ Implemented | Per-group WebSocket messaging |
| Notifications | ✅ Implemented | Real-time bell + REST fallback |
| Support / tickets | ✅ Implemented | User portal + admin queue: categories, priority, threaded replies, assignment, status lifecycle |
| Économé (jars) | ✅ Implemented | 6-jar budgeting module |
| Settings & dark mode | ✅ Implemented | Profile, password, currency, theme |
| Responsive design | ✅ Implemented | Mobile bottom nav, FAB, skeletons |
| Admin panel | ✅ Implemented | `/admin` back-office: dashboard, users, groups, expenses, settlements, support, roles, audit logs (RBAC) |
| Wallets / Debts / Reports | 🚧 Backend-ready | API exists; web pages are placeholders |

---

## Development

- **Type-check the frontend** after UI changes:
  ```bash
  cd frontend && npx tsc --noEmit
  ```
  The tree must be type-clean — `next build` (and the Docker image) fails on any TS
  error.
- **Lint the frontend:**
  ```bash
  cd frontend && npm run lint
  ```
- **Design system** — read [`frontend/docs/DESIGN_SYSTEM.md`](frontend/docs/DESIGN_SYSTEM.md)
  before building or editing any page. Reuse shared primitives, use CSS variables for
  color, and follow the New-Page Checklist.
- **AI assistant guide** — [`CLAUDE.md`](CLAUDE.md) describes product scope and
  non-negotiable conventions.
- **Backend conventions** — all DB access is async; run uvicorn from the project root
  so the `backend` package imports resolve.

---

## Production Deployment

The recommended path is **Docker Compose** (see [Docker](#docker)). For a production
deployment:

1. Set strong secrets in the root `.env`: `JWT_SECRET`, `POSTGRES_PASSWORD`.
2. Point the web container at the public API by building with `NEXT_PUBLIC_API_URL`
   (or keep the internal `BACKEND_PROXY_TARGET` rewrite behind a single domain).
3. Restrict CORS — `backend/app/main.py` currently allows all origins (`["*"]`); lock this
   down to your frontend origin before going live.
4. Put a TLS-terminating reverse proxy (e.g. Nginx, Caddy, Traefik) in front of the
   `web` and `backend` services.
5. Back up the `pgdata` volume.

---

## License

No license file is currently present in the repository. Until a `LICENSE` file is
added, all rights are reserved by the project author. Add a license (e.g. MIT) to
make reuse terms explicit.
