# backend/routes/dashboard.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db import get_session
from backend.auth import get_current_user
from backend.crud import get_user_incomes, get_expenses_for_group
from sqlalchemy import Float, select, func
from backend.models import Expense, Group, Income
from backend.schemas import UserRead

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary")
async def dashboard_summary(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user)
):
   # Total incomes
    stmt_income = select(func.coalesce(func.sum(Income.amount), 0))
    stmt_income = stmt_income.where(Income.user_id == current_user.id)
    income_result = await session.execute(stmt_income)
    total_income = float(income_result.scalar() or 0)  # <-- convert to float
    
    # Total expenses
    stmt_expense = select(func.coalesce(func.sum(Expense.amount), 0)).join(Group)
    stmt_expense = stmt_expense.where(Expense.payer_id == current_user.id)
    expense_result = await session.execute(stmt_expense)
    total_expense = float(expense_result.scalar() or 0)  # <-- convert to float
    
    # Net balance
    net_balance = total_income - total_expense

    # Recent expenses (last 5)
    stmt_recent = (
        select(Expense.description, Expense.amount, Expense.currency, Expense.created_at)
        .where(Expense.payer_id == current_user.id)
        .order_by(Expense.created_at.desc())
        .limit(5)
    )
    recent_result = await session.execute(stmt_recent)
    recent_expenses = [dict(r._mapping) for r in recent_result]

    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "net_balance": net_balance,
        "recent_expenses": recent_expenses
    }