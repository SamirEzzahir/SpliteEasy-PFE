import sys

# Startup/migration logs contain emoji (🔄/✅). On a Windows console the default
# cp1252 codec raises UnicodeEncodeError on those, which would abort the whole
# migration chain. Force UTF-8 so logging can never break migrations.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routers import dashboard, econome, income_types, incomes, wallets, transactions
from backend.db import engine, Base, get_session
from backend.core.db import ensure_database_exists
from backend.routers import memberships, notifications

# Import models to ensure they are registered with Base.metadata
from backend import models  # This ensures all models are registered

# Routers
from backend.routers import auth, users, groups, expenses, friends, stats, settle, activity, debts_loans, admin, support
from backend.routers import settings as settings_router
from backend.routers import reports as reports_router
from backend.routers import announcements as announcements_router

# Platform settings (cache + maintenance flag) and JWT helpers for the guard.
from fastapi import Request
from fastapi.responses import JSONResponse
from jose import jwt
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from backend.core import settings_store
from backend.core.config import settings as app_config
from backend.db import async_session

app = FastAPI(title="SplitApp API", version="1.0")

 

import os
# Get origins from environment variable (comma-separated)
origins_string = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [origin.strip() for origin in origins_string.split(",")] if origins_string else []


# Development origins
dev_origins = [
    "http://41.142.215.163:8000",
    "http://localhost",
    "http://localhost:3000",
    "http://192.168.1.3",
    "http://192.168.1.3:5173",
    "http://192.168.1.3:5500",
    "http://192.168.1.3:5555",
    "http://192.168.1.3:8800",
    "http://pcrox.ddns.net",
    "http://localhost:5500", 
    "http://pcrox.ddns.net:5500",
    "http://localhost:5500",
    "http://pcrox.ddns.net:5500",  # Add your production frontend
    "https://pcrox.ddns.net:5500", # Add HTTPS version
    "http://pcrox.ddns.net:5555",
    "https://pcrox.ddns.net:5555",
    "https://192.168.1.3:8081",
    
]

# Production origins  
prod_origins = [
    "http://41.142.215.163:8000",
    "http://192.168.1.3",
    "http://192.168.1.3:5173",
    "http://192.168.1.3:5500",
    "http://192.168.1.3:5555",
    "http://192.168.1.3:8800",
    "http://pcrox.ddns.net:5555",
    "https://pcrox.ddns.net:5555",
    "http://pcrox.ddns.net:5500",
    "https://pcrox.ddns.net:5500",
    "https://192.168.1.3:8081",
]

# Choose based on environment
if os.getenv("ENVIRONMENT") == "production":
    allowed_origins = prod_origins
else:
    allowed_origins = dev_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Maintenance mode -------------------------------------------------------
# Paths reachable even during maintenance: the admin area, auth, public settings
# and the API docs. Everyone else gets a 503 unless they're an admin.
_MAINTENANCE_ALLOW = ("/admin", "/auth", "/settings", "/docs", "/openapi.json", "/redoc")


async def _request_is_admin(request: Request) -> bool:
    """True if the request carries a valid token for a user with any admin role."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return False
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, app_config.JWT_SECRET, algorithms=[app_config.JWT_ALG])
        username = payload.get("username")
    except Exception:
        return False
    if not username:
        return False
    try:
        async with async_session() as session:
            user = (await session.execute(
                select(models.User)
                .where(models.User.username == username)
                .options(selectinload(models.User.role))
            )).scalar_one_or_none()
    except Exception:
        return False
    if not user or not user.role or not user.role.permissions:
        return False
    try:
        import json as _json
        perms = _json.loads(user.role.permissions)
    except Exception:
        perms = []
    return bool(perms)


@app.middleware("http")
async def maintenance_guard(request: Request, call_next):
    if settings_store.get_bool("maintenance_mode") and request.method != "OPTIONS":
        path = request.url.path
        allowed = path == "/" or any(path.startswith(p) for p in _MAINTENANCE_ALLOW)
        if not allowed and not (
            settings_store.get_bool("maintenance_allow_admins") and await _request_is_admin(request)
        ):
            return JSONResponse(
                status_code=503,
                content={"detail": settings_store.get("maintenance_message"), "maintenance": True},
            )
    return await call_next(request)


# Health check
@app.get("/")
async def health():
    return {"status": "ok"}

@app.on_event("startup")
async def on_startup():
    # Create the database itself if it doesn't exist yet (fresh Postgres server).
    await ensure_database_exists()
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database initialized.")
    
    # Run migrations
    try:
        from backend.migrations import run_migrations
        await run_migrations()
    except Exception as e:
        print(f"Migration warning: {e}")
        print("   You may need to run migrations manually.")

    # Load platform settings into the in-process cache (after migrations so the
    # app_settings table exists).
    await settings_store.load_settings()
    print("Platform settings loaded.")

    # Optional: populate a rich demo dataset (login: demo / demo). Off by default
    # so production stays clean; enable with SEED_DEMO=1. Idempotent — no-op once
    # the demo user exists (see backend/seed_demo.py).
    if os.getenv("SEED_DEMO", "").lower() in ("1", "true", "yes"):
        try:
            from backend.seed_demo import seed_demo
            await seed_demo(force=os.getenv("SEED_DEMO_FORCE", "").lower() in ("1", "true", "yes"))
        except Exception as e:
            print(f"Demo seed warning: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    # Properly dispose engine connections
    await engine.dispose()
    print("Database connection closed.")





# Routers
app.include_router(auth.router, tags=["Auth"])
app.include_router(users.router,  tags=["Users"])
app.include_router(friends.router,  tags=["Friends"])
app.include_router(groups.router,tags=["Groups"])
app.include_router(expenses.router, tags=["Expenses"])
app.include_router(stats.router,  tags=["Stats"])
app.include_router(notifications.router, tags=["Notifications"])
app.include_router(settle.router, tags=["Settle"])
app.include_router(memberships.router, tags=["Memberships"])
app.include_router(activity.router, tags=["Activity"])
app.include_router(incomes.router, tags=["Incomes"])
app.include_router(transactions.router, tags=["Transactions"])
app.include_router(dashboard.router, tags=["Dashboard"])
app.include_router(income_types.router, tags=["incomeType"])
app.include_router(wallets.router, tags=["Wallets"])
app.include_router(debts_loans.router, tags=["Debts & Loans"])
app.include_router(econome.router, tags=["Econome"])
app.include_router(admin.router, tags=["Admin"])
app.include_router(support.router, tags=["Support"])
app.include_router(settings_router.router, tags=["Settings"])
app.include_router(reports_router.router, tags=["Moderation"])
app.include_router(announcements_router.router, tags=["Announcements"])

 
