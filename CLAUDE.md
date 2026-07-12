# SplitEasy — Project Guide for AI Assistants

> Memory layer for Claude Code. Read this first, every session. Deep references
> live in [`.claude/docs/`](.claude/docs/). Specialized procedures live in
> [`.claude/skills/`](.claude/skills/); role agents in [`.claude/agents/`](.claude/agents/).

## What this product is
SplitEasy is an **expense-sharing app** (Splitwise / Tricount style). The core is:
**Groups · Expenses · Balances · Settlements · Members · Group Chat.**

It is **NOT** a personal-finance / wallet / budgeting / savings app. Never add
"net worth", "savings", "wallet balance", "budget", or income-tracking concepts
to the product surface. (The API *does* expose backend-only modules — wallets,
incomes, debts/loans, jars — but they are not the product's identity; don't
surface new ones unless asked.)

Every screen must answer in 5 seconds: **"Who owes what, and what do I do next?"**

## Stack (verified)
- **Backend** — FastAPI 0.116 · SQLAlchemy 2.0 async · asyncpg · Pydantic v2 ·
  python-jose (JWT HS256) · passlib (pbkdf2_sha256) · Alembic. Package root: `app`.
- **Frontend** — Next.js 14 (App Router) · TypeScript 5 strict · a **custom
  CSS-variable design system** (`globals.css`) · Tailwind (available) · lucide-react ·
  SweetAlert2 · react-toastify · Axios.
- **Database** — PostgreSQL 16 (alpine), `pg_trgm` + `citext` extensions.
- **Infra** — Docker Compose (`db` · `backend` · `web`); Makefile; GitHub Actions CI.

## Repository map (top level)
```
backend/     FastAPI service. Code in the `app/` package (uvicorn app.main:app).
frontend/    Next.js web client (App Router).
database/    Postgres image (Dockerfile, init/), plus data/ (bind mount) & backups/seeds/scripts.
docs/        Documentation index (→ service docs).
scripts/     Repo scripts.
docker-compose.yml · Makefile · .env.example
.claude/     This AI workspace (agents, skills, hooks, docs).
```
Full map: [`.claude/docs/REPO_MAP.md`](.claude/docs/REPO_MAP.md).

## Backend architecture — layered / repository pattern
`routers → repositories → services → models`, with Pydantic `schemas` as the
API contract and `core` for infrastructure.

| Folder (`backend/app/`) | Responsibility |
|---|---|
| `main.py` | App factory: CORS, maintenance middleware, router registration, startup/shutdown |
| `core/` | Infra: `config`, `db` (async engine/session), `security`, `auth` (JWT), `dependencies` (RBAC), `migrations` (idempotent runtime), `settings_store` |
| `models/` | SQLAlchemy 2.0 ORM (`Mapped[...]`), one module per domain; enums stored as VARCHAR (`native_enum=False`) |
| `schemas/` | Pydantic v2 DTOs (request/response) — the API contract, decoupled from ORM |
| `repositories/` | Data access & query/balance logic (one module per aggregate) |
| `services/` | Pure domain logic (e.g. `debt.py` cash-flow minimization) |
| `routers/` | FastAPI endpoints — thin; delegate to repositories/services |
| `auth.py, db.py, config.py, …` (at `app/` root) | **Compatibility shims** re-exporting from `core/`/`repositories/`. Keep; don't expand |

Startup order (`main.py`): force UTF-8 stdout → `ensure_database_exists()` →
`Base.metadata.create_all` → `run_migrations()` (idempotent) → load settings →
optional demo seed (`SEED_DEMO=1`). Migrations are **runtime** today; Alembic is
adopted with an empty baseline and coexists — see the migrations skill.

## Frontend architecture
- **Entry/composition:** `app/layout.tsx` wraps every page in providers
  `AuthProvider → WSProvider → PublicSettingsProvider → AppProvider → ConditionalShell`.
- **Data/API backbone:** `lib/api/client.ts` (single Axios instance: JWT interceptor,
  global 401, `wsBaseUrl()`); per-feature modules in `lib/api/*`; `types.ts` + `mappers.ts`.
- **State:** `lib/store.tsx` (groups/expenses/friends/balances), `lib/auth/AuthContext`, `lib/ws-context`.
- **Routing:** each folder in `app/` is a route. Browser calls `/api`, proxied by
  `next.config.mjs` rewrites to the backend (dev) or `NEXT_PUBLIC_API_URL` (prod).

## 🎨 Design contract — READ BEFORE BUILDING UI
Source of truth: **`frontend/docs/DESIGN_SYSTEM.md`**. Non-negotiable:
1. **Reuse shared primitives** — one `.page-head`, one `.card.stat-c`, one `FilterDropdown`,
   the `components/ui/*` kit. Don't invent per-page variants.
2. **Money:** always `fmt(amount, currency)` from `@/lib/format`; fallback **`"MAD"`**, never `"USD"`.
3. **Colors:** CSS variables only (`--primary`, `--success`, `--rose`, `--teal`, `--warn`,
   `--ink*`, `--line`, `--surface`). Never hardcode hex. green = owed to you · red = you owe ·
   teal = settlement · amber = pending.
4. **Radii:** `var(--radius)` (14px) for cards/inputs, `999px` for pills.
5. **Mobile-first:** every table needs a `.gx-exp-card` mobile fallback; touch targets ≥44px; inputs ≥16px.
6. **Loading = skeletons. Empty states = icon + message + CTA.**
7. **Confirms:** SweetAlert2 (`Swal.fire`) or undo-toast — never native `confirm()`.
8. **Pagination:** ellipsis pattern (max ~7 buttons). **Dark mode:** bind colors to CSS
   variables so the theme toggle flips them automatically.

Reference implementations: `frontend/app/expenses/page.tsx` (filters, pagination, empty states),
`frontend/app/groups/[id]/page.tsx` (table + mobile cards + settlements). Page docs: `frontend/docs/*.md`.

## Naming & conventions
- **Python:** `snake_case` modules/functions/vars, `PascalCase` classes. Import root is
  **`app`** (`from app.core.db import ...`). Money as `Numeric(12,2)`; round via the shared helper.
- **TypeScript:** `camelCase` vars/functions, `PascalCase` components/types. Path alias `@/…`.
  Enum strings match the backend contract (e.g. `split_type`: `equal|percentage|share`).
- **API paths:** routers mount at root prefixes (`/auth`, `/groups`, `/expenses`, `/settle`, …);
  the frontend hits them through the `/api` proxy, which strips `/api`.

## Common commands
```bash
# Docker (full stack)
docker compose up -d --build      # or: make up / make rebuild
make logs                         # tail logs
make seed / make seed-force       # demo dataset (login: demo / demo)

# Dev mode (hot reload) — DB in Docker, backend + frontend local
make dev-db                       # docker compose up -d db
cd backend && .venv/Scripts/activate && uvicorn app.main:app --reload --port 8800
cd frontend && npm run dev        # :3000

# Quality
make test                         # backend pytest
make lint                         # ruff (backend) + tsc (frontend)
cd frontend && npx tsc --noEmit   # typecheck — MUST pass (Docker/CI build fails on TS errors)

# Migrations (Alembic)
make migration m="add x"          # autogenerate — ALWAYS review the diff (see migrations skill)
make migrate                      # upgrade head
make stamp                        # baseline a fresh DB
```

## Git workflow
Default branch `main`. Branch for changes; scoped, conventional commits
(`feat:`, `fix:`, `chore:`, `docs:`). Never commit secrets (`.env`, `backend/.env`,
`frontend/.env.local`) or DB data (`database/data/`) — all gitignored.

## ✅ Claude must ALWAYS
- Run `npx tsc --noEmit` in `frontend/` after UI changes; verify backend imports
  (`python -c "import app.main"`) after backend changes.
- Follow the layered flow: queries in `repositories/`, domain logic in `services/`,
  thin `routers/`, DTOs in `schemas/`.
- Reuse design-system primitives and `fmt()`; keep light/dark parity via CSS vars.
- Prefer editing/moving files over deleting+recreating (preserve git history).
- Inspect a directory/file before deleting or overwriting it.

## ⛔ Claude must NEVER
- Change API contracts, DB schema, models, or business logic when asked only to
  refactor/organize/style.
- Add personal-finance concepts (net worth, budgets, savings) to the product.
- Hardcode hex colors or `"USD"`; use native `confirm()`; invent per-page UI variants.
- Hand-edit applied Alembic migrations in `backend/alembic/versions/`, or the Postgres
  data in `database/data/`.
- Break the `app` import root (no `from backend.*`), or run `next build` while
  `next dev` is running in the same folder (corrupts `.next`).
- Commit secrets or generated artifacts (`.next/`, `__pycache__/`, `*.db`).

## How to implement a new feature
1. **Backend:** model (if needed) → schema → repository → service (if logic) → router →
   register in `main.py`. Alembic migration if the schema changed.
2. **Frontend:** API module in `lib/api/` → types in `types.ts` → page/component using
   design-system primitives → wire state via `store`/context.
3. **Verify:** backend import + `make test`; frontend `tsc --noEmit` (+ build if risky);
   `docker compose config -q`.

Detailed procedures → [`.claude/skills/`](.claude/skills/). Review gates →
[`.claude/docs/REVIEW_CHECKLIST.md`](.claude/docs/REVIEW_CHECKLIST.md).
