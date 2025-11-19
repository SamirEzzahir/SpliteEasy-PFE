"""
Migration script to add new columns to settlements table.
Run this once to update your database schema.

Usage:
    python -m backend.migrate_settlements
"""
import asyncio
import sys
from sqlalchemy import text
from backend.db import engine

async def migrate_settlements():
    """Add new columns to settlements table if they don't exist."""
    
    async with engine.begin() as conn:
        print("🔄 Starting migration...")
        
        # Check if columns exist and add them if they don't
        migrations = [
            ("status", "ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending'"),
            ("message", "VARCHAR(500) NULL"),
            ("proof_photo", "VARCHAR(255) NULL"),
            ("rejected_reason", "VARCHAR(500) NULL"),
            ("updated_at", "DATETIME NULL"),
        ]
        
        for column_name, column_def in migrations:
            try:
                # Check if column exists (MySQL syntax)
                check_query = text(f"""
                    SELECT COUNT(*) as count 
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'settlements' 
                    AND COLUMN_NAME = '{column_name}'
                """)
                
                result = await conn.execute(check_query)
                row = result.fetchone()
                column_exists = row and row[0] > 0
                
                if not column_exists:
                    # Column doesn't exist, add it
                    print(f"➕ Adding column: {column_name}...")
                    
                    if column_name == "status":
                        # For status, we need to create the ENUM type first (MySQL)
                        alter_query = text(f"""
                            ALTER TABLE settlements 
                            ADD COLUMN {column_name} {column_def}
                        """)
                        await conn.execute(alter_query)
                        print(f"✅ Added column: {column_name}")
                        
                        # Update existing records to 'accepted'
                        update_query = text("""
                            UPDATE settlements 
                            SET status = 'accepted' 
                            WHERE status IS NULL OR status = ''
                        """)
                        await conn.execute(update_query)
                        print(f"✅ Updated existing records to 'accepted'")
                    elif column_name == "updated_at":
                        # For updated_at, set to created_at for existing records
                        alter_query = text(f"""
                            ALTER TABLE settlements 
                            ADD COLUMN {column_name} DATETIME NULL
                        """)
                        await conn.execute(alter_query)
                        print(f"✅ Added column: {column_name}")
                        
                        # Set updated_at to created_at for existing records
                        update_query = text("""
                            UPDATE settlements 
                            SET updated_at = created_at 
                            WHERE updated_at IS NULL
                        """)
                        await conn.execute(update_query)
                        print(f"✅ Set updated_at for existing records")
                    else:
                        alter_query = text(f"""
                            ALTER TABLE settlements 
                            ADD COLUMN {column_name} {column_def}
                        """)
                        await conn.execute(alter_query)
                        print(f"✅ Added column: {column_name}")
                else:
                    print(f"⏭️  Column {column_name} already exists, skipping...")
                    
            except Exception as e:
                print(f"❌ Error adding column {column_name}: {e}")
                import traceback
                traceback.print_exc()
                # Continue with other columns
        
        print("✅ Migration completed!")
        print("\n📝 Summary:")
        print("   - Added 'status' column (default: 'pending', existing records: 'accepted')")
        print("   - Added 'message' column (nullable)")
        print("   - Added 'proof_photo' column (nullable)")
        print("   - Added 'rejected_reason' column (nullable)")
        print("   - Added 'updated_at' column (set to created_at for existing records)")
        print("\n✨ You can now restart your server!")

if __name__ == "__main__":
    print("🚀 Running settlements table migration...")
    asyncio.run(migrate_settlements())
    print("✨ Done! You can now restart your server.")

