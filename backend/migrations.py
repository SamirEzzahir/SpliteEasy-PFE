"""
Database migration utilities
"""
from sqlalchemy import text
from backend.db import engine

async def migrate_settlements_table():
    """Add new columns to settlements table if they don't exist."""
    
    async with engine.begin() as conn:
        print("🔄 Checking settlements table migration...")
        
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
                    print(f"➕ Adding column: {column_name}...")
                    
                    if column_name == "status":
                        alter_query = text(f"""
                            ALTER TABLE settlements 
                            ADD COLUMN {column_name} {column_def}
                        """)
                        await conn.execute(alter_query)
                        
                        # Update existing records to 'accepted'
                        update_query = text("""
                            UPDATE settlements 
                            SET status = 'accepted' 
                            WHERE status IS NULL OR status = ''
                        """)
                        await conn.execute(update_query)
                    elif column_name == "updated_at":
                        alter_query = text(f"""
                            ALTER TABLE settlements 
                            ADD COLUMN {column_name} DATETIME NULL
                        """)
                        await conn.execute(alter_query)
                        
                        # Set updated_at to created_at for existing records
                        update_query = text("""
                            UPDATE settlements 
                            SET updated_at = created_at 
                            WHERE updated_at IS NULL
                        """)
                        await conn.execute(update_query)
                    else:
                        alter_query = text(f"""
                            ALTER TABLE settlements 
                            ADD COLUMN {column_name} {column_def}
                        """)
                        await conn.execute(alter_query)
                    
                    print(f"✅ Added column: {column_name}")
                    
            except Exception as e:
                print(f"⚠️  Could not add column {column_name}: {e}")
                # Continue with other columns
        
        print("✅ Settlements table migration check completed!")

