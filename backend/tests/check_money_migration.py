"""Run only against an explicitly named disposable copy of the database."""
import asyncio
from sqlalchemy import text
from app.db import engine, Base
import app.models
from app.core.money_migration import migrate_money


async def main():
    assert "money_check" in engine.url.database, "Use a disposable money_check database"
    async with engine.connect() as conn:
        before = (await conn.execute(text("SELECT id,balance FROM wallets ORDER BY id"))).all()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await migrate_money(engine)
    async with engine.connect() as conn:
        count = await conn.scalar(text("SELECT count(*) FROM money_events WHERE source_type='cutover'"))
    await migrate_money(engine)
    async with engine.connect() as conn:
        after = (await conn.execute(text("SELECT id,balance FROM wallets ORDER BY id"))).all()
        assert before == after, "Migration changed existing balances"
        assert count == await conn.scalar(text("SELECT count(*) FROM money_events WHERE source_type='cutover'"))
        assert not await conn.scalar(text("SELECT count(*) FROM wallets WHERE wallet_type_id IS NULL"))
        assert not await conn.scalar(text("SELECT count(*) FROM wallets w WHERE NOT EXISTS (SELECT 1 FROM wallet_entries e WHERE e.wallet_id=w.id)"))
    await engine.dispose()
    print(f"Migration passed twice: {len(before)} wallet balances preserved; {count} cutover records.")


if __name__ == "__main__":
    asyncio.run(main())
