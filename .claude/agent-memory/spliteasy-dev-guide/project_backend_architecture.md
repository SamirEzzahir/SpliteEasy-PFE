---
name: Backend Architecture
description: Overall FastAPI backend layout — dual-layer structure, modules, routing, auth, DB access, and business logic
type: project
---

# SplitEasy Backend Architecture

**Why:** Documented after full codebase exploration on 2026-05-22.
**How to apply:** Use this as the authoritative map when helping with any backend task.

## Root layout (backend/)

The backend has a deliberate two-layer design:

### Layer 1 — Flat legacy files (still used by routers)
These are thin re-export shims that point into the new `core/` structure:
- `auth.py` — re-exports from `core/auth`
- `config.py` — re-exports from `core/config`
- `db.py` — re-exports from `core/db`
- `dependencies.py` — re-exports from `core/dependencies`
- `migrations.py` — re-exports from `core/migrations`
- `utils.py` — re-exports from `core/security`
- `crud.py` — re-exports from `repositories/` (all repo functions aggregated here)
- `debt.py` — contains the cash-flow minimization algorithm (`minimize_cash_flow`)
- `schemas.py` — (deleted, replaced by `schemas/` package)
- `models.py` — (deleted, replaced by `models/` package)

### Layer 2 — New structured packages
- `core/` — infrastructure: config, db engine, auth logic, security, dependencies, manual migrations
- `models/` — all SQLAlchemy ORM models (one file per domain)
- `schemas/` — all Pydantic request/response schemas (one file per domain)
- `repositories/` — database query functions (CRUD operations per domain)
- `services/` — business logic (currently only `services/debt.py` with `minimize_cash_flow`)

## Key modules

### core/config.py
- Pydantic `Settings` class reads from `.env`
- `DATABASE_URL` (default: `sqlite+aiosqlite:///./splitapp.db`)
- `JWT_SECRET`, `JWT_ALG` (HS256), `ACCESS_TOKEN_EXPIRE_MINUTES` (7 days)
- Also defines `JAR_CONFIG` (6-jar budgeting strategy: NEC, FFA, EDU, LTSS, PLAY, GIVE)

### core/db.py
- Async SQLAlchemy: `create_async_engine`, `AsyncSession`
- `get_session()` — async generator used as FastAPI dependency

### core/auth.py
- `authenticate(session, username, password)` — looks up user, verifies password hash
- `create_access_token(username)` — encodes JWT via python-jose
- `get_current_user(session, token)` — FastAPI dependency; decodes JWT, returns User ORM object with role eagerly loaded

### core/security.py
- passlib with `pbkdf2_sha256` scheme
- `hash_password()`, `verify_password()`

### core/dependencies.py
- `require_permission(permission: str)` — returns a FastAPI dependency that checks `current_user.role.permissions` (JSON array); `"*"` grants all

### core/migrations.py
- Manual `ALTER TABLE` migration functions (NOT Alembic)
- Checks `information_schema.COLUMNS` for column existence before adding — MySQL-specific
- Migrations covered: settlements columns, global_settlement_mode on users, transactions nullable to_wallet_id, transaction_type enum, debts/loans tables, expenses jar columns, group_messages table
- Called at startup via `on_startup` in `main.py`

## Models (models/)
One file per domain, all inherit from `models/base.py` (`DeclarativeBase`):
- `user.py` — User, Role, Reclamation (GenderEnum, GlobalSettlementMode, ReclamationStatus enums)
- `group.py` — Group, Membership, GroupMessage
- `expense.py` — Expense, Split
- `friend.py` — Friend (FriendStatus enum)
- `settlement.py` — Settlement, GlobalSettlement (SettlementStatus enum)
- `finance.py` — Wallet, Transaction, IncomeType, Income, IncomeSource, IncomeLog (TransactionType enum)
- `debt.py` — Debt, Loan, DebtRepayment, LoanRepayment (DebtLoanStatus enum)
- `econome.py` — JarStrategy, JarTransaction
- `activity.py` — ActivityLog
- `notification.py` — Notification

## Routers (routers/) — 19 total
auth, users, friends, groups, expenses, stats, notifications, settle, memberships, activity, incomes, transactions, dashboard, income_types, wallets, debts_loans, econome, admin

All routers import from the legacy flat files (`backend.auth`, `backend.crud`, `backend.db`, `backend.schemas`) — they have NOT been updated to import directly from the new packages yet.

## Request lifecycle
1. HTTP request hits FastAPI router in `routers/`
2. Router function receives `session: AsyncSession = Depends(get_session)` and `current: User = Depends(get_current_user)`
3. Router calls a function from `crud.py` (which delegates to a `repositories/` function)
4. Repository executes async SQLAlchemy query, returns ORM objects
5. Router maps result to a Pydantic schema from `schemas/` and returns JSON

## main.py startup
- Creates all tables via `Base.metadata.create_all` (SQLAlchemy DDL)
- Then runs `run_migrations()` from `core/migrations.py` for additive column changes
- Registers all 19 routers with tags
- CORS: currently `allow_origins=["*"]` (hardcoded, overrides the env-based logic above it)
