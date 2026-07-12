from datetime import datetime
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models import Income, IncomeType, Wallet
from app.schemas import IncomeCreate, IncomeRead, IncomeUpdate


async def add_income(session: AsyncSession, user_id: int, data: IncomeCreate) -> IncomeRead:
    wallet = await session.get(Wallet, data.wallet_id)
    if not wallet or wallet.user_id != user_id:
        raise HTTPException(status_code=404, detail="Wallet not found")

    income_type = await session.get(IncomeType, data.income_type_id)
    if not income_type or (income_type.user_id not in (None, user_id)):
        raise HTTPException(status_code=404, detail="Income type not found")

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    new_income = Income(
        user_id=user_id,
        wallet_id=data.wallet_id,
        income_type_id=data.income_type_id,
        amount=data.amount,
        source_type=data.source_type,
        note=data.note,
        date=data.date if data.date else datetime.utcnow(),
    )
    wallet.balance += Decimal(data.amount)

    session.add(new_income)
    await session.commit()
    await session.refresh(new_income)

    new_income.wallet = wallet
    new_income.income_type = income_type

    return new_income


async def get_user_incomes(session: AsyncSession, user_id: int, from_date=None, to_date=None):
    query = select(Income).where(Income.user_id == user_id)
    if from_date:
        query = query.where(Income.date >= from_date)
    if to_date:
        query = query.where(Income.date <= to_date)

    query = query.options(selectinload(Income.wallet), selectinload(Income.income_type)).order_by(Income.date.desc())
    result = await session.execute(query)
    incomes = result.scalars().all()

    return [
        {
            "id": i.id,
            "user_id": i.user_id,
            "amount": float(i.amount),
            "date": i.date,
            "note": i.note,
            "wallet_id": i.wallet_id,
            "wallet_name": i.wallet.name if i.wallet else "",
            "income_type_id": i.income_type_id,
            "category_name": i.income_type.name if i.income_type else "",
            "created_at": i.created_at,
            "updated_at": i.updated_at,
        }
        for i in incomes
    ]


async def get_balance_summary(session: AsyncSession, user_id: int):
    result = await session.execute(
        select(Wallet.category, func.sum(Wallet.balance)).where(Wallet.user_id == user_id).group_by(Wallet.category)
    )
    balances = {row[0]: row[1] for row in result.all()}
    total = sum(balances.values())

    return {
        "bank": balances.get("Bank", 0) + balances.get("Credit Card", 0),
        "cash": balances.get("Cash", 0),
        "total": total,
    }


async def update_income(session: AsyncSession, income_id: int, user_id: int, data: IncomeUpdate):
    result = await session.execute(select(Income).where(Income.id == income_id, Income.user_id == user_id))
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=404, detail="Income not found")

    old_wallet = await session.get(Wallet, income.wallet_id)
    old_amount = income.amount

    for field, value in data.dict(exclude_unset=True).items():
        setattr(income, field, value)

    if data.amount is not None and data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    if data.wallet_id and data.wallet_id != old_wallet.id:
        new_wallet = await session.get(Wallet, data.wallet_id)
        if not new_wallet or new_wallet.user_id != user_id:
            raise HTTPException(status_code=404, detail="New wallet not found")

        old_wallet.balance -= old_amount
        if old_wallet.balance < 0:
            raise HTTPException(status_code=400, detail=f"Insufficient balance in source wallet.")

        new_amount = Decimal(str(data.amount)) if data.amount is not None else income.amount
        new_wallet.balance += new_amount
    else:
        new_amount = Decimal(str(data.amount)) if data.amount is not None else income.amount
        diff = new_amount - old_amount
        new_balance = old_wallet.balance + diff
        if new_balance < 0:
            raise HTTPException(status_code=400, detail="Insufficient balance.")
        old_wallet.balance = new_balance

    await session.commit()

    result = await session.execute(
        select(Income).options(selectinload(Income.wallet), selectinload(Income.income_type)).where(Income.id == income.id)
    )
    return result.scalar_one()


async def delete_income(session: AsyncSession, income_id: int, user_id: int):
    result = await session.execute(select(Income).where(Income.id == income_id, Income.user_id == user_id))
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=404, detail="Income not found")

    wallet = await session.get(Wallet, income.wallet_id)
    if wallet and wallet.user_id == user_id:
        new_balance = wallet.balance - income.amount
        if new_balance < 0:
            raise HTTPException(status_code=400, detail="Cannot delete income. Wallet balance would become negative.")
        wallet.balance = new_balance

    await session.delete(income)
    await session.commit()
    return {"message": "Income deleted"}
