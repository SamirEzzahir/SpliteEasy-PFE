from sqlalchemy import text
from backend.core.db import engine


async def migrate_settlements_table():
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
                        await conn.execute(text(f"ALTER TABLE settlements ADD COLUMN {column_name} {column_def}"))
                        await conn.execute(text("UPDATE settlements SET status = 'accepted' WHERE status IS NULL OR status = ''"))
                    elif column_name == "updated_at":
                        await conn.execute(text(f"ALTER TABLE settlements ADD COLUMN {column_name} DATETIME NULL"))
                        await conn.execute(text("UPDATE settlements SET updated_at = created_at WHERE updated_at IS NULL"))
                    else:
                        await conn.execute(text(f"ALTER TABLE settlements ADD COLUMN {column_name} {column_def}"))
                    print(f"✅ Added column: {column_name}")
            except Exception as e:
                print(f"⚠️  Could not add column {column_name}: {e}")
        print("✅ Settlements table migration check completed!")


async def migrate_global_settlement_mode():
    async with engine.begin() as conn:
        print("🔄 Checking global_settlement_mode migration...")
        try:
            result = await conn.execute(text("""
                SELECT COUNT(*) as count FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'global_settlement_mode'
            """))
            if not (result.fetchone()[0] > 0):
                print("➕ Adding column: global_settlement_mode...")
                await conn.execute(text("ALTER TABLE users ADD COLUMN global_settlement_mode VARCHAR(20) DEFAULT 'separate'"))
                print("✅ Added column: global_settlement_mode")
            else:
                print("✅ Column global_settlement_mode already exists.")
        except Exception as e:
            print(f"⚠️  Could not add column global_settlement_mode: {e}")
            if "Duplicate column name" not in str(e):
                raise
        print("✅ Global settlement mode migration check completed!")


async def migrate_transactions_to_wallet_id():
    async with engine.begin() as conn:
        print("🔄 Checking transactions table for to_wallet_id migration...")
        try:
            result = await conn.execute(text("""
                SELECT IS_NULLABLE FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'to_wallet_id'
            """))
            row = result.fetchone()
            if row and row[0] == 'NO':
                await conn.execute(text("ALTER TABLE transactions MODIFY COLUMN to_wallet_id INT NULL"))
                print("✅ Made to_wallet_id nullable.")
        except Exception as e:
            print(f"⚠️  Could not modify to_wallet_id column: {e}")
        print("✅ Transactions table to_wallet_id migration check completed!")


async def migrate_transactions_transaction_type():
    async with engine.begin() as conn:
        print("🔄 Checking transactions table for transaction_type migration...")
        try:
            result = await conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'transaction_type'
            """))
            if not (result.fetchone()[0] > 0):
                await conn.execute(text("ALTER TABLE transactions ADD COLUMN transaction_type ENUM('transfer', 'debt', 'credit') DEFAULT 'transfer'"))
                await conn.execute(text("UPDATE transactions SET transaction_type = 'debt' WHERE to_wallet_id IS NULL"))
            await conn.execute(text("UPDATE transactions SET transaction_type = 'transfer' WHERE transaction_type IS NULL OR transaction_type = '' OR transaction_type NOT IN ('transfer', 'debt', 'credit')"))
        except Exception as e:
            print(f"⚠️  Could not add column transaction_type: {e}")
        print("✅ Transactions table transaction_type migration check completed!")


async def migrate_debts_loans_tables():
    async with engine.begin() as conn:
        print("🔄 Creating/fixing debts and loans tables...")
        for table, name_col, repayment_table in [
            ("debts", "lender_name", "debt_repayments"),
            ("loans", "borrower_name", "loan_repayments"),
        ]:
            try:
                result = await conn.execute(text(f"SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table}'"))
                exists = result.fetchone()[0] > 0
                if not exists:
                    print(f"➕ Creating {table} table...")
                    # Tables are created via SQLAlchemy metadata; this is a safety check
                else:
                    result = await conn.execute(text(f"SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table}' AND COLUMN_NAME = '{name_col}'"))
                    if not (result.fetchone()[0] > 0):
                        print(f"WARNING: {table} table missing {name_col}. Drop and recreate.")
            except Exception as e:
                print(f"⚠️  Error with {table} table: {e}")
        print("✅ Debts & Loans tables migration completed!")


async def migrate_expenses_jar_columns():
    async with engine.begin() as conn:
        print("🔄 Checking expenses table for jar-related columns...")
        try:
            for col, defn in [("jar_type", "VARCHAR(10) NULL"), ("is_from_jar", "BOOLEAN DEFAULT FALSE")]:
                result = await conn.execute(text(f"SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = '{col}'"))
                if not (result.fetchone()[0] > 0):
                    await conn.execute(text(f"ALTER TABLE expenses ADD COLUMN {col} {defn}"))
                    print(f"➕ Added column: {col}")
            print("✅ Expenses jar tracking migration check completed!")
        except Exception as e:
            print(f"⚠️  Could not modify expenses table for jars: {e}")


async def migrate_group_messages_table():
    async with engine.begin() as conn:
        print("🔄 Checking group_messages table migration...")
        try:
            result = await conn.execute(text("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_messages'"))
            if not (result.fetchone()[0] > 0):
                print("➕ Creating table: group_messages...")
                await conn.execute(text("""
                    CREATE TABLE group_messages (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        group_id INT NOT NULL,
                        user_id INT NOT NULL,
                        content VARCHAR(2000) NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        INDEX idx_group_id (group_id)
                    )
                """))
                print("✅ Created table group_messages")
        except Exception as e:
            print(f"⚠️  Could not create group_messages table: {e}")
            raise
        print("✅ Group messages table migration check completed!")


async def migrate_preferred_currency():
    async with engine.begin() as conn:
        print("🔄 Checking preferred_currency migration...")
        try:
            result = await conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'preferred_currency'
            """))
            if not (result.fetchone()[0] > 0):
                print("➕ Adding column: preferred_currency...")
                await conn.execute(text("ALTER TABLE users ADD COLUMN preferred_currency VARCHAR(3) DEFAULT 'USD'"))
                print("✅ Added column: preferred_currency")
            else:
                print("✅ Column preferred_currency already exists.")
        except Exception as e:
            print(f"⚠️  Could not add column preferred_currency: {e}")


async def run_migrations():
    await migrate_settlements_table()
    await migrate_global_settlement_mode()
    await migrate_transactions_to_wallet_id()
    await migrate_transactions_transaction_type()
    await migrate_debts_loans_tables()
    await migrate_expenses_jar_columns()
    await migrate_group_messages_table()
    await migrate_preferred_currency()
