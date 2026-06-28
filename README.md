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
- **Dark mode** — full light/dark theming via CSS custom properties.
- **Responsive design** — desktop sidebar collapses to a mobile bottom nav with an
  action-sheet FAB; skeleton loading states throughout.

> **Backend-only modules:** the API also exposes wallets, incomes, transactions,
> debts/loans, an admin panel (roles & support tickets), and stats endpoints. These
> are functional on the server but are not yet surfaced as finished web pages — see
> [Roadmap](#roadmap).

---

## Tech Stack

### Frontend (`splitea-nextjs/`)

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
├── backend/                 # FastAPI application (package: `backend`)
│   ├── main.py              # App entry — CORS, router registration, startup/shutdown
│   ├── core/                # config, db engine/session, auth, security, migrations
│   ├── models/              # SQLAlchemy models (one module per domain)
│   ├── schemas/             # Pydantic request/response schemas
│   ├── repositories/        # Data-access queries & balance logic
│   ├── services/            # Domain services (e.g. debt minimization)
│   ├── routers/             # API route handlers (auth, groups, expenses, settle, …)
│   ├── auth.py, db.py, …    # Thin compatibility shims re-exporting from core/
│   ├── requirements.txt
│   └── Dockerfile
│
├── splitea-nextjs/          # Next.js 14 web client
│   ├── app/                 # App Router pages (login, groups, expenses, jars, …)
│   ├── components/          # Shell, modals, UI primitives, charts, chat
│   ├── lib/                 # API client, mappers, types, stores, formatting
│   ├── hooks/               # React hooks (notifications)
│   ├── docs/                # Design system + page-level documentation
│   └── Dockerfile
│
├── postgres/                # Dockerized PostgreSQL 16 + init scripts
│   ├── Dockerfile
│   └── init/01-init.sql     # Enables pg_trgm & citext on first volume creation
│
├── docker-compose.yml       # Full stack: db + backend + web
├── .env.example             # Copy to .env for Docker Compose
└── README.md
```

> The backend was migrated from a flat-file layout to packages (`core/`, `models/`,
> `schemas/`, `repositories/`, `services/`). The remaining single-file modules at the
> backend root (`auth.py`, `config.py`, `db.py`, `crud.py`, etc.) are **compatibility
> shims** that re-export from those packages.

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
  Postgres migrations in `backend/core/migrations.py` run to reconcile schema drift.
- Real-time features (group chat, notifications) use WebSocket connections straight to
  the backend.

---

## Screenshots

> _Screenshots are not committed to the repository yet. Add images under
> `splitea-nextjs/public/screenshots/` and update the links below._

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

### 1. Clone

```bash
git clone <repository-url> SplitEasy
cd SplitEasy
```

### 2. Configure PostgreSQL

Create a database (defaults used throughout the project):

```sql
CREATE DATABASE spliteasy_db;
```

Enable the extensions used by the schema (also handled automatically by the Docker
image via `postgres/init/01-init.sql`):

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

Run the API **from the project root** (imports use the `backend` package):

```bash
python -m uvicorn backend.main:app --reload --port 8800
```

- API: `http://localhost:8800`
- Interactive docs (Swagger): `http://localhost:8800/docs`

### 4. Frontend setup

```bash
cd splitea-nextjs
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
| `backend` (FastAPI) | 8000 | `BACKEND_PORT` (8800) | Waits for the DB healthcheck before starting |
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
| Activity | `/activity` | User activity log |
| Stats | `/stats` | Spending statistics |
| Dashboard | `/dashboard` | Summary totals |
| Économé | `/econome` | 6-jar budgeting, income logs, jar transactions |
| Incomes / Income Types | `/incomes`, `/income-types` | Income tracking (backend) |
| Wallets / Transactions | `/wallets`, `/transactions` | Wallet management (backend) |
| Debts & Loans | `/debts-loans` | Personal debt/loan tracking (backend) |
| Admin | `/admin` | User/role management & support tickets (RBAC) |

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
| Économé (jars) | ✅ Implemented | 6-jar budgeting module |
| Settings & dark mode | ✅ Implemented | Profile, password, currency, theme |
| Responsive design | ✅ Implemented | Mobile bottom nav, FAB, skeletons |
| Wallets / Debts / Reports | 🚧 Backend-ready | API exists; web pages are placeholders |
| Admin panel | 🚧 Backend-only | `/admin` API exists; no web UI yet |

---

## Development

- **Type-check the frontend** after UI changes:
  ```bash
  cd splitea-nextjs && npx tsc --noEmit
  ```
  The tree must be type-clean — `next build` (and the Docker image) fails on any TS
  error.
- **Lint the frontend:**
  ```bash
  cd splitea-nextjs && npm run lint
  ```
- **Design system** — read [`splitea-nextjs/docs/DESIGN_SYSTEM.md`](splitea-nextjs/docs/DESIGN_SYSTEM.md)
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
3. Restrict CORS — `backend/main.py` currently allows all origins (`["*"]`); lock this
   down to your frontend origin before going live.
4. Put a TLS-terminating reverse proxy (e.g. Nginx, Caddy, Traefik) in front of the
   `web` and `backend` services.
5. Back up the `pgdata` volume.

---

## License

No license file is currently present in the repository. Until a `LICENSE` file is
added, all rights are reserved by the project author. Add a license (e.g. MIT) to
make reuse terms explicit.
