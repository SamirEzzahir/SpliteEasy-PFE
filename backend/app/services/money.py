"""Money operations share the caller's transaction; helpers never commit."""
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.orm import selectinload

from app.models import Wallet, WalletType, MoneyEvent, WalletEntry, JarStrategy, JarTransaction

JARS = {"NEC": ("Essentials", 55), "FFA": ("Financial freedom", 10), "EDU": ("Learning", 10),
        "LTSS": ("Long-term saving", 10), "PLAY": ("Play", 10), "GIVE": ("Giving", 5)}
ZERO = Decimal("0.00")


def amount(value):
    value = Decimal(str(value))
    if not value.is_finite():
        raise HTTPException(422, "Enter a finite amount")
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def utc(value=None):
    value = value or datetime.utcnow()
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


def fingerprint(data):
    # Generated defaults (especially timestamps) must not change the identity of a retry.
    return json.dumps(data.model_dump(mode="json", exclude_unset=True) if hasattr(data, "model_dump") else data, sort_keys=True, default=str)


async def lock_owner(session, user_id):
    # Serializes one owner's cash, budget and retry checks before reading balances.
    # Different owners remain independent; row locks protect the actual wallets too.
    await session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:owner, 0))"), {"owner": str(user_id)})


async def retry_event(session, user_id, key, request=None):
    if key is None:
        return None
    event = await session.scalar(select(MoneyEvent).where(MoneyEvent.user_id == user_id, MoneyEvent.idempotency_key == str(key)))
    if event and request is not None and event.request_fingerprint != fingerprint(request):
        raise HTTPException(409, "This request key was already used for different values. Refresh and try again.")
    return event


async def get_wallet(session, user_id, wallet_id, *, archived=False, currency_required=True):
    wallet = await session.scalar(select(Wallet).where(Wallet.id == wallet_id, Wallet.user_id == user_id)
                                  .with_for_update().execution_options(populate_existing=True))
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    if wallet.archived_at and not archived:
        raise HTTPException(409, "Restore this archived wallet before recording money")
    if not wallet.currency and currency_required:
        raise HTTPException(409, "Confirm this wallet's currency in its details before recording money")
    return wallet


async def get_type(session, user_id, type_id):
    wallet_type = await session.scalar(select(WalletType).where(WalletType.id == type_id,
        (WalletType.user_id == user_id) | WalletType.user_id.is_(None), WalletType.archived_at.is_(None)))
    if not wallet_type:
        raise HTTPException(404, "Wallet type not found")
    return wallet_type


async def create_type(session, user_id, name):
    await lock_owner(session, user_id)
    name = name.strip()
    if not name or len(name) > 50:
        raise HTTPException(422, "Wallet type must contain 1–50 characters")
    key = name.lower()
    existing = await session.scalar(select(WalletType).where(WalletType.name_key == key,
        (WalletType.user_id == user_id) | WalletType.user_id.is_(None)))
    if existing:
        if existing.user_id == user_id:
            existing.archived_at = None
        return existing
    wallet_type = WalletType(user_id=user_id, name=name, name_key=key)
    session.add(wallet_type)
    await session.flush()
    return wallet_type


async def post_event(session, user_id, kind, description, currency, changes, *, event_amount=None,
                     personal_share=None, occurred_at=None, source_type=None, source_id=None,
                     key=None, request=None, reversal_of=None, allow_archived=False):
    await lock_owner(session, user_id)
    existing = await retry_event(session, user_id, key, request)
    if existing:
        return existing
    deltas = {}
    for wallet_id, delta in changes:
        deltas[wallet_id] = deltas.get(wallet_id, ZERO) + amount(delta)
    wallets = {}
    for wallet_id in sorted(deltas, key=str):
        wallet = await get_wallet(session, user_id, wallet_id, archived=allow_archived)
        if wallet.currency != currency:
            raise HTTPException(422, "Wallet currencies must match the recorded payment")
        new_balance = amount(wallet.balance) + deltas[wallet_id]
        if new_balance < ZERO:
            raise HTTPException(409, "Insufficient wallet balance. No money was changed.")
        if new_balance >= Decimal("10000000000"):
            raise HTTPException(422, "The resulting balance exceeds the supported limit")
        wallets[wallet_id] = (wallet, new_balance)
    event = MoneyEvent(user_id=user_id, kind=kind, description=description[:255], currency=currency,
        amount=amount(event_amount if event_amount is not None else sum((abs(v) for v in deltas.values()), ZERO)),
        personal_share=amount(personal_share) if personal_share is not None else None,
        occurred_at=utc(occurred_at), source_type=source_type, source_id=source_id,
        idempotency_key=str(key) if key is not None else None,
        request_fingerprint=fingerprint(request) if request is not None else None, reversal_of=reversal_of)
    session.add(event)
    await session.flush()
    for wallet_id, (wallet, balance) in wallets.items():
        wallet.balance = balance
        wallet.updated_at = datetime.utcnow()
        session.add(WalletEntry(event_id=event.id, user_id=user_id, wallet_id=wallet_id,
                               currency=currency, amount=deltas[wallet_id], balance_after=balance))
    await session.flush()
    return event


async def add_budget_entry(session, event, jar, value, kind):
    if jar not in JARS:
        raise HTTPException(422, "Unknown budget jar")
    session.add(JarTransaction(user_id=event.user_id, money_event_id=event.id, jar_type=jar,
        amount=amount(value), entry_type=kind, currency=event.currency,
        description=event.description, date=event.occurred_at))


async def allocate_income(session, event, strategy_id=None):
    if event.kind != "income" or event.reversed_at:
        raise HTTPException(409, "Choose an active income record")
    if event.source_type == "income":
        from app.models import Income
        source = await session.get(Income, event.source_id)
        if not source or amount(source.amount) != event.amount:
            raise HTTPException(409, "This income was corrected. Reverse it and record the corrected income before allocating.")
    if await session.scalar(select(JarTransaction.id).where(JarTransaction.money_event_id == event.id).limit(1)):
        raise HTTPException(409, "This income is already allocated")
    weights = {key: Decimal(str(value[1])) for key, value in JARS.items()}
    if strategy_id:
        strategy = await session.scalar(select(JarStrategy).where(JarStrategy.id == strategy_id,
            (JarStrategy.user_id == event.user_id) | JarStrategy.user_id.is_(None)))
        if not strategy:
            raise HTTPException(404, "Budget strategy not found")
        weights = {key: Decimal(str(getattr(strategy, key.lower()))) for key in JARS}
    if any(not v.is_finite() or v < 0 for v in weights.values()) or sum(weights.values()) <= 0:
        raise HTTPException(422, "Invalid budget percentages")
    cents = int(event.amount * 100)
    exact = {key: Decimal(cents) * weight / sum(weights.values()) for key, weight in weights.items()}
    allocated = {key: int(value) for key, value in exact.items()}
    order = sorted(exact, key=lambda key: exact[key] - allocated[key], reverse=True)
    for key in order[:cents - sum(allocated.values())]:
        allocated[key] += 1
    for key, value in allocated.items():
        await add_budget_entry(session, event, key, Decimal(value) / 100, "allocation")
    await session.flush()


async def reverse_event(session, user_id, event_id, *, internal=False):
    await lock_owner(session, user_id)
    event = await session.scalar(select(MoneyEvent).where(MoneyEvent.id == event_id, MoneyEvent.user_id == user_id)
        .options(selectinload(MoneyEvent.entries)).with_for_update().execution_options(populate_existing=True))
    if not event:
        raise HTTPException(404, "Money record not found")
    if event.reversed_at:
        return await session.scalar(select(MoneyEvent).where(MoneyEvent.reversal_of == event.id))
    if not internal and event.source_type in ("expense", "income", "income_correction", "settlement", "global_settlement", "loan", "debt", "repayment", "debt_repayment", "loan_repayment", "cutover"):
        raise HTTPException(409, "Correct this record from its original expense, income, or payment")
    if event.kind in ("opening", "reversal"):
        raise HTTPException(409, "Use a balance adjustment to correct an opening balance")
    reversal = await post_event(session, user_id, "reversal", f"Reversal: {event.description}", event.currency,
        [(entry.wallet_id, -entry.amount) for entry in event.entries], event_amount=event.amount,
        reversal_of=event.id, source_type=event.source_type, source_id=event.source_id, allow_archived=True)
    budgets = (await session.scalars(select(JarTransaction).where(JarTransaction.money_event_id == event.id))).all()
    for row in budgets:
        await add_budget_entry(session, reversal, row.jar_type, -row.amount, "reversal")
    event.reversed_at = datetime.utcnow()
    await session.flush()
    return reversal


async def active_source_event(session, user_id, source_type, source_id):
    return await session.scalar(select(MoneyEvent).where(MoneyEvent.user_id == user_id,
        MoneyEvent.source_type == source_type, MoneyEvent.source_id == source_id,
        MoneyEvent.reversed_at.is_(None), MoneyEvent.kind != "reversal").order_by(MoneyEvent.created_at.desc()))


async def event_read(session, event):
    await session.refresh(event, ["entries"])
    return {"id": event.id, "kind": event.kind, "description": event.description, "amount": str(event.amount),
        "currency": event.currency, "personal_share": str(event.personal_share) if event.personal_share is not None else None,
        "date": event.occurred_at, "created_at": event.created_at, "source_type": event.source_type,
        "source_id": event.source_id, "reversed_at": event.reversed_at, "reversal_of": event.reversal_of,
        "entries": [{"wallet_id": entry.wallet_id, "wallet_name": entry.wallet.name,
            "amount": str(entry.amount), "balance_after": str(entry.balance_after)} for entry in event.entries]}


def wallet_read(wallet):
    return {"id": wallet.id, "user_id": wallet.user_id, "name": wallet.name, "category": wallet.category,
        "wallet_type_id": wallet.wallet_type_id, "currency": wallet.currency, "balance": str(wallet.balance),
        "archived_at": wallet.archived_at, "created_at": wallet.created_at, "updated_at": wallet.updated_at,
        "needs_currency": wallet.currency is None}
