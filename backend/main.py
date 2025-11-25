from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routers import dashboard, econome, income_types, incomes, wallets, transactions
from backend.db import engine, Base, get_session
from backend.routers import memberships, notifications

# Import models to ensure they are registered with Base.metadata
from backend import models  # This ensures all models are registered

# Routers
from backend.routers import auth, users, groups, expenses, friends, stats, settle, activity, debts_loans

app = FastAPI(title="SplitApp API", version="1.0")

 

import os
# Get origins from environment variable (comma-separated)
origins_string = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [origin.strip() for origin in origins_string.split(",")] if origins_string else []


# Development origins
dev_origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:5500", 
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://pcrox.ddns.net:5500",  # Add your production frontend
    "https://pcrox.ddns.net:5500", # Add HTTPS version
    "http://pcrox.ddns.net:5555",
    "https://pcrox.ddns.net:5555",
]

# Production origins  
prod_origins = [
    "http://192.168.1.3:5500",
    "http://pcrox.ddns.net:5555",
    "https://pcrox.ddns.net:5555",
    "http://pcrox.ddns.net:5500",
    "https://pcrox.ddns.net:5500",
]

# Choose based on environment
if os.getenv("ENVIRONMENT") == "production":
    allowed_origins = prod_origins
else:
    allowed_origins = dev_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# Health check
@app.get("/")
async def health():
    return {"status": "ok"}

@app.on_event("startup")
async def on_startup():
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

 