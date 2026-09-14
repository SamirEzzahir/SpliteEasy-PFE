from datetime import datetime
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.models import Income, IncomeType, Wallet, JarTransaction
from app.services import money


async def owned_income_type(session, user_id, type_id):
    record = await session.scalar(select(IncomeType).where(IncomeType.id == type_id,
        (IncomeType.user_id == user_id) | IncomeType.user_id.is_(None)))
    if not record:
        raise HTTPException(404, "Income type not found")
    return record


async def add_income(session, user_id, data):
    await money.lock_owner(session, user_id)
    wallet = await money.get_wallet(session, user_id, data.wallet_id)
    source = await owned_income_type(session, user_id, data.income_type_id)
    record = Income(user_id=user_id, wallet_id=wallet.id, income_type_id=source.id,
        amount=money.amount(data.amount), source_type=data.source_type, note=data.note, date=money.utc(data.date))
    session.add(record)
    await session.flush()
    await money.post_event(session, user_id, "income", data.note or source.name, wallet.currency,
        [(wallet.id, record.amount)], event_amount=record.amount, occurred_at=record.date, source_type="income", source_id=record.id)
    await session.commit()
    return await read_income(session, record.id)


async def read_income(session, income_id):
    return await session.scalar(select(Income).where(Income.id == income_id)
        .options(selectinload(Income.wallet), selectinload(Income.income_type)).execution_options(populate_existing=True))


async def get_user_incomes(session, user_id, from_date=None, to_date=None):
    query = select(Income).where(Income.user_id == user_id)
    if from_date:
        query = query.where(Income.date >= from_date)
    if to_date:
        query = query.where(Income.date <= to_date)
    records = (await session.scalars(query.options(selectinload(Income.wallet), selectinload(Income.income_type)).order_by(Income.date.desc()))).all()
    return [{"id":i.id,"user_id":i.user_id,"amount":float(i.amount),"date":i.date,"note":i.note,
        "wallet_id":i.wallet_id,"wallet_name":i.wallet.name,"income_type_id":i.income_type_id,
        "category_name":i.income_type.name,"created_at":i.created_at,"updated_at":i.updated_at} for i in records]


async def get_balance_summary(session, user_id):
    rows = (await session.execute(select(Wallet.category, Wallet.currency, func.sum(Wallet.balance))
        .where(Wallet.user_id == user_id).group_by(Wallet.category, Wallet.currency))).all()
    by_currency = {}
    for category, currency, value in rows:
        if currency is None:
            continue
        summary = by_currency.setdefault(currency, {"bank":money.ZERO,"cash":money.ZERO,"total":money.ZERO,"types":{}})
        summary["total"] += value
        summary["types"][category] = summary["types"].get(category, money.ZERO) + value
        if category.lower() in ("cash","bank"):
            summary[category.lower()] += value
    return {**by_currency.get("MAD", {"bank":0,"cash":0,"total":0}), "currency":"MAD", "by_currency":by_currency}


async def update_income(session, income_id, user_id, data):
    await money.lock_owner(session, user_id)
    record = await session.scalar(select(Income).where(Income.id == income_id, Income.user_id == user_id).with_for_update())
    if not record:
        raise HTTPException(404, "Income not found")
    fields = data.model_dump(exclude_unset=True)
    if any(fields.get(key, 1) is None for key in ("amount","wallet_id","income_type_id","date")):
        raise HTTPException(422, "Amount, wallet, source and date cannot be empty")
    source = await owned_income_type(session, user_id, fields.get("income_type_id", record.income_type_id))
    old_wallet = await money.get_wallet(session, user_id, record.wallet_id)
    new_wallet_id = fields.get("wallet_id", record.wallet_id)
    new_amount = money.amount(fields.get("amount", record.amount))
    event = await money.active_source_event(session, user_id, "income", record.id)
    if new_amount != record.amount or new_wallet_id != record.wallet_id:
        if event and await session.scalar(select(JarTransaction.id).where(JarTransaction.money_event_id == event.id).limit(1)):
            raise HTTPException(409, "This income is allocated. Reverse it and record the corrected income.")
        await money.post_event(session, user_id, "adjustment", "Income correction", old_wallet.currency,
            [(record.wallet_id, -record.amount),(new_wallet_id, new_amount)], event_amount=abs(new_amount-record.amount),
            source_type="income_correction", source_id=record.id)
    for key, value in fields.items():
        setattr(record, key, money.utc(value) if key == "date" else value)
    record.income_type_id = source.id
    if event:
        event.description = record.note or source.name
        event.occurred_at = record.date
    await session.commit()
    return await read_income(session, record.id)


async def delete_income(session, income_id, user_id):
    await money.lock_owner(session, user_id)
    record = await session.scalar(select(Income).where(Income.id == income_id, Income.user_id == user_id).with_for_update())
    if not record:
        # Repeated deletion after a lost response is harmless.
        return {"message":"Income already removed"}
    event = await money.active_source_event(session, user_id, "income", record.id)
    if event and event.amount == record.amount and len(event.entries) == 1 and event.entries[0].wallet_id == record.wallet_id:
        await money.reverse_event(session, user_id, event.id, internal=True)
    else:
        wallet = await money.get_wallet(session, user_id, record.wallet_id, archived=True)
        await money.post_event(session, user_id, "reversal", "Income removed", wallet.currency,
            [(wallet.id, -record.amount)], event_amount=record.amount, source_type="income", source_id=record.id, allow_archived=True)
        if event:
            event.reversed_at = datetime.utcnow()
    await session.delete(record)
    await session.commit()
    return {"message":"Income reversed; wallet history preserved"}
