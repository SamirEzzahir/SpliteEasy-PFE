from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from typing import AsyncGenerator

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)

async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def ensure_database_exists() -> None:
    """Create the target Postgres database if it doesn't exist yet.

    ``engine`` points at a specific database (e.g. ``spliteasy_db``). On a fresh
    Postgres server that database may not exist, so connecting would fail. We
    connect to the built-in ``postgres`` maintenance database instead and issue
    ``CREATE DATABASE``. No-op for SQLite — its file is created automatically on
    first connect.
    """
    url = make_url(settings.DATABASE_URL)
    if url.get_backend_name() != "postgresql":
        return
    db_name = url.database
    if not db_name:
        return

    # Connect to the maintenance DB. AUTOCOMMIT because CREATE DATABASE cannot
    # run inside a transaction block.
    admin_engine = create_async_engine(
        url.set(database="postgres"), isolation_level="AUTOCOMMIT"
    )
    try:
        async with admin_engine.connect() as conn:
            exists = await conn.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": db_name},
            )
            if exists:
                return
            # db_name comes from our own config (not user input); quote it as an
            # identifier. Parameters can't be used for identifiers.
            await conn.execute(text(f'CREATE DATABASE "{db_name}"'))
            print(f"✅ Created database '{db_name}'.")
    except Exception as e:
        print(f"⚠️  Could not ensure database '{db_name}' exists: {e}")
    finally:
        await admin_engine.dispose()
