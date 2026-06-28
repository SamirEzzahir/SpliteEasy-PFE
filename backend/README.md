# SplitEasy — Backend

FastAPI backend for SplitEasy, an expense-sharing app. It also exposes additional
personal-finance modules (wallets, incomes, debts/loans, Économé jars) on the API.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 16 (via `asyncpg`) |
| Auth | JWT via `python-jose` + `passlib` |
| Validation | Pydantic v2 |
| Server | Uvicorn |
| Excel I/O | openpyxl / pandas / xlrd |
| Real-time | `websockets` (group chat, notifications) |
| Migrations | Custom async migration runner (Postgres DDL) |

> A SQLite fallback driver (`aiosqlite`) is installed and is the default in
> `core/config.py`, but the project runs on **PostgreSQL** — Docker, migrations, and
> the `01-init.sql` extensions all target Postgres.

---

## Project Structure

The backend has been refactored from a flat layout into packages. The single-file
modules at the backend root (`auth.py`, `config.py`, `db.py`, `crud.py`,
`dependencies.py`, `migrations.py`, `debt.py`, `utils.py`) are now **thin
compatibility shims** that simply re-export from the packages below.

```
backend/
├── main.py               # App entry point — CORS, router registration, startup/shutdown
│
├── core/                 # Cross-cutting infrastructure
│   ├── config.py         # Settings — DATABASE_URL, JWT config, JAR_CONFIG
│   ├── db.py             # Async engine, Base, session factory
│   ├── auth.py           # JWT creation/validation, OAuth2 scheme, get_current_user
│   ├── security.py       # Password hashing/verification
│   ├── dependencies.py   # RBAC permission checker (require_permission)
│   └── migrations.py     # Postgres migration functions run on startup
│
├── models/               # SQLAlchemy models (one module per domain)
│   ├── base.py           # Declarative Base
│   ├── user.py           # User, Role, Reclamation + enums
│   ├── group.py          # Group, Membership, GroupMessage
│   ├── expense.py        # Expense, Split
│   ├── friend.py         # Friend + status enum
│   ├── settlement.py     # Settlement, GlobalSettlement
│   ├── finance.py        # Wallet, Transaction, Income, IncomeType, IncomeSource, IncomeLog
│   ├── debt.py           # Debt, Loan, DebtRepayment, LoanRepayment
│   ├── econome.py        # JarStrategy, JarTransaction
│   ├── activity.py       # ActivityLog
│   └── notification.py   # Notification
│
├── schemas/              # Pydantic request/response schemas (mirrors models/)
├── repositories/         # Data-access queries + balance computation
│   ├── user.py, group.py, expense.py, finance.py, settlement.py, activity.py
├── services/             # Domain services
│   └── debt.py           # Cash-flow minimization algorithm for settlements
│
├── routers/
│   ├── auth.py           # POST /register, /login — GET /me
│   ├── users.py          # User profile, password change, settlement mode
│   ├── groups.py         # Group CRUD + WebSocket group chat
│   ├── memberships.py    # Add/remove/update group members
│   ├── expenses.py       # Expense CRUD, Excel import/export, pagination
│   ├── friends.py        # Friend requests — send, accept, reject, remove
│   ├── settle.py         # Group & global settlements, balance calculations
│   ├── dashboard.py      # Summary — total income, expenses, net balance
│   ├── incomes.py        # Income CRUD with wallet balance sync
│   ├── income_types.py   # Global and per-user income categories
│   ├── wallets.py        # Wallet CRUD, transfers between wallets
│   ├── transactions.py   # Wallet transaction history
│   ├── debts_loans.py    # Debt/loan tracking with repayment history
│   ├── stats.py          # Spending statistics by group, user, category, day
│   ├── notifications.py  # WebSocket real-time + REST notifications
│   ├── activity.py       # User activity log
│   ├── econome.py        # Money-jar budgeting system (Économé)
│   └── admin.py          # Admin — user management, roles, support tickets
│
├── requirements.txt
├── Dockerfile
└── .env
```

---

## Database Models

### Users & Auth
| Model | Description |
|---|---|
| `User` | Core user — username, email, hashed password, profile, gender, role |
| `Role` | RBAC role with a JSON string of permission keys |
| `Reclamation` | Support ticket submitted by a user |

### Groups & Expenses
| Model | Description |
|---|---|
| `Group` | Expense group — title, currency, type, owner |
| `Membership` | User ↔ Group join table with `is_admin` flag |
| `Expense` | An expense inside a group — payer, amount, category, split type, optional wallet |
| `Split` | One user's share of an expense |
| `GroupMessage` | A chat message inside a group |

### Friends & Settlements
| Model | Description |
|---|---|
| `Friend` | Friend request between two users (`pending / accepted / rejected`) |
| `Settlement` | A payment record inside a group (`pending / accepted / rejected`) |
| `GlobalSettlement` | A cross-group payment between two friends |

### Personal Finance
| Model | Description |
|---|---|
| `Wallet` | A user's money account — cash, bank, credit card, other |
| `Transaction` | A transfer between wallets, a debt, or a credit |
| `Income` | An income entry linked to a wallet and an income type |
| `IncomeType` | Category label for income (Salary, Freelance, etc.) — global or per-user |
| `IncomeSource` | Named income source for the Économé ledger |
| `IncomeLog` | One income event in the Économé system with jar distribution |
| `Debt` | Money the user owes someone, with repayment tracking |
| `Loan` | Money someone owes the user, with repayment tracking |
| `DebtRepayment` | A partial or full repayment of a Debt |
| `LoanRepayment` | A partial or full repayment of a Loan |
| `JarStrategy` | A named allocation strategy — percentages across 6 jars |
| `JarTransaction` | A credit or debit to one of the 6 money jars |

### System
| Model | Description |
|---|---|
| `ActivityLog` | Audit trail of user actions with target type and ID |
| `Notification` | In-app notification — typed, linked, read/unread |

---

## API Endpoints

### Auth — `/`
| Method | Path | Description |
|---|---|---|
| POST | `/register` | Create account |
| POST | `/login` | Get JWT token |
| GET | `/me` | Current user (with role) |

### Users — `/users`
| Method | Path | Description |
|---|---|---|
| GET | `/users/` | List all users |
| GET | `/users/{id}` | Get user by ID |
| PUT | `/users/{id}` | Update profile |
| DELETE | `/users/{id}` | Deactivate user |
| POST | `/users/{id}/change-password` | Change password |
| PUT | `/users/{id}/settlement-mode` | Update global settlement display mode |

### Groups — `/groups`
| Method | Path | Description |
|---|---|---|
| POST | `/groups/` | Create group |
| GET | `/groups/` | List groups for current user |
| GET | `/groups/{id}` | Get group details |
| PUT | `/groups/{id}` | Update group |
| DELETE | `/groups/{id}` | Delete group |
| POST | `/groups/{id}/leave` | Leave a group |
| GET | `/groups/{id}/messages` | Get group chat messages |
| WebSocket | `/groups/{id}/ws/{user_id}` | Real-time group chat |

### Memberships — `/memberships`
| Method | Path | Description |
|---|---|---|
| GET | `/memberships/{group_id}` | List members |
| POST | `/memberships/` | Add member |
| PUT | `/memberships/{id}` | Toggle admin status |
| DELETE | `/memberships/{group_id}/{user_id}` | Remove member |

### Expenses — `/expenses`
| Method | Path | Description |
|---|---|---|
| POST | `/expenses/` | Add expense |
| GET | `/expenses/group/{group_id}` | List expenses (paginated) |
| GET | `/expenses/{id}` | Get expense |
| PUT | `/expenses/{id}` | Update expense |
| DELETE | `/expenses/{id}` | Delete expense |
| POST | `/expenses/import/excel` | Bulk import from Excel |
| GET | `/expenses/export/excel` | Export to Excel |

### Friends — `/friends`
| Method | Path | Description |
|---|---|---|
| GET | `/friends/` | List accepted friends |
| GET | `/friends/search` | Search users by username |
| POST | `/friends/request` | Send friend request |
| POST | `/friends/accept/{id}` | Accept friend request |
| POST | `/friends/reject/{id}` | Reject friend request |
| DELETE | `/friends/{id}` | Remove friend |
| GET | `/friends/requests/pending` | Pending incoming requests |

### Settlements — `/settle`
| Method | Path | Description |
|---|---|---|
| GET | `/settle/{group_id}/balances` | Net balances per member |
| GET | `/settle/{group_id}/suggested` | Suggested payments (minimized) |
| POST | `/settle/{group_id}/record` | Record a settlement payment |
| POST | `/settle/{group_id}/accept/{id}` | Accept a settlement |
| POST | `/settle/{group_id}/reject/{id}` | Reject a settlement |
| GET | `/settle/{group_id}/history` | Settlement history |
| GET | `/settle/global/balances` | Cross-group balances with all friends |
| POST | `/settle/global/record` | Record a global settlement |
| POST | `/settle/global/accept/{id}` | Accept a global settlement |
| POST | `/settle/global/reject/{id}` | Reject a global settlement |
| GET | `/settle/global/history` | Global settlement history |

### Wallets — `/wallets`
| Method | Path | Description |
|---|---|---|
| POST | `/wallets/` | Create wallet |
| GET | `/wallets/` | List user wallets |
| GET | `/wallets/{id}` | Get wallet |
| PUT | `/wallets/{id}` | Update wallet |
| DELETE | `/wallets/{id}` | Delete wallet |
| POST | `/wallets/transfer` | Transfer between wallets |

### Incomes — `/incomes`
| Method | Path | Description |
|---|---|---|
| POST | `/incomes/` | Add income (credits wallet) |
| GET | `/incomes/` | List incomes |
| GET | `/incomes/{id}` | Get income |
| PUT | `/incomes/{id}` | Update income |
| DELETE | `/incomes/{id}` | Delete income (debits wallet) |
| GET | `/incomes/summary/balance` | Total income/expense/net per wallet |

### Income Types — `/income-types`
| Method | Path | Description |
|---|---|---|
| POST | `/income-types/` | Create custom income type |
| GET | `/income-types/` | List global + user types |
| PUT | `/income-types/{id}` | Update type |
| DELETE | `/income-types/{id}` | Delete type |

### Transactions — `/transactions`
| Method | Path | Description |
|---|---|---|
| GET | `/transactions/` | List all wallet transactions |

### Debts & Loans — `/debts-loans`
| Method | Path | Description |
|---|---|---|
| POST | `/debts-loans/debts/` | Create a debt (money you owe) |
| GET | `/debts-loans/debts/` | List debts |
| PUT | `/debts-loans/debts/{id}` | Update debt |
| DELETE | `/debts-loans/debts/{id}` | Delete debt |
| POST | `/debts-loans/debts/{id}/repay` | Record a debt repayment |
| POST | `/debts-loans/loans/` | Create a loan (money owed to you) |
| GET | `/debts-loans/loans/` | List loans |
| PUT | `/debts-loans/loans/{id}` | Update loan |
| DELETE | `/debts-loans/loans/{id}` | Delete loan |
| POST | `/debts-loans/loans/{id}/repay` | Record a loan repayment |
| GET | `/debts-loans/summary` | Totals — owed, lent, overdue |

### Économé (Money Jars) — `/econome`
| Method | Path | Description |
|---|---|---|
| GET | `/econome/strategies` | List jar strategies |
| POST | `/econome/strategies` | Create strategy |
| PUT | `/econome/strategies/{id}` | Update strategy |
| DELETE | `/econome/strategies/{id}` | Delete strategy |
| POST | `/econome/distribute` | Distribute income across jars |
| POST | `/econome/spend` | Record a jar expense |
| GET | `/econome/balances` | Current balance per jar |
| GET | `/econome/ledger` | Full income + expense ledger |
| GET | `/econome/monthly-summary` | Monthly totals per jar |
| GET | `/econome/jar-history/{jar_type}` | History for one jar |
| POST | `/econome/transfer` | Move money between jars |
| GET | `/econome/income-sources` | List income sources |
| POST | `/econome/income-sources` | Create income source |
| DELETE | `/econome/income-sources/{id}` | Delete income source |
| GET | `/econome/income-logs` | Full income log |
| PUT | `/econome/income-logs/{id}` | Update income log |
| DELETE | `/econome/income-logs/{id}` | Delete income log |

### Dashboard — `/dashboard`
| Method | Path | Description |
|---|---|---|
| GET | `/dashboard/summary` | Total income, expenses, net balance, recent expenses |

### Stats — `/stats`
| Method | Path | Description |
|---|---|---|
| GET | `/stats/group/{group_id}` | Spending per member in group |
| GET | `/stats/user/{user_id}` | Spending per group for a user |
| GET | `/stats/daily` | Daily spending for current user |
| GET | `/stats/categories` | Spending by category |

### Notifications — `/Notifications`
| Method | Path | Description |
|---|---|---|
| GET | `/Notifications/` | List notifications |
| PUT | `/Notifications/{id}/read` | Mark as read |
| PUT | `/Notifications/read-all` | Mark all as read |
| DELETE | `/Notifications/{id}` | Delete notification |
| WebSocket | `/Notifications/ws/{user_id}` | Real-time notification stream |

### Activity — `/activity`
| Method | Path | Description |
|---|---|---|
| GET | `/activity/` | Last 50 activity log entries |

### Admin — `/admin`
| Method | Path | Description |
|---|---|---|
| GET | `/admin/users` | List all users |
| PUT | `/admin/users/{id}/role` | Assign role to user |
| DELETE | `/admin/users/{id}` | Hard delete user |
| POST | `/admin/roles` | Create role |
| GET | `/admin/roles` | List roles |
| PUT | `/admin/roles/{id}` | Update role |
| DELETE | `/admin/roles/{id}` | Delete role |
| GET | `/admin/reclamations` | List support tickets |
| PUT | `/admin/reclamations/{id}` | Update ticket status |

---

## Key Concepts

### Balance Calculation
Group balances are computed in memory from raw expense/split/settlement data:

```
net[user] = total_paid - total_owed + settlements_received - settlements_sent
```

Suggested payments use a **cash-flow minimization algorithm** (`debt.py`) — reduces the number of transactions needed to settle a group to the theoretical minimum.

### Global Settlement Modes
Each user can choose how cross-group settlements are displayed:

| Mode | Behavior |
|---|---|
| `separate` | Group balances are independent — global settlements not shown inside groups |
| `auto_adjust` | Global settlements automatically reduce group balances proportionally |
| `hybrid` | Shows both the original balance and the globally-adjusted balance |

### The 6-Jar System (Économé)
Income is distributed across 6 virtual jars based on a strategy (percentages must sum to 100 %):

| Jar | Code | Default % | Purpose |
|---|---|---|---|
| Necessities | `NEC` | 55 % | Rent, food, bills |
| Financial Freedom | `FFA` | 10 % | Investments |
| Education | `EDU` | 10 % | Learning |
| Long-Term Savings | `LTSS` | 10 % | Future goals |
| Play | `PLAY` | 10 % | Fun |
| Give | `GIVE` | 5 % | Charity |

### Settlement Approval Flow
```
User A records payment → status: pending
User B (recipient) reviews proof photo
    → accepts  → status: accepted
    → rejects  → status: rejected (with reason)
```
A notification is sent to the recipient on record and to the sender on accept/reject.

### RBAC
Roles store a JSON array of permission strings (e.g. `["manage_users", "view_logs"]`).
The `check_permission(permission)` dependency validates the current user's role before handler execution.

---

## Setup

### Requirements
- Python 3.11+
- PostgreSQL 16 (with the `pg_trgm` and `citext` extensions)

### Install

```bash
# From the project root (SplitEasy/)
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Linux / Mac

pip install -r backend/requirements.txt
```

### Environment Variables

Create or edit `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres123@localhost:5432/spliteasy_db
JWT_SECRET=your-secret-key
```

### Run

```bash
# From the project root (SplitEasy/)
python -m uvicorn backend.main:app --reload --port 8800
```

API is available at `http://localhost:8800`  
Interactive docs at `http://localhost:8800/docs`

### Docker

The backend is normally run via the root `docker-compose.yml` (Postgres + backend +
web). To build just this image:

```bash
# From inside backend/
docker build -t spliteasy-backend .
docker run -p 8800:8000 --env-file .env spliteasy-backend
```

---

## Notes

- All database operations are **async** — never use sync SQLAlchemy calls inside routers.
- Tables are created automatically on startup via `Base.metadata.create_all`. Custom column migrations run after that via `core/migrations.py`.
- `allow_origins=["*"]` is currently hardcoded in `main.py` — restrict this before deploying to production.
- The import structure requires running uvicorn from the **project root**, not from inside `backend/`, because routers use `from backend.xxx import ...`.
- Enum columns use `native_enum=False` (stored as VARCHAR). The migrations convert any
  leftover native Postgres enum types from the original MySQL → Postgres port.
