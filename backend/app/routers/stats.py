from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db import get_session
from app.models import User, Group, Expense, Membership, Split
from app.auth import get_current_user

router = APIRouter(prefix="/stats", tags=["Statistics"])


# 🔹 Global expenses by group (for overview page)
@router.get("/groups")
async def stats_groups(
    user_id: int | None = Query(None, description="Filter by specific user ID"),
    time_range: str | None = Query("monthly", description="Time range: daily, monthly, yearly, lifetime"),
    from_date: str | None = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: str | None = Query(None, description="End date (YYYY-MM-DD)"),
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """Get expense statistics grouped by group for overview page"""
    
    # Base query
    query = (
        select(
            Group.id,
            Group.title.label("group_name"),
            func.sum(Split.share_amount).label("amount")
        )
        .join(Expense, Expense.group_id == Group.id)
        .join(Split, Split.expense_id == Expense.id)
    )
    
    # Filter by user if specified
    if user_id:
        query = query.where(Split.user_id == user_id)
    else:
        # If no user specified, show all users' expenses
        # Only show groups where current user is a member
        query = query.join(Membership, Membership.group_id == Group.id)
        query = query.where(Membership.user_id == current.id)
    
    # Apply date filters
    if from_date:
        query = query.where(Expense.created_at >= datetime.fromisoformat(from_date))
    if to_date:
        to_dt = datetime.fromisoformat(to_date) + timedelta(days=1)
        query = query.where(Expense.created_at < to_dt)
    
    # Apply time range filter
    if time_range and not from_date and not to_date:
        now = datetime.now()
        if time_range == "daily":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif time_range == "monthly":
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif time_range == "yearly":
            start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:  # lifetime
            start_date = datetime(2020, 1, 1)  # Far back date
        
        query = query.where(Expense.created_at >= start_date)
    
    # Group by group and order by amount
    query = query.group_by(Group.id, Group.title).order_by(func.sum(Split.share_amount).desc())
    
    result = await session.execute(query)
    rows = result.fetchall()
    
    return [
        {
            "group_id": row.id,
            "group_name": row.group_name,
            "amount": float(row.amount or 0)
        }
        for row in rows
    ]


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
            Group.currency,
            func.sum(Split.share_amount).label("amount")
        )
        .join(Expense, Expense.group_id == Group.id)
        .join(Split, Split.expense_id == Expense.id)
        .where(Split.user_id == current.id)
    )

    if from_date:
        query = query.where(Expense.created_at >= datetime.fromisoformat(from_date))
    if to_date:
        to_dt = datetime.fromisoformat(to_date) + timedelta(days=1)
        query = query.where(Expense.created_at < to_dt)

    query = query.group_by(Group.id, Group.title, Group.currency)
    result = await session.execute(query)
    rows = result.fetchall()

    return [
        {"group_id": gid, "group_name": gname, "group_currency": gcurrency, "amount": float(total or 0)}
        for gid, gname, gcurrency, total in rows
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

# 🔹 Category expense stats for the current user
@router.get("/user/categories")
async def stats_user_categories(
    from_date: str | None = None,
    to_date: str | None = None,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    query = (
        select(
            Expense.category,
            func.sum(Split.share_amount).label("amount")
        )
        .join(Expense, Expense.id == Split.expense_id)
        .where(Split.user_id == current.id)
        .where(Expense.category.isnot(None))  # Only include expenses with categories
    )

    if from_date:
        query = query.where(Expense.created_at >= datetime.fromisoformat(from_date))
    if to_date:
        to_dt = datetime.fromisoformat(to_date) + timedelta(days=1)  # include full day
        query = query.where(Expense.created_at < to_dt)

    query = query.group_by(Expense.category)
    result = await session.execute(query)
    rows = result.fetchall()

    return [
        {"category": category or "Uncategorized", "amount": float(total or 0)}
        for category, total in rows
    ]

