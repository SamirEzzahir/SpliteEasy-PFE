"""Run migration to make to_wallet_id nullable"""
import asyncio
import sys
import os

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Change to project root
os.chdir(project_root)

from backend.migrations import migrate_transactions_to_wallet_id

async def main():
    print("🔄 Running transaction migration...")
    try:
        await migrate_transactions_to_wallet_id()
        print("✅ Migration completed!")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())

