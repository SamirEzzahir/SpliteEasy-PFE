from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.db import get_session
from app.models import (Wallet, MoneyEvent, WalletEntry, Income, IncomeType, Expense, Split,
                        Group, Membership, Settlement, GlobalSettlement, User, JarTransaction)
from app.schemas.money import (IncomeCreate, SpendingCreate, TransferCreate, Currency,
                               SettlementPost, BudgetTransfer, BudgetAllocation)
from app.services import money as service
from app.core.money_access import require_money

router = APIRouter(prefix="/money", tags=["My Money"], dependencies=[Depends(require_money)])


@router.post("/income")
async def income(data: IncomeCreate, session=Depends(get_session), user=Depends(get_current_user)):
    await service.lock_owner(session, user.id)
    existing = await service.retry_event(session, user.id, data.idempotency_key, data)
    if existing:
        return await service.event_read(session, existing)
    wallet = await service.get_wallet(session, user.id, data.wallet_id)
    if data.income_type_id:
        source = await session.scalar(select(IncomeType).where(IncomeType.id == data.income_type_id,
            (IncomeType.user_id == user.id) | IncomeType.user_id.is_(None)))
        if not source:
            raise HTTPException(404, "Income source not found")
    else:
        source = await session.scalar(select(IncomeType).where(func.lower(IncomeType.name) == data.source.lower(),
            IncomeType.user_id == user.id).limit(1))
        if not source:
            source = IncomeType(user_id=user.id, name=data.source)
            session.add(source)
            await session.flush()
    record = Income(user_id=user.id, wallet_id=wallet.id, income_type_id=source.id,
        amount=data.amount, source_type="wallet", note=data.description, date=data.date)
    session.add(record)
    await session.flush()
    event = await service.post_event(session, user.id, "income", data.description, wallet.currency,
        [(wallet.id, data.amount)], event_amount=data.amount, occurred_at=data.date,
        source_type="income", source_id=record.id, key=data.idempotency_key, request=data)
    if data.allocate:
        await service.allocate_income(session, event, data.strategy_id)
    await session.commit()
    return await service.event_read(session, event)


@router.post("/spending")
async def spending(data: SpendingCreate, session=Depends(get_session), user=Depends(get_current_user)):
    await service.lock_owner(session, user.id)
    existing = await service.retry_event(session, user.id, data.idempotency_key, data)
    if existing:
        return await service.event_read(session, existing)
    wallet = await service.get_wallet(session, user.id, data.wallet_id)
    event = await service.post_event(session, user.id, "spending", data.description, wallet.currency,
        [(wallet.id, -data.amount)], event_amount=data.amount, personal_share=data.amount,
        occurred_at=data.date, key=data.idempotency_key, request=data)
    if data.jar_type:
        await service.add_budget_entry(session, event, data.jar_type, -data.amount, "spending")
    await session.commit()
    return await service.event_read(session, event)


@router.post("/transfer")
async def transfer(data: TransferCreate, session=Depends(get_session), user=Depends(get_current_user)):
    await service.lock_owner(session, user.id)
    existing = await service.retry_event(session, user.id, data.idempotency_key, data)
    if existing:
        return await service.event_read(session, existing)
    if data.from_wallet_id == data.to_wallet_id:
        raise HTTPException(422, "Choose two different wallets")
    wallet = await service.get_wallet(session, user.id, data.from_wallet_id)
    event = await service.post_event(session, user.id, "transfer", data.description, wallet.currency,
        [(data.from_wallet_id, -data.amount), (data.to_wallet_id, data.amount)], event_amount=data.amount,
        occurred_at=data.date, key=data.idempotency_key, request=data)
    await session.commit()
    return await service.event_read(session, event)


@router.get("/activity")
async def activity(currency: str | None = None, wallet_id: UUID | None = None, kind: str | None = None, month: str | None = None,
                   page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                   session=Depends(get_session), user=Depends(get_current_user)):
    query = select(MoneyEvent).where(MoneyEvent.user_id == user.id)
    if month:
        try:
            start = datetime.strptime(month, "%Y-%m")
        except ValueError:
            raise HTTPException(422, "Month must use YYYY-MM")
        end = datetime(start.year + (start.month == 12), start.month % 12 + 1, 1)
        query = query.where(MoneyEvent.occurred_at >= start, MoneyEvent.occurred_at < end)
    if currency:
        query = query.where(MoneyEvent.currency == currency)
    if wallet_id:
        if not await session.scalar(select(Wallet.id).where(Wallet.id == wallet_id, Wallet.user_id == user.id)):
            raise HTTPException(404, "Wallet not found")
        query = query.where(MoneyEvent.id.in_(select(WalletEntry.event_id).where(WalletEntry.wallet_id == wallet_id,
            WalletEntry.user_id == user.id)))
    if kind:
        query = query.where(MoneyEvent.kind == kind)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    events = (await session.scalars(query.order_by(MoneyEvent.occurred_at.desc(), MoneyEvent.created_at.desc(), MoneyEvent.id)
                                   .offset((page - 1) * limit).limit(limit))).all()
    return {"items": [await service.event_read(session, event) for event in events], "total": total,
            "page": page, "limit": limit}


@router.post("/events/{event_id}/reverse")
async def reverse(event_id: UUID, session=Depends(get_session), user=Depends(get_current_user)):
    event = await service.reverse_event(session, user.id, event_id)
    await session.commit()
    return await service.event_read(session, event)


@router.get("/summary")
async def summary(currency: Currency = "MAD", month: str | None = None,
                  session=Depends(get_session), user=Depends(get_current_user)):
    try:
        start = datetime.strptime(month, "%Y-%m") if month else datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    except ValueError:
        raise HTTPException(422, "Month must use YYYY-MM")
    end = datetime(start.year + (start.month == 12), start.month % 12 + 1, 1)
    total = await session.scalar(select(func.coalesce(func.sum(Wallet.balance), 0)).where(Wallet.user_id == user.id, Wallet.currency == currency))
    earned = await session.scalar(select(func.coalesce(func.sum(Income.amount), 0)).join(Wallet).where(
        Income.user_id == user.id, Wallet.currency == currency, Income.date >= start, Income.date < end))
    own_shared = await session.scalar(select(func.coalesce(func.sum(Split.share_amount), 0)).join(Expense).where(
        Split.user_id == user.id, Expense.currency == currency, Expense.created_at >= start, Expense.created_at < end))
    personal = await session.scalar(select(func.coalesce(func.sum(MoneyEvent.personal_share), 0)).where(
        MoneyEvent.user_id == user.id, MoneyEvent.kind == "spending", MoneyEvent.reversed_at.is_(None),
        MoneyEvent.currency == currency, MoneyEvent.occurred_at >= start, MoneyEvent.occurred_at < end))
    # A currency-specific net across shared groups; accepted payments settle it.
    paid = await session.scalar(select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.payer_id == user.id, Expense.currency == currency))
    shares = await session.scalar(select(func.coalesce(func.sum(Split.share_amount), 0)).join(Expense).where(Split.user_id == user.id, Expense.currency == currency))
    net = service.amount(paid) - service.amount(shares)
    for model in (Settlement, GlobalSettlement):
        query = select(model).where((model.from_user_id == user.id) | (model.to_user_id == user.id), model.status == "accepted")
        if model is Settlement:
            query = query.join(Group).where(Group.currency == currency)
        else:
            query = query.where(model.currency == currency)
        for item in (await session.scalars(query)).all():
            net += service.amount(item.amount) * (1 if item.from_user_id == user.id else -1)
    return {"currency": currency, "month": start.strftime("%Y-%m"), "balance": str(service.amount(total)),
        "income": str(service.amount(earned)), "spending": str(service.amount(own_shared) + service.amount(personal)),
        "shared_net": str(net), "owed_to_you": str(max(net, service.ZERO)), "you_owe": str(max(-net, service.ZERO))}


@router.get("/settlements")
async def settlement_choices(currency: Currency = "MAD", session=Depends(get_session), user=Depends(get_current_user)):
    result = []
    for scope, model in (("settlement", Settlement), ("global_settlement", GlobalSettlement)):
        query = select(model).where((model.from_user_id == user.id) | (model.to_user_id == user.id), model.status == "accepted")
        query = query.join(Group).where(Group.currency == currency) if model is Settlement else query.where(model.currency == currency)
        for item in (await session.scalars(query.order_by(model.created_at.desc()).limit(100))).all():
            if await service.active_source_event(session, user.id, scope, item.id):
                continue
            other_id = item.from_user_id if item.to_user_id == user.id else item.to_user_id
            other = await session.get(User, other_id)
            result.append({"id": item.id, "scope": scope, "amount": str(item.amount), "currency": currency,
                "direction": "received" if item.to_user_id == user.id else "paid", "person": other.username if other else "Member",
                "date": item.created_at})
    return result


@router.post("/settlements/{scope}/{settlement_id}/record")
async def record_settlement(scope: str, settlement_id: UUID, data: SettlementPost,
                            session=Depends(get_session), user=Depends(get_current_user)):
    await service.lock_owner(session, user.id)
    request = {**data.model_dump(mode="json"), "scope": scope, "settlement_id": str(settlement_id)}
    existing = await service.retry_event(session, user.id, data.idempotency_key, request)
    if existing:
        return await service.event_read(session, existing)
    model = {"settlement": Settlement, "global_settlement": GlobalSettlement}.get(scope)
    if not model:
        raise HTTPException(404, "Payment not found")
    item = await session.scalar(select(model).where(model.id == settlement_id,
        (model.from_user_id == user.id) | (model.to_user_id == user.id)).with_for_update())
    if not item:
        raise HTTPException(404, "Payment not found")
    if item.status.value != "accepted":
        raise HTTPException(409, "The recipient must confirm this payment first")
    if await service.active_source_event(session, user.id, scope, item.id):
        raise HTTPException(409, "This payment is already recorded in your wallet")
    currency = (await session.get(Group, item.group_id)).currency if model is Settlement else item.currency
    received = item.to_user_id == user.id
    event = await service.post_event(session, user.id, "reimbursement" if received else "settlement",
        "Shared-bill reimbursement" if received else "Shared-bill payment", currency,
        [(data.wallet_id, service.amount(item.amount) * (1 if received else -1))], event_amount=item.amount,
        source_type=scope, source_id=item.id, key=data.idempotency_key, request=request)
    await session.commit()
    return await service.event_read(session, event)


@router.get("/budgets")
async def budgets(currency: Currency = "MAD", session=Depends(get_session), user=Depends(get_current_user)):
    rows = (await session.scalars(select(JarTransaction).where(JarTransaction.user_id == user.id, JarTransaction.currency == currency))).all()
    reversed_ids = set((await session.scalars(select(MoneyEvent.id).where(MoneyEvent.user_id == user.id, MoneyEvent.reversed_at.is_not(None)))).all())
    result = []
    for key, (name, percent) in service.JARS.items():
        entries = [row for row in rows if row.jar_type == key]
        result.append({"id": key, "name": name, "percent": percent, "currency": currency,
            "balance": str(sum((service.amount(row.amount) for row in entries), service.ZERO)),
            "allocated": str(sum((service.amount(row.amount) for row in entries if row.entry_type == "allocation" and row.money_event_id not in reversed_ids), service.ZERO)),
            "spent": str(-sum((service.amount(row.amount) for row in entries if row.entry_type == "spending" and row.money_event_id not in reversed_ids), service.ZERO))})
    return result


@router.post("/budgets/allocate")
async def allocate(data: BudgetAllocation, session=Depends(get_session), user=Depends(get_current_user)):
    await service.lock_owner(session, user.id)
    event = await session.scalar(select(MoneyEvent).where(MoneyEvent.id == data.event_id, MoneyEvent.user_id == user.id))
    if not event:
        raise HTTPException(404, "Income record not found")
    await service.allocate_income(session, event, data.strategy_id)
    await session.commit()
    return {"message": "Income allocated to your budgets"}


@router.post("/budgets/transfer")
async def budget_transfer(data: BudgetTransfer, session=Depends(get_session), user=Depends(get_current_user)):
    await service.lock_owner(session, user.id)
    existing = await service.retry_event(session, user.id, data.idempotency_key, data)
    if existing:
        return await service.event_read(session, existing)
    if data.from_jar == data.to_jar:
        raise HTTPException(422, "Choose two different budgets")
    available = await session.scalar(select(func.coalesce(func.sum(JarTransaction.amount), 0)).where(
        JarTransaction.user_id == user.id, JarTransaction.jar_type == data.from_jar, JarTransaction.currency == data.currency))
    if available < data.amount:
        raise HTTPException(409, "Insufficient amount in the source budget")
    event = await service.post_event(session, user.id, "budget_transfer", data.description, data.currency, [],
        event_amount=data.amount, key=data.idempotency_key, request=data, occurred_at=data.date)
    await service.add_budget_entry(session, event, data.from_jar, -data.amount, "transfer")
    await service.add_budget_entry(session, event, data.to_jar, data.amount, "transfer")
    await session.commit()
    return await service.event_read(session, event)
