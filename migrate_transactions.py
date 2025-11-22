"""Quick migration script to make to_wallet_id nullable"""
import asyncio
from backend.db import engine
from sqlalchemy import text

async def migrate():
    async with engine.begin() as conn:
        print("Making to_wallet_id nullable in transactions table...")
        try:
            # Check current state
            check_query = text("""
                SELECT IS_NULLABLE 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'transactions' 
                AND COLUMN_NAME = 'to_wallet_id'
            """)
            result = await conn.execute(check_query)
            row = result.fetchone()
            
            if row and row[0] == 'YES':
                print("Column is already nullable!")
                return
            
            # Make it nullable
            alter_query = text("""
                ALTER TABLE transactions 
                MODIFY COLUMN to_wallet_id INT NULL
            """)
            await conn.execute(alter_query)
            print("Successfully made to_wallet_id nullable!")
            
        except Exception as e:
            print(f"Error: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(migrate())

