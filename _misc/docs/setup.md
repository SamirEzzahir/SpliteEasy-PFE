# Setup and Operations

This document focuses on getting SplitEasy running locally and points out the operational assumptions baked into the repository.

## Prerequisites

### Backend

- Python 3.11+ is a safe target because the backend Dockerfile uses `python:3.11-slim`
- a virtual environment is recommended

### Frontend

- no Node-based frontend build is required
- you only need a static file server or a browser for the HTML files

### Mobile

- Node.js is needed for Capacitor commands
- Android Studio is needed if you want to build/run the Android shell

## Backend Setup

### Install dependencies

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Environment variables

[`backend/config.py`](../backend/config.py) loads `backend/.env` and recognizes at least:

- `DATABASE_URL`
- `JWT_SECRET`
- `ENVIRONMENT`
- `ALLOWED_ORIGINS`

Observed defaults:

- `DATABASE_URL`: `sqlite+aiosqlite:///./splitapp.db`
- `JWT_SECRET`: fallback value in code if not set
- `ACCESS_TOKEN_EXPIRE_MINUTES`: 7 days

### Run the API

```powershell
python -m uvicorn backend.main:app --reload
```

Or:

```powershell
start_backend.bat
```

Default backend behavior:

- starts on port `8000` when run through the Dockerfile
- creates ORM tables at startup
- then tries to run custom migrations

### Backend startup caveat

The codebase defaults to SQLite, but the migration helpers in [`backend/migrations.py`](../backend/migrations.py) use MySQL-specific metadata checks and raw SQL. In practice that means:

- SQLite development may still work because startup wraps migration execution in a warning path
- MySQL-like databases appear to have been the main migration target

## Frontend Setup

### Update API base URL

Before opening the app, check [`frontend/js/config.js`](../frontend/js/config.js). It currently points at a specific LAN IP address.

You will usually want to change:

```js
const API_URL = "http://<your-host>:<your-port>";
```

### Serve the frontend

The frontend is static. Any simple static host works.

Examples:

- VS Code Live Server
- a local Nginx container
- `python -m http.server` from inside `frontend/`

Then open:

- `index.html`
- `login.html`
- `signup.html`

### Frontend operational notes

- the app relies on `localStorage` for auth/session state
- many pages redirect to `login.html` if auth is missing
- notifications expect a working WebSocket path based on `API_URL`

## Docker

The repository contains simple image definitions but no root `docker-compose.yml`.

### Backend image

[`backend/Dockerfile`](../backend/Dockerfile):

- copies `requirements.txt`
- installs Python dependencies
- copies `backend/`
- runs `uvicorn backend.main:app --host 0.0.0.0 --port 8000`

### Frontend image

[`frontend/Dockerfile`](../frontend/Dockerfile):

- uses `nginx:alpine`
- copies the frontend into `/usr/share/nginx/html`
- serves static files on port `80`

These Dockerfiles are enough to containerize the two main app layers separately.

## Android / Capacitor

[`capacitor.config.json`](../capacitor.config.json) currently defines:

- `appId`: `com.spliteasy.app`
- `appName`: `SplitEasy`
- `webDir`: `frontend`

Typical workflow:

```powershell
npm install
npx cap sync android
npx cap open android
```

Important note:

- `package.json` is mainly for Capacitor and does not manage a frontend build process
- the Android wrapper expects the static files in `frontend/` directly

## Recommended Local Dev Flow

If you are just developing the app locally:

1. start the FastAPI backend
2. update `frontend/js/config.js` to point at your backend
3. serve `frontend/`
4. register a user and log in
5. optionally sync/open Android if you need the mobile shell

## Troubleshooting

### Login succeeds but app pages behave strangely

Possible cause:

- the frontend uses more than one `localStorage` key for user state

Where to inspect:

- [`frontend/js/config.js`](../frontend/js/config.js)
- [`frontend/js/auth.js`](../frontend/js/auth.js)
- [`frontend/js/chat.js`](../frontend/js/chat.js)

### Notifications are not live

Check:

- backend is reachable on the same host used by `API_URL`
- the client can open `/Notifications/ws/{user_id}`
- the user is authenticated and `notifications.js` initialized

### Group balances look different from expectations

Check:

- the user's `global_settlement_mode`
- whether accepted global settlements already exist
- whether you are reading the group balances page or the global settlement page

### Currency labels look inconsistent

This is a current implementation detail:

- backend defaults often use `USD`
- many UI screens display `MAD`
- expense import code writes `MAD`

If you need fully reliable currency behavior, normalize it first before relying on display output.

## What Is Missing Today

From a maintainability/operations point of view, the repository currently does not include:

- automated tests
- a central env example file
- a root docker-compose setup
- a single documented production deployment path

The project still runs, but those would be strong next additions if you want easier onboarding and safer changes.
