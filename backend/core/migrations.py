from sqlalchemy import text
from backend.core.db import engine


async def _exec(sql: str, label: str = ""):
    """Run a single DDL/DML statement in its own transaction.

    Isolating each statement means a failure (e.g. a column that already
    exists in an unexpected shape) cannot poison a shared transaction and
    abort every following statement.
    """
    try:
        async with engine.begin() as conn:
            await conn.execute(text(sql))
        if label:
            print(f"✅ {label}")
    except Exception as e:
        print(f"⚠️  Skipped ({label or sql[:40]}): {e}")


async def _convert_enum_to_varchar(table: str, column: str, length: int, default: str | None = None):
    """Convert a native Postgres ENUM column to VARCHAR.

    After a MySQL -> Postgres port the enum columns came across as native
    Postgres enum types (e.g. ``friends_status``) whose names don't match the
    types SQLAlchemy expects, so ``col = $1::friendstatus`` has no operator.
    Storing them as plain VARCHAR (with ``native_enum=False`` on the models)
    removes that whole class of failure. ``USING col::text`` preserves the
    existing label values exactly.
    """
    # Drop any enum-typed default first, otherwise the type change is blocked.
    await _exec(f"ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT")
    await _exec(
        f"ALTER TABLE {table} ALTER COLUMN {column} TYPE VARCHAR({length}) USING {column}::text",
        f"{table}.{column} -> varchar({length})",
    )
    if default is not None:
        await _exec(f"ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT '{default}'")


async def migrate_enum_columns_to_varchar():
    print("🔄 Converting native enum columns to VARCHAR (Postgres compatibility)...")
    await _convert_enum_to_varchar("friends", "status", 20, "pending")
    await _convert_enum_to_varchar("settlements", "status", 20, "pending")
    await _convert_enum_to_varchar("global_settlements", "status", 20, "pending")
    await _convert_enum_to_varchar("users", "gender", 10)
    await _convert_enum_to_varchar("users", "global_settlement_mode", 20, "separate")
    await _convert_enum_to_varchar("reclamations", "status", 20, "pending")
    await _convert_enum_to_varchar("transactions", "transaction_type", 20, "transfer")
    await _convert_enum_to_varchar("debts", "status", 20, "active")
    await _convert_enum_to_varchar("loans", "status", 20, "active")
    print("✅ Enum-to-VARCHAR conversion completed!")


async def migrate_settlements_table():
    print("🔄 Checking settlements table migration...")
    await _exec(
        "ALTER TABLE settlements ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'",
        "settlements.status",
    )
    # Backfill pre-existing rows that predate the status column.
    await _exec("UPDATE settlements SET status = 'accepted' WHERE status IS NULL OR status = ''")
    await _exec("ALTER TABLE settlements ADD COLUMN IF NOT EXISTS message VARCHAR(500)", "settlements.message")
    await _exec("ALTER TABLE settlements ADD COLUMN IF NOT EXISTS proof_photo VARCHAR(255)", "settlements.proof_photo")
    await _exec("ALTER TABLE settlements ADD COLUMN IF NOT EXISTS rejected_reason VARCHAR(500)", "settlements.rejected_reason")
    await _exec("ALTER TABLE settlements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP", "settlements.updated_at")
    await _exec("UPDATE settlements SET updated_at = created_at WHERE updated_at IS NULL")
    print("✅ Settlements table migration check completed!")


async def migrate_global_settlement_mode():
    print("🔄 Checking global_settlement_mode migration...")
    await _exec(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS global_settlement_mode VARCHAR(20) DEFAULT 'separate'",
        "users.global_settlement_mode",
    )
    print("✅ Global settlement mode migration check completed!")


async def migrate_transactions_to_wallet_id():
    print("🔄 Checking transactions table for to_wallet_id migration...")
    await _exec(
        "ALTER TABLE transactions ALTER COLUMN to_wallet_id DROP NOT NULL",
        "transactions.to_wallet_id nullable",
    )
    print("✅ Transactions table to_wallet_id migration check completed!")


async def migrate_transactions_transaction_type():
    print("🔄 Checking transactions table for transaction_type migration...")
    await _exec(
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(20) DEFAULT 'transfer'",
        "transactions.transaction_type",
    )
    await _exec("UPDATE transactions SET transaction_type = 'debt' WHERE to_wallet_id IS NULL AND transaction_type IS NULL")
    await _exec(
        "UPDATE transactions SET transaction_type = 'transfer' "
        "WHERE transaction_type IS NULL OR transaction_type = '' "
        "OR transaction_type NOT IN ('transfer', 'debt', 'credit')"
    )
    print("✅ Transactions table transaction_type migration check completed!")


async def migrate_debts_loans_tables():
    # Tables are created via SQLAlchemy metadata; nothing to alter here on
    # Postgres. Kept as a no-op so run_migrations() stays stable.
    print("✅ Debts & Loans tables migration completed!")


async def migrate_expenses_jar_columns():
    print("🔄 Checking expenses table for jar-related columns...")
    await _exec("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS jar_type VARCHAR(10)", "expenses.jar_type")
    await _exec("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_from_jar BOOLEAN DEFAULT FALSE", "expenses.is_from_jar")
    print("✅ Expenses jar tracking migration check completed!")


async def migrate_group_messages_table():
    print("🔄 Checking group_messages table migration...")
    await _exec(
        """
        CREATE TABLE IF NOT EXISTS group_messages (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content VARCHAR(2000) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "group_messages table",
    )
    await _exec("CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON group_messages (group_id)")
    print("✅ Group messages table migration check completed!")


async def migrate_preferred_currency():
    print("🔄 Checking preferred_currency migration...")
    await _exec(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) DEFAULT 'MAD'",
        "users.preferred_currency",
    )
    print("✅ Preferred currency migration check completed!")


async def migrate_onboarding_completed():
    print("🔄 Checking onboarding_completed migration...")
    await _exec(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE",
        "users.onboarding_completed",
    )
    print("✅ Onboarding completed migration check completed!")


async def run_migrations():
    await migrate_enum_columns_to_varchar()
    await migrate_settlements_table()
    await migrate_global_settlement_mode()
    await migrate_transactions_to_wallet_id()
    await migrate_transactions_transaction_type()
    await migrate_debts_loans_tables()
    await migrate_expenses_jar_columns()
    await migrate_group_messages_table()
    await migrate_preferred_currency()
    await migrate_onboarding_completed()
