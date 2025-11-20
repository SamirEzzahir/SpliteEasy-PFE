"""
Migration script to add global_settlement_mode column to users table.
This allows users to choose how global settlements affect group balances.
"""
import asyncio
from sqlalchemy import text
from backend.db import engine


async def migrate_global_settlement_mode():
    """Add global_settlement_mode column to users table if it doesn't exist."""
    async with engine.begin() as conn:
        try:
            # Check if column exists (MySQL syntax)
            result = await conn.execute(text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'global_settlement_mode'
            """))
            count = result.scalar()
            
            if count == 0:
                print("🔄 Adding global_settlement_mode column to users table...")
                await conn.execute(text("""
                    ALTER TABLE users
                    ADD COLUMN global_settlement_mode VARCHAR(20) DEFAULT 'separate'
                """))
                print("✅ Column global_settlement_mode added successfully!")
            else:
                print("✅ Column global_settlement_mode already exists.")
                
        except Exception as e:
            print(f"⚠️ Error during migration: {e}")
            # Column might already exist, which is fine
            if "Duplicate column name" not in str(e):
                raise


if __name__ == "__main__":
    asyncio.run(migrate_global_settlement_mode())

