import asyncio
from backend.db import engine
from backend.models import Base

async def create_tables():
    async with engine.begin() as conn:
        print("Creating jar_transactions table...")
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created successfully.")

if __name__ == "__main__":
    asyncio.run(create_tables())
