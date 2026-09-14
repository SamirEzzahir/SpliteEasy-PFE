"""Additive, transactional migration; existing balances become a dated cutover."""
from sqlalchemy import text

CASH_TYPE_ID = "e7bc9110-b6f8-4f6b-a960-8e4a93de0101"
BANK_TYPE_ID = "e7bc9110-b6f8-4f6b-a960-8e4a93de0102"


async def migrate_money(engine):
    async with engine.begin() as conn:
        for sql in (
            "ALTER TABLE global_settlements ADD COLUMN IF NOT EXISTS currency VARCHAR(3)",
            "ALTER TABLE debts ADD COLUMN IF NOT EXISTS currency VARCHAR(3)",
            "ALTER TABLE loans ADD COLUMN IF NOT EXISTS currency VARCHAR(3)",
            "ALTER TABLE wallets ALTER COLUMN category TYPE VARCHAR(50)",
            "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS wallet_type_id UUID REFERENCES wallet_types(id)",
            "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS currency VARCHAR(3)",
            "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP",
            "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS ledger_started_at TIMESTAMP",
            "ALTER TABLE jar_transactions ADD COLUMN IF NOT EXISTS money_event_id UUID REFERENCES money_events(id)",
            "ALTER TABLE jar_transactions ADD COLUMN IF NOT EXISTS entry_type VARCHAR(20) DEFAULT 'legacy'",
            "ALTER TABLE jar_transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'MAD'",
            "ALTER TABLE jar_transactions ALTER COLUMN amount TYPE NUMERIC(12,2) USING ROUND(amount::numeric, 2)",
            "CREATE INDEX IF NOT EXISTS ix_jar_transactions_money_event_id ON jar_transactions(money_event_id)",
        ):
            await conn.execute(text(sql))
        await conn.execute(text("""
            INSERT INTO wallet_types (id,name,name_key,user_id) VALUES
            (:cash,'Cash','cash',NULL),(:bank,'Bank','bank',NULL)
            ON CONFLICT DO NOTHING
        """), {"cash": CASH_TYPE_ID, "bank": BANK_TYPE_ID})
        await conn.execute(text("""
            INSERT INTO wallet_types (id,user_id,name,name_key)
            SELECT gen_random_uuid(),user_id,MIN(TRIM(category)),LOWER(TRIM(category))
            FROM wallets WHERE wallet_type_id IS NULL AND NULLIF(TRIM(category),'') IS NOT NULL
              AND LOWER(TRIM(category)) NOT IN ('cash','bank')
            GROUP BY user_id,LOWER(TRIM(category)) ON CONFLICT DO NOTHING
        """))
        await conn.execute(text("""
            UPDATE wallets w SET wallet_type_id=t.id,category=t.name FROM wallet_types t
            WHERE w.wallet_type_id IS NULL AND
              t.name_key=COALESCE(NULLIF(LOWER(TRIM(w.category)),''),'cash')
              AND (t.user_id=w.user_id OR t.user_id IS NULL)
        """))
        # Only infer an old wallet's currency when its linked expense history agrees.
        await conn.execute(text("""
            UPDATE wallets w SET currency=e.currency FROM
              (SELECT wallet_id,MIN(UPPER(currency)) AS currency FROM expenses
               WHERE wallet_id IS NOT NULL AND currency IS NOT NULL
               GROUP BY wallet_id HAVING COUNT(DISTINCT UPPER(currency))=1) e
            WHERE w.id=e.wallet_id AND w.currency IS NULL AND LENGTH(e.currency)=3
        """))
        for table in ("debts", "loans"):
            await conn.execute(text(f"UPDATE {table} d SET currency=w.currency FROM wallets w WHERE d.wallet_id=w.id AND d.currency IS NULL AND w.currency IS NOT NULL"))
        await conn.execute(text("""
            INSERT INTO money_events
              (id,user_id,kind,description,amount,currency,occurred_at,created_at,source_type,source_id,idempotency_key)
            SELECT gen_random_uuid(),user_id,'opening','Balance carried forward at My Money setup',
              balance,COALESCE(currency,'UNK'),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'cutover',id,'cutover:'||id::text
            FROM wallets WHERE ledger_started_at IS NULL ON CONFLICT DO NOTHING
        """))
        await conn.execute(text("""
            INSERT INTO wallet_entries (id,event_id,user_id,wallet_id,amount,balance_after,currency)
            SELECT gen_random_uuid(),e.id,e.user_id,w.id,w.balance,w.balance,e.currency
            FROM wallets w JOIN money_events e ON e.source_id=w.id AND e.source_type='cutover'
            WHERE w.ledger_started_at IS NULL AND NOT EXISTS
              (SELECT 1 FROM wallet_entries x WHERE x.event_id=e.id)
        """))
        await conn.execute(text("""
            UPDATE wallets SET ledger_started_at=CURRENT_TIMESTAMP WHERE ledger_started_at IS NULL
        """))
        await conn.execute(text("""
            UPDATE jar_transactions SET entry_type=CASE
              WHEN income_log_id IS NOT NULL THEN 'allocation'
              WHEN description LIKE 'Transfer to %' OR description LIKE 'Transfer from %' THEN 'transfer'
              WHEN amount < 0 THEN 'spending' ELSE 'legacy' END
            WHERE entry_type IS NULL OR entry_type='legacy'
        """))
