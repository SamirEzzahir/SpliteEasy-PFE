# Architecture Overview

This document explains how SplitEasy is assembled at a system level after reading the current codebase.

## High-Level Topology

```text
Browser pages / Capacitor webview
    -> frontend/js/config.js for API base URL, auth headers, and retries
    -> page-specific JS files for UI behavior
    -> REST calls to FastAPI routers
    -> WebSocket connection to /Notifications/ws/{user_id}
    -> SQLAlchemy models + CRUD helpers
    -> database
```

The application is not split into separate services. It is a single FastAPI app with many feature routers plus a static frontend.

## Main Layers

### Backend layer

Core backend files:

- [`backend/main.py`](../backend/main.py): app creation, CORS, startup/shutdown, router registration
- [`backend/db.py`](../backend/db.py): async engine, session factory, declarative base
- [`backend/auth.py`](../backend/auth.py): login validation, JWT creation, current-user dependency
- [`backend/models.py`](../backend/models.py): SQLAlchemy entities
- [`backend/schemas.py`](../backend/schemas.py): Pydantic request/response models
- [`backend/crud.py`](../backend/crud.py): most business logic for users, groups, expenses, balances, and incomes
- [`backend/migrations.py`](../backend/migrations.py): startup migration helpers
- [`backend/routers/`](../backend/routers): feature endpoints

### Frontend layer

The frontend is a classic multi-page app:

- each page is an HTML file in [`frontend/`](../frontend)
- shared state and helpers live in [`frontend/js/config.js`](../frontend/js/config.js)
- navigation is built dynamically by [`frontend/js/navbar.js`](../frontend/js/navbar.js)
- notifications are handled globally by [`frontend/js/notifications.js`](../frontend/js/notifications.js)
- each major screen has its own script file

There is no bundler, module system, or client-side router. Script load order matters.

### Mobile layer

[`capacitor.config.json`](../capacitor.config.json) points `webDir` to `frontend`, so Android is a wrapper around the same static web app. The native project under [`android/`](../android) mostly packages the web layer rather than introducing a second client implementation.

## Router Map

`backend/main.py` registers these major areas:

- auth
- users
- friends
- groups
- memberships
- expenses
- settle
- notifications
- activity
- dashboard
- stats
- incomes
- income types
- wallets
- transactions
- debts and loans
- econome
- admin

That router list matches the product shape: shared expenses, personal finance, notifications, analytics, and admin.

## Core Domain Model

### Identity and access

- `User`
- `Role`
- `Reclamation`

Users can be active/inactive, can belong to a role, and store a `global_settlement_mode` preference.

Roles hold permissions as a JSON string, and admin routes use `require_permission(...)` from [`backend/dependencies.py`](../backend/dependencies.py).

### Shared expense domain

- `Group`
- `Membership`
- `Expense`
- `Split`
- `Settlement`
- `GlobalSettlement`
- `Friend`
- `GroupMessage`
- `ActivityLog`
- `Notification`

This is the main collaborative surface of the app.

### Personal finance domain

- `Wallet`
- `IncomeType`
- `Income`
- `Transaction`
- `Debt`
- `Loan`
- `DebtRepayment`
- `LoanRepayment`

### Econome domain

- `JarStrategy`
- `IncomeSource`
- `IncomeLog`
- `JarTransaction`

## Important Business Flows

### 1. Registration and login

In [`backend/routers/auth.py`](../backend/routers/auth.py):

- register creates the user
- register also creates a default `Personal Expenses` group
- login verifies credentials
- login backfills that personal group if it is missing

That means the app assumes every user should have a personal/private expense group from day one.

### 2. Group expense flow

The main expense flow spans [`backend/routers/expenses.py`](../backend/routers/expenses.py) and [`backend/crud.py`](../backend/crud.py):

1. user creates a group
2. memberships are created for owner and invited users
3. user creates an expense with splits
4. payer wallet is reduced if a wallet was attached
5. optional jar transaction is also written if the expense came from an Econome jar
6. split rows are created per participant
7. activity is logged
8. notifications are sent to affected members

Group balances are then computed from:

- what each payer paid
- what each participant owes via `Split`
- accepted settlements already recorded in that group

### 3. Group settlement approval flow

Group settlements are not immediately final. In [`backend/routers/settle.py`](../backend/routers/settle.py):

- a user records a settlement request
- the recipient sees it as `pending`
- the recipient can accept, reject, or later receive a resend

The same approval pattern exists for global settlements.

### 4. Global settlements and adjustment modes

Users store a `global_settlement_mode`:

- `separate`
- `auto_adjust`
- `hybrid`

This value affects how group balances are shown:

- `separate`: group balances ignore global settlements
- `auto_adjust`: group balances are adjusted by accepted global settlements
- `hybrid`: group balances return both original values and adjusted deltas

The proportional adjustment logic lives in [`backend/crud.py`](../backend/crud.py), especially:

- `compute_global_settlement_adjustment_for_group`
- `compute_group_balances_with_adjustments`
- `compute_global_balances`

### 5. Real-time notifications and chat

Notifications are handled in [`backend/routers/notifications.py`](../backend/routers/notifications.py):

- every notification is saved to the database
- if the target user has an active WebSocket, a live message is pushed immediately

Group chat is layered on top of that:

- messages are stored by group routes
- new chat payloads are broadcast through the notification WebSocket connection
- [`frontend/js/notifications.js`](../frontend/js/notifications.js) detects `new_chat_message`
- [`frontend/js/chat.js`](../frontend/js/chat.js) listens for that event and appends the message in the current group UI

So there is not a separate chat socket. Chat piggybacks on the notification channel.

### 6. Personal finance flow

The personal-finance side is built around:

- wallets
- income types
- incomes
- transfer transactions
- debts
- loans

Important behavior:

- creating income increases a wallet balance
- editing or deleting income adjusts wallet balances to stay consistent
- wallet-to-wallet transfers create `Transaction` records
- creating debt can increase a wallet because money was borrowed
- creating loan can decrease a wallet because money was lent out
- repayments reverse those balances gradually

### 7. Econome flow

The Econome subsystem is mostly self-contained:

- strategies define percentage splits across jars
- distributing income creates an `IncomeLog` and multiple positive `JarTransaction` rows
- spending creates negative `JarTransaction` rows
- transfers write a negative row in one jar and a positive row in another
- the ledger page merges `IncomeLog` and expense-like jar transactions into a single UI feed

## Startup and Persistence Behavior

On app startup in [`backend/main.py`](../backend/main.py):

- `Base.metadata.create_all` runs
- custom migrations are attempted

This is convenient in development, but it also means schema behavior is partly driven by startup side effects rather than a dedicated migration tool.

## Notable Implementation Notes

- `backend/migrations.py` uses MySQL-oriented `information_schema` checks even though `backend/config.py` defaults to SQLite.
- CORS origin lists are computed but currently bypassed by `allow_origins=["*"]`.
- The frontend stores auth-related data in multiple keys such as `token`, `user`, and `currentUser`, depending on the script.
- Currency defaults are not fully normalized across backend and frontend.
- The project is functional, but it has grown into a large monolith with a lot of business logic concentrated in `backend/crud.py` and a few very large frontend scripts.

## Where To Read Next

If you are onboarding, a good reading order is:

1. [`backend/main.py`](../backend/main.py)
2. [`backend/models.py`](../backend/models.py)
3. [`backend/crud.py`](../backend/crud.py)
4. [`backend/routers/settle.py`](../backend/routers/settle.py)
5. [`frontend/js/config.js`](../frontend/js/config.js)
6. [`frontend/js/group.js`](../frontend/js/group.js)
7. [`frontend/js/expenses.js`](../frontend/js/expenses.js)
8. [`frontend/js/notifications.js`](../frontend/js/notifications.js)
