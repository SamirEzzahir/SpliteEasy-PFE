# SplitEasy

SplitEasy is a full-stack expense-sharing and personal-finance app built from three main pieces:

- a FastAPI backend in [`backend/`](backend)
- a multi-page vanilla HTML/CSS/JS frontend in [`frontend/`](frontend)
- a Capacitor Android wrapper in [`android/`](android)

The app is broader than a simple split-bills clone. It includes:

- shared groups, memberships, expenses, splits, and settlements
- global friend-to-friend settlements across groups
- friends, notifications, and lightweight group chat
- income, wallet, transaction, debt, and loan tracking
- an "Econome" money-jar budgeting module
- an admin panel with roles and permission checks

## Repo Map

- [`backend/`](backend): FastAPI app, SQLAlchemy models, routers, auth, migrations, and core CRUD logic
- [`frontend/`](frontend): static HTML pages plus shared/global JavaScript
- [`android/`](android): Capacitor Android shell that points at `frontend/` as `webDir`
- [`requirements.txt`](requirements.txt): Python dependencies
- [`package.json`](package.json): Capacitor dependencies only
- [`start_backend.bat`](start_backend.bat): local Windows helper to run the API
- [`docs/`](docs): project documentation added from a full code-reading pass

## Documentation

- [Architecture Overview](docs/architecture.md)
- [Backend Guide](docs/backend-guide.md)
- [Frontend Guide](docs/frontend-guide.md)
- [Setup and Operations](docs/setup.md)

## Quick Start

### 1. Backend

Create or activate a virtual environment, then install Python dependencies:

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Run the API:

```powershell
python -m uvicorn backend.main:app --reload
```

Or use:

```powershell
start_backend.bat
```

### 2. Frontend

The frontend is static and does not have a build step.

Before opening it, check the API base URL in [`frontend/js/config.js`](frontend/js/config.js). It is currently hardcoded to a LAN IP, so most machines will need to update it.

Serve the `frontend/` folder with any static server, then open:

- `frontend/index.html` for the landing page
- `frontend/login.html` or `frontend/signup.html` to enter the app

### 3. Android

Capacitor is already configured in [`capacitor.config.json`](capacitor.config.json) with:

- `appId`: `com.spliteasy.app`
- `appName`: `SplitEasy`
- `webDir`: `frontend`

After the frontend files are in place, typical Capacitor flows are:

```powershell
npx cap sync android
npx cap open android
```

## Current Architecture Snapshot

- Authentication is JWT-based. Tokens are created in [`backend/auth.py`](backend/auth.py) and consumed by router dependencies.
- Database access is async SQLAlchemy, initialized in [`backend/db.py`](backend/db.py).
- Tables are created on startup and custom migrations are attempted from [`backend/migrations.py`](backend/migrations.py).
- Real-time notifications use WebSockets at `/Notifications/ws/{user_id}`.
- The frontend relies on global browser scripts, shared `localStorage`, and page-specific JavaScript files rather than a bundler/framework.

## Important Notes

- The backend computes environment-specific CORS allowlists, but [`backend/main.py`](backend/main.py) currently registers `allow_origins=["*"]`.
- The default database URL in [`backend/config.py`](backend/config.py) is SQLite, but several migration helpers are clearly written against MySQL `information_schema`.
- Currency handling is mixed across the codebase. Some backend defaults are `USD`, while many frontend screens display `MAD`, and bulk expense import hardcodes `MAD`.
- There is no automated test suite or root-level dev orchestration script in the repository right now.

## Historical Notes

The repository already contained a few analysis markdown files such as:

- [`BEST_RECOMMENDATION.md`](BEST_RECOMMENDATION.md)
- [`GLOBAL_SETTLEMENT_ANALYSIS.md`](GLOBAL_SETTLEMENT_ANALYSIS.md)
- [`INCOME_SYSTEM_ANALYSIS.md`](INCOME_SYSTEM_ANALYSIS.md)
- [`SETTLEMENT_APPROVAL_SYSTEM.md`](SETTLEMENT_APPROVAL_SYSTEM.md)

Those read more like feature/design notes. The new `docs/` folder is intended to be the maintainable source of truth for how the current code is structured.
