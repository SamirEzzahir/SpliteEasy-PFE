from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import engine, Base, get_session
from .routers import memberships, notifications

# Routers
from .routers import auth, users, groups, expenses, friends, stats, settle, activity

app = FastAPI(title="SplitApp API", version="1.0")

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # In prod: restrict this!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/")
async def health():
    return {"status": "ok"}


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("Tables:", list(Base.metadata.tables.keys()))

@app.on_event("shutdown")
async def shutdown():
    await engine.dispose()

@app.get("/")
async def health():
    return {"status": "ok"}


# Routers
app.include_router(auth.router, tags=["Auth"])
app.include_router(users.router,  tags=["Users"])
app.include_router(friends.router,  tags=["Friends"])
app.include_router(groups.router,tags=["Groups"])
app.include_router(expenses.router, tags=["Expenses"])
app.include_router(stats.router,  tags=["Stats"])
app.include_router(notifications.router, tags=["Notifications"])   # ✅ No prefix, WebSocket works directly
app.include_router(settle.router, tags=["Settle"])
app.include_router(memberships.router, tags=["Memberships"])
app.include_router(activity.router, tags=["Activity"])

 