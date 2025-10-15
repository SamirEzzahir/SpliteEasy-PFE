from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from ..db import get_session
from .. import schemas, crud
from ..models import Expense, User
from ..auth import get_current_user
from ..debt import minimize_cash_flow
from ..crud import get_expense_ById, get_expenses_for_group,ensure_user_in_group,add_expense, log_activity,update_expense

router = APIRouter(prefix="/expenses")

@router.post("", response_model=schemas.ExpenseRead)
async def create_expense_ep(payload: schemas.ExpenseCreate, session: AsyncSession = Depends(get_session), current: User = Depends(get_current_user)):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    if not payload.payer_id:
        payload.payer_id = current.id
    exp = await add_expense(session, payload, [(s.user_id, s.share_amount) for s in payload.splits])
    return schemas.ExpenseRead.model_validate(exp)

@router.get("/{group_id}", response_model=list[schemas.ExpenseRead])
async def get_group_expenses(group_id: int, session: AsyncSession = Depends(get_session),current: User = Depends(get_current_user)):
    # ✅ Check membership
    await ensure_user_in_group(session, current.id, group_id)
    return await get_expenses_for_group(session, group_id, current)

@router.get("/exp/{expense_id}", response_model=schemas.ExpenseRead)
async def get_expense(expense_id: int,
                      session: AsyncSession = Depends(get_session),
                      current: User = Depends(get_current_user)):
    return await get_expense_ById(session, expense_id, current)


 

# ✅ Update Expense
@router.put("/{expense_id}", response_model=schemas.ExpenseRead)
async def update_expense_ep(
    expense_id: int,
    payload: schemas.ExpenseUpdate,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user),
):
    return await update_expense(session, expense_id, payload, current)


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: int, 
    session: AsyncSession = Depends(get_session), 
    current: User = Depends(get_current_user)
):
    # Fetch the expense with the group eagerly loaded
    result = await session.execute(
        select(Expense).where(Expense.id == expense_id).options(selectinload(Expense.group))
    )
    expense = result.scalars().first()

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if expense.payer_id != current.id:
        raise HTTPException(status_code=403, detail="Not allowed to delete")

    # Log the deletion
    await log_activity(
    session,
    user_id=current.id,
    action=f"deleted '{expense.description}' in '{expense.group.title}'",
    target_type="expense",
    target_id=expense.id
)

    # Delete the expense
    await session.delete(expense)
    await session.commit()
