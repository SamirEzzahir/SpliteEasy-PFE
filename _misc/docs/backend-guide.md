# Backend Guide

This guide describes the current backend behavior, router by router, and highlights the important model and logic relationships.

## Stack

- FastAPI
- SQLAlchemy async ORM
- Pydantic
- JWT auth via `python-jose`
- optional SQLite/MySQL/Postgres async drivers in `requirements.txt`

Key entry files:

- [`backend/main.py`](../backend/main.py)
- [`backend/db.py`](../backend/db.py)
- [`backend/auth.py`](../backend/auth.py)
- [`backend/models.py`](../backend/models.py)
- [`backend/schemas.py`](../backend/schemas.py)
- [`backend/crud.py`](../backend/crud.py)

## Auth and Request Context

### Authentication

[`backend/auth.py`](../backend/auth.py) provides:

- `authenticate(...)`
- `create_access_token(...)`
- `get_current_user(...)`

Tokens store the username and expiration. Most routers depend on `get_current_user`.

### Permissions

[`backend/dependencies.py`](../backend/dependencies.py) adds role-based permission checks:

- roles store permissions as a JSON string
- `require_permission("some_permission")` is used by admin routes
- `"*"` grants full access

## Startup Behavior

On startup the backend:

- creates tables from ORM metadata
- attempts a list of custom migration functions

Migration helpers currently cover:

- settlement columns
- user global settlement mode
- transaction schema changes
- debts and loans tables
- expense jar fields
- group message table

Important note: migration SQL is largely MySQL-oriented, especially the `information_schema` checks in [`backend/migrations.py`](../backend/migrations.py).

## Model Summary

### User and access models

- `Role`: name plus serialized permissions
- `User`: auth, profile fields, role, active flag, settlement mode
- `Reclamation`: support ticket / admin workflow

### Shared expense models

- `Group`
- `Membership`
- `GroupMessage`
- `Expense`
- `Split`
- `Friend`
- `Settlement`
- `GlobalSettlement`
- `ActivityLog`
- `Notification`

### Personal finance models

- `IncomeType`
- `Wallet`
- `Income`
- `Transaction`
- `Debt`
- `Loan`
- `DebtRepayment`
- `LoanRepayment`

### Econome models

- `JarStrategy`
- `IncomeSource`
- `IncomeLog`
- `JarTransaction`

## Router Inventory

### `/auth`

File: [`backend/routers/auth.py`](../backend/routers/auth.py)

Main endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Important behavior:

- registration rejects duplicate username/email
- registration creates a default `Personal Expenses` group
- login ensures that personal group exists even for older users

### `/users`

File: [`backend/routers/users.py`](../backend/routers/users.py)

Main endpoints:

- `GET /users/`
- `GET /users/{user_id}`
- `GET /users/user/me`
- `PUT /users/user/me/global-settlement-mode`
- `PUT /users/{user_id}`
- `POST /users/user/me/change-password`
- `DELETE /users/{user_id}`

Important behavior:

- delete is soft-delete style in practice: `crud.delete_user` sets `is_active = False`
- settlement mode is stored directly on the user and drives balance display logic

### `/friends`

File: [`backend/routers/friends.py`](../backend/routers/friends.py)

Main endpoints:

- `GET /friends/search`
- `GET /friends/my`
- `GET /friends/requests/sent`
- `GET /friends/requests/received`
- `POST /friends/request/{friend_id}`
- `POST /friends/request/{request_id}/accept`
- `POST /friends/request/{request_id}/reject`
- `DELETE /friends/remove/{friendship_id}`

Important behavior:

- friendships are stored once with a status
- sending or accepting friend requests triggers notifications
- accepted friendships are used later by global balance logic

### `/groups`

Files:

- [`backend/routers/groups.py`](../backend/routers/groups.py)
- [`backend/routers/memberships.py`](../backend/routers/memberships.py)

Group endpoints:

- create/list/get/update/delete groups
- leave group
- check whether user can leave
- get/send group messages

Membership endpoints under the same `/groups` prefix:

- `GET /groups/{group_id}/members`
- `POST /groups/{group_id}/add_members`
- `PUT /groups/{group_id}/members/{member_id}`
- `DELETE /groups/{group_id}/members/{member_id}`

Important behavior:

- group creation auto-adds the owner as an admin membership
- membership mutations require group admin status
- group chat messages are stored in `group_messages` and broadcast over the notification WebSocket

### `/expenses`

File: [`backend/routers/expenses.py`](../backend/routers/expenses.py)

Main endpoints:

- `POST /expenses`
- `GET /expenses/all`
- `GET /expenses/{group_id}`
- `GET /expenses/exp/{expense_id}`
- `PUT /expenses/{expense_id}`
- `DELETE /expenses/{expense_id}`
- `GET /expenses/{group_id}/download-template`
- `POST /expenses/{group_id}/upload`
- `GET /expenses/{group_id}/download`

Important behavior:

- adding an expense creates splits and can deduct from a wallet
- expenses can optionally be marked as jar-funded for Econome integration
- expense creator notifications are targeted to payer/split participants
- edit/delete is limited to payer or group owner
- bulk upload uses Excel parsing through `pandas` and `openpyxl`

### `/settle`

File: [`backend/routers/settle.py`](../backend/routers/settle.py)

This router handles two related systems:

- group settlements
- global settlements across all shared groups between friends

Global endpoints:

- `GET /settle/global/balances`
- `GET /settle/global/settlements`
- `POST /settle/global/record`
- `GET /settle/global/history`
- `POST /settle/global/{id}/accept`
- `POST /settle/global/{id}/reject`
- `POST /settle/global/{id}/resend`
- `GET /settle/global/pending`

Group endpoints:

- `GET /settle/{group_id}/balances`
- `GET /settle/{group_id}/settlements`
- `GET /settle/{group_id}/history`
- `POST /settle/{group_id}/record`
- `POST /settle/{settlement_id}/accept`
- `POST /settle/{settlement_id}/reject`
- `POST /settle/{settlement_id}/resend`
- `GET /settle/pending`

Important behavior:

- suggested settlements are generated from computed balances via `minimize_cash_flow`
- recorded settlements start as `pending`
- only recipients can accept or reject
- balances can be returned as original, adjusted, or hybrid depending on user preference

### `/activity`

File: [`backend/routers/activity.py`](../backend/routers/activity.py)

Main endpoint:

- `GET /activity`

Important behavior:

- returns recent activity logs
- filters them so users only see logs tied to themselves or to relevant groups/expenses

### `/stats`

File: [`backend/routers/stats.py`](../backend/routers/stats.py)

Main endpoints:

- `GET /stats/groups`
- `GET /stats/user`
- `GET /stats/user/groups`
- `GET /stats/user/daily`
- `GET /stats/user/categories`

Purpose:

- powers dashboard/overview/statistics pages with aggregated expense data

### `/incomes`

File: [`backend/routers/incomes.py`](../backend/routers/incomes.py)

Main endpoints:

- `POST /incomes`
- `GET /incomes`
- `GET /incomes/summary`
- `PUT /incomes/{income_id}`
- `DELETE /incomes/{income_id}`

Important behavior:

- create/update/delete keeps wallet balances in sync

### `/incometype`

File: [`backend/routers/income_types.py`](../backend/routers/income_types.py)

Main endpoints:

- create/list/update/delete income types

Important behavior:

- users can see both global types (`user_id is NULL`) and their own custom ones

### `/wallets`

File: [`backend/routers/wallets.py`](../backend/routers/wallets.py)

Main endpoints:

- create/list/update/delete wallets
- `POST /wallets/transfer`

Important behavior:

- wallet transfer validates ownership and balance
- transfers create `Transaction` rows

### `/transactions`

File: [`backend/routers/transactions.py`](../backend/routers/transactions.py)

Main endpoints:

- `GET /transactions`
- `GET /transactions/{transaction_id}`

Important behavior:

- this router is read-only
- it normalizes possibly invalid/empty transaction types to `transfer` when serializing old data

### `/debts-loans`

File: [`backend/routers/debts_loans.py`](../backend/routers/debts_loans.py)

Main endpoints:

- debt CRUD and repayment history
- loan CRUD and repayment history
- `GET /debts-loans/summary`

Important behavior:

- creating a debt can add money into a wallet
- creating a loan can remove money from a wallet
- repayment endpoints incrementally adjust balances and status

### `/econome`

File: [`backend/routers/econome.py`](../backend/routers/econome.py)

Main endpoints:

- `GET /econome/config`
- strategy CRUD
- `GET /econome/ledger`
- `GET /econome/balances`
- `POST /econome/distribute`
- `POST /econome/spend`
- income-source CRUD
- `GET /econome/monthly-summary`
- `GET /econome/jar/{jar_type}`
- transaction update/delete
- `POST /econome/transfer`

Important behavior:

- strategy percentages must sum to about 100 percent
- `distribute` writes one `IncomeLog` plus many positive `JarTransaction` rows
- jar transfers are represented as paired negative/positive transactions

### `/Notifications`

File: [`backend/routers/notifications.py`](../backend/routers/notifications.py)

Main endpoints:

- `GET /Notifications/`
- `PUT /Notifications/{notification_id}/read`
- `POST /Notifications/read-all`
- `DELETE /Notifications/clear`
- `WS /Notifications/ws/{user_id}`

Important behavior:

- notifications are always persisted
- live delivery uses an in-memory `active_connections` map
- WebSocket state is process-local, so this is simple and works best as a single backend instance

### `/admin`

File: [`backend/routers/admin.py`](../backend/routers/admin.py)

Main endpoints:

- `GET /admin/users`
- `POST /admin/users/{user_id}/role`
- `POST /admin/users/{user_id}/status`
- `GET /admin/roles`
- `POST /admin/roles`
- `GET /admin/reclamations`
- `POST /admin/reclamations/{rec_id}/status`

Important behavior:

- routes are guarded by permission checks, not just a boolean admin flag
- permissions include items like `view_users`, `manage_users`, `view_roles`, `manage_roles`, `view_reclamations`, `manage_reclamations`

## Where Most Logic Lives

If you need to trace behavior instead of just endpoints, focus on [`backend/crud.py`](../backend/crud.py). It contains:

- user creation and soft deletion
- group creation and membership rules
- expense creation/update/balance effects
- settlement math
- global adjustment math
- activity logging
- income and wallet update logic

## Backend Caveats Worth Remembering

- `crud.py` is the true business-logic center, so router-level reading alone is not enough.
- Several domain rules are implemented in side effects, especially logging, wallet updates, and notifications.
- Some legacy compatibility handling exists, especially around transaction schema and settlement evolution.
- The codebase mixes shared-expense concerns and personal-finance concerns in one API process, which is practical but increases coupling.
