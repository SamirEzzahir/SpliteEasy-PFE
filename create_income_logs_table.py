import asyncio
from backend.db import engine, Base
from backend.models import IncomeLog

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("IncomeLog table created successfully.")

if __name__ == "__main__":
    asyncio.run(create_tables())
