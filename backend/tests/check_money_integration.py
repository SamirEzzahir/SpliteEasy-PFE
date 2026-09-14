"""Integration checks against a running API and a disposable money_check database.

Run inside the isolated backend: python -m tests.check_money_integration
No extra test dependencies are required. All created fixtures stay in the test DB.
"""
import asyncio
import json
import uuid
from datetime import datetime
from decimal import Decimal
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from sqlalchemy import select, func
from app.db import engine, async_session
from app.models import User, Group, Membership, Settlement, SettlementStatus, Wallet, MoneyEvent, WalletEntry
from app.auth import create_access_token
from app.core.security import hash_password
from app.core.money_migration import migrate_money

BASE = "http://127.0.0.1:8000"
checks = 0


async def request(token, method, path, data=None, status=200):
    def send():
        body = json.dumps(data).encode() if data is not None else None
        req = Request(BASE + path, body, {"Authorization": "Bearer " + token, "Content-Type": "application/json"}, method=method)
        try:
            with urlopen(req, timeout=20) as response:
                return response.status, response.read().decode()
        except HTTPError as error:
            return error.code, error.read().decode()
    code, raw = await asyncio.to_thread(send)
    assert code == status, f"{method} {path}: expected {status}, got {code}: {raw[:2000]}"
    global checks
    checks += 1
    return json.loads(raw) if raw else None


def record(**fields):
    return {"idempotency_key": str(uuid.uuid4()), "description": "Integration check", **fields}


async def main():
    assert "money_check" in engine.url.database, "Use a disposable money_check database"
    suffix = uuid.uuid4().hex[:8]
    async with async_session() as session:
        users = [User(username=f"moneycheck_{suffix}_{i}", email=f"moneycheck_{suffix}_{i}@example.com", password_hash=hash_password("MoneyCheck123!"), preferred_currency="MAD", onboarding_completed=True) for i in range(3)]
        session.add_all(users)
        await session.flush()
        group = Group(title="Wallet integration checks", owner_id=users[1].id, currency="MAD")
        session.add(group)
        await session.flush()
        session.add_all([Membership(group_id=group.id, user_id=user.id, is_admin=True) for user in users])
        legacy = Wallet(user_id=users[0].id, name="Legacy balance", category="Freelancing", balance=Decimal("123.45"))
        session.add(legacy)
        await session.commit()
        ids = [str(u.id) for u in users]
        group_id, legacy_id = str(group.id), str(legacy.id)
    await migrate_money(engine)
    await migrate_money(engine)
    async with async_session() as session:
        assert await session.scalar(select(Wallet.balance).where(Wallet.id == uuid.UUID(legacy_id))) == Decimal("123.45")
        assert await session.scalar(select(func.count()).select_from(WalletEntry).where(WalletEntry.wallet_id == uuid.UUID(legacy_id))) == 1
    tokens = [create_access_token(u.username) for u in users]
    a, b, c = tokens
    await request(a, "GET", "/auth/me")
    types = await request(a, "GET", "/wallet-types")
    assert {"Cash", "Bank", "Freelancing"}.issubset({t["name"] for t in types})
    private = await request(a, "POST", "/wallet-types", {"name": "Gift"})
    assert private["id"] not in {t["id"] for t in await request(b, "GET", "/wallet-types")}
    await request(b, "PUT", "/wallet-types/" + private["id"], {"name": "Stolen"}, 404)
    await request(b, "POST", "/wallets", {"name": "Invalid", "wallet_type_id": private["id"]}, 404)
    await request(a, "PUT", "/wallets/" + legacy_id, {"currency": "MAD"})
    assert (await request(a, "GET", "/wallets/" + legacy_id))["balance"] == "123.45"
    bank_data = {"name": "Main bank", "category": "Bank", "balance": "1000.00", "currency": "MAD", "idempotency_key": str(uuid.uuid4())}
    bank = await request(a, "POST", "/wallets", bank_data)
    assert (await request(a, "POST", "/wallets", bank_data))["id"] == bank["id"]
    cash = await request(a, "POST", "/wallets", {"name": "Pocket cash", "balance": "100.00"})
    euro = await request(a, "POST", "/wallets", {"name": "Euro", "currency": "EUR", "balance": "0"})
    await request(b, "GET", "/wallets/" + bank["id"], status=404)
    await request(a, "POST", "/money/spending", record(wallet_id=bank["id"], amount="-1"), 422)
    await request(a, "POST", "/money/transfer", record(from_wallet_id=bank["id"], to_wallet_id=euro["id"], amount="10"), 422)
    inc_data = record(wallet_id=bank["id"], amount="11.11", source="Freelancing", allocate=True)
    inc = await request(a, "POST", "/money/income", inc_data)
    assert (await request(a, "POST", "/money/income", inc_data))["id"] == inc["id"]
    await request(a, "POST", "/money/income", {**inc_data, "amount": "12"}, 409)
    budgets = await request(a, "GET", "/money/budgets")
    assert sum(Decimal(r["allocated"]) for r in budgets) == Decimal("11.11")
    await request(a, "POST", "/money/budgets/allocate", {"event_id": inc["id"]}, 409)
    transfer = await request(a, "POST", "/money/transfer", record(from_wallet_id=bank["id"], to_wallet_id=cash["id"], amount="50"))
    assert sum(Decimal(e["amount"]) for e in transfer["entries"]) == 0
    await request(a, "POST", "/money/events/" + transfer["id"] + "/reverse")
    assert (await request(a, "GET", "/wallets/" + bank["id"]))["balance"] == "1011.11"
    expense_data = {"group_id": group_id, "payer_id": ids[0], "amount": 300, "currency": "MAD", "description": "Dinner for three", "created_at": datetime.utcnow().isoformat(), "wallet_id": bank["id"], "jar_type": "NEC", "is_from_jar": True, "splits": [{"user_id": uid, "share_amount": 100} for uid in ids], "idempotency_key": str(uuid.uuid4())}
    expense = await request(a, "POST", "/expenses", expense_data)
    assert (await request(a, "POST", "/expenses", expense_data))["id"] == expense["id"]
    assert (await request(a, "GET", "/wallets/" + bank["id"]))["balance"] == "711.11"
    await request(b, "DELETE", "/groups/" + group_id, status=409)
    summary = await request(a, "GET", "/money/summary")
    assert summary["spending"] == "100.00" and summary["owed_to_you"] == "200.00"
    other_expenses = await request(b, "GET", "/expenses/all")
    masked = next(e for e in other_expenses if e["id"] == expense["id"])
    assert masked["wallet_id"] is None and masked["jar_type"] is None
    await request(b, "PUT", "/expenses/" + expense["id"], {"amount": 600, "splits": [{"user_id": uid, "share_amount": 200} for uid in ids]}, 409)
    await request(a, "PUT", "/expenses/" + expense["id"], {"amount": 6000, "splits": [{"user_id": uid, "share_amount": 2000} for uid in ids]}, 409)
    assert (await request(a, "GET", "/wallets/" + bank["id"]))["balance"] == "711.11"
    await request(a, "PUT", "/expenses/" + expense["id"], {"wallet_id": None, "is_from_jar": False, "jar_type": None})
    assert (await request(a, "GET", "/wallets/" + bank["id"]))["balance"] == "1011.11"
    assert sum(Decimal(r["spent"]) for r in await request(a, "GET", "/money/budgets")) == 0
    await request(a, "PUT", "/expenses/" + expense["id"], {"wallet_id": bank["id"], "is_from_jar": True, "jar_type": "NEC"})
    await request(a, "DELETE", "/expenses/" + expense["id"], status=204)
    assert (await request(a, "GET", "/wallets/" + bank["id"]))["balance"] == "1011.11"
    spend = await request(a, "POST", "/money/spending", record(wallet_id=cash["id"], amount="20", jar_type="PLAY"))
    await request(a, "POST", "/money/events/" + spend["id"] + "/reverse")
    await request(a, "DELETE", "/incomes/" + inc["source_id"], status=200)
    assert sum(Decimal(r["allocated"]) for r in await request(a, "GET", "/money/budgets")) == 0
    corrected = await request(a, "POST", "/money/income", record(wallet_id=bank["id"], amount="20"))
    await request(a, "PUT", "/incomes/" + corrected["source_id"], {"amount": "30"})
    await request(a, "DELETE", "/incomes/" + corrected["source_id"])
    assert (await request(a, "GET", "/wallets/" + bank["id"]))["balance"] == "1000.00"
    plan = await request(a, "POST", "/econome/strategies", {"name": "Essentials plan", "nec": 1, "ffa": 0, "edu": 0, "ltss": 0, "play": 0, "give": 0})
    planned = await request(a, "POST", "/money/income", record(wallet_id=bank["id"], amount="10", allocate=True, strategy_id=plan["id"]))
    assert next(r for r in await request(a, "GET", "/money/budgets") if r["id"] == "NEC")["allocated"] == "10.00"
    await request(a, "PUT", "/incomes/" + planned["source_id"], {"amount": "11"}, 409)
    await request(b, "POST", "/money/income", record(wallet_id=bank["id"], amount="10", allocate=True, strategy_id=plan["id"]), 404)
    await request(a, "DELETE", "/incomes/" + planned["source_id"])
    decimal_expense = {**expense_data, "description": "Decimal metadata check", "amount": 3.30, "splits": [{"user_id": uid, "share_amount": 1.10} for uid in ids], "idempotency_key": str(uuid.uuid4())}
    dec = await request(a, "POST", "/expenses", decimal_expense)
    await request(b, "PUT", "/expenses/" + dec["id"], {"description": "Edited by group owner", "amount": 3.30})
    await request(a, "DELETE", "/expenses/" + dec["id"], status=204)
    concurrent = await request(a, "POST", "/wallets", {"name": "Concurrency", "balance": "100"})
    async def race():
        try:
            return await request(a, "POST", "/money/spending", record(wallet_id=concurrent["id"], amount="80"))
        except AssertionError as error:
            assert "got 409" in str(error), str(error)
            return None
    results = await asyncio.gather(race(), race())
    assert sum(item is not None for item in results) == 1
    assert (await request(a, "GET", "/wallets/" + concurrent["id"]))["balance"] == "20.00"
    loan = await request(a, "POST", "/debts-loans/loans", {"borrower_name": "Alex", "original_amount": "200", "currency": "MAD", "wallet_id": bank["id"], "idempotency_key": str(uuid.uuid4())})
    pay = {"amount": "50", "wallet_id": bank["id"], "idempotency_key": str(uuid.uuid4())}
    repayment = await request(a, "POST", "/debts-loans/loans/" + loan["id"] + "/repay", pay)
    assert (await request(a, "POST", "/debts-loans/loans/" + loan["id"] + "/repay", pay))["id"] == repayment["id"]
    await request(a, "DELETE", "/debts-loans/loans/" + loan["id"], status=409)
    assert (await request(a, "GET", "/wallets/" + bank["id"]))["balance"] == "850.00"
    async with async_session() as session:
        payment = Settlement(group_id=uuid.UUID(group_id), from_user_id=users[1].id, to_user_id=users[0].id, amount=200, status=SettlementStatus.accepted)
        session.add(payment)
        await session.commit()
        payment_id = str(payment.id)
    receipt_data = {"wallet_id": bank["id"], "idempotency_key": str(uuid.uuid4())}
    await request(a, "POST", f"/money/settlements/settlement/{payment_id}/record", receipt_data)
    await request(a, "POST", f"/money/settlements/settlement/{payment_id}/record", {**receipt_data, "idempotency_key": str(uuid.uuid4())}, 409)
    assert (await request(a, "GET", "/wallets/" + bank["id"]))["balance"] == "1050.00"
    summary = await request(a, "GET", "/money/summary")
    assert summary["income"] == "0.00" and summary["spending"] == "80.00"
    await request(a, "DELETE", "/wallets/" + bank["id"], status=409)
    await request(a, "DELETE", "/wallets/" + euro["id"])
    assert (await request(a, "GET", "/wallets/" + euro["id"]))["archived_at"]
    for path in ("/econome/balances", "/econome/monthly-summary", "/econome/ledger", "/money/activity?page=1&limit=2", "/debts-loans/summary?currency=EUR"):
        await request(a, "GET", path)
    assert (await request(a, "GET", "/money/activity?month=1999-01"))["total"] == 0
    await request(a, "GET", "/money/activity?month=invalid", status=422)
    await request(a, "POST", "/econome/spend?amount=-5&jar_type=PLAY&description=Invalid", status=422)
    async with async_session() as session:
        for wallet in (await session.scalars(select(Wallet).where(Wallet.user_id == users[0].id))).all():
            total = await session.scalar(select(func.sum(WalletEntry.amount)).where(WalletEntry.wallet_id == wallet.id))
            assert total == wallet.balance, (wallet.name, total, wallet.balance)
    with open("/tmp/money-browser.json", "w") as file:
        json.dump({"username": users[0].username, "password": "MoneyCheck123!", "token": a, "otherToken": b, "groupId": group_id, "bankId": bank["id"]}, file)
    await engine.dispose()
    print(f"PASS: {checks} HTTP checks plus migration, privacy, exact allocation, concurrency and journal reconciliation.")


if __name__ == "__main__":
    asyncio.run(main())
