"""Force migration to make to_wallet_id nullable"""
import asyncio
from backend.db import engine
from sqlalchemy import text

async def force_migrate():
    async with engine.begin() as conn:
        print("Force making to_wallet_id nullable...")
        try:
            # Force ALTER TABLE regardless of current state
            alter_query = text("""
                ALTER TABLE transactions 
                MODIFY COLUMN to_wallet_id INT NULL
            """)
            await conn.execute(alter_query)
            print("Successfully made to_wallet_id nullable!")
            
            # Verify
            check_query = text("""
                SELECT IS_NULLABLE 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'transactions' 
                AND COLUMN_NAME = 'to_wallet_id'
            """)
            result = await conn.execute(check_query)
            row = result.fetchone()
            if row:
                print(f"Verification: IS_NULLABLE = {row[0]}")
            
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
            raise

if __name__ == "__main__":
    asyncio.run(force_migrate())

