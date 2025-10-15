from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.db import get_session
from backend.models import User, Group, Expense, Membership, Split
from backend.auth import get_current_user

router = APIRouter(prefix="/stats", tags=["Statistics"])


# 🔹 Total expenses created by the current user
@router.get("/user")
async def stats_user_expenses(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    result = await session.execute(
        select(func.sum(Split.share_amount)).where(Split.user_id == current.id)
    )
    total = result.scalar() or 0
    return {"user_id": current.id, "username": current.username, "total_expenses": float(total)}


# 🔹 Expenses per group for the current user
@router.get("/user/groups")
async def stats_user_groups(
    from_date: str | None = None,
    to_date: str | None = None,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    query = (
    select(
        Group.id,
        Group.title,
        func.sum(Split.share_amount).label("amount")
    )
    .join(Expense, Expense.group_id == Group.id)
    .join(Split, Split.expense_id == Expense.id)
    .where(Split.user_id == current.id)  # ✅ only current user's share
)


    if from_date:
        query = query.where(Expense.created_at >= datetime.fromisoformat(from_date))
    if to_date:
        to_dt = datetime.fromisoformat(to_date) + timedelta(days=1)  # include full day
        query = query.where(Expense.created_at < to_dt)

    query = query.group_by(Group.id, Group.title)
    result = await session.execute(query)
    rows = result.fetchall()

    return [
        {"group_id": gid, "group_name": gname, "amount": float(total or 0)}
        for gid, gname, total in rows
    ]



# 🔹 Daily expense stats (MySQL-compatible)
@router.get("/user/daily")
async def stats_user_daily(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    result = await session.execute(
        select(func.date(Expense.created_at), func.sum(Split.share_amount))
        .join(Expense, Expense.id == Split.expense_id)
        .where(Split.user_id == current.id)
        .group_by(func.date(Expense.created_at))
        .order_by(func.date(Expense.created_at))
    )

    return [
        {"date": d[0].isoformat(), "amount": float(d[1])}
        for d in result.all()
    ]

