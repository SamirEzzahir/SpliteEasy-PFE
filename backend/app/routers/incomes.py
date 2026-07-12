from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Income
from app.schemas import IncomeCreate, IncomeRead, IncomeReadWithNames, IncomeUpdate
from app.db import get_session
from app.crud import add_income, delete_income, get_user_incomes, get_balance_summary, update_income
from app.auth import get_current_user

router = APIRouter(prefix="/incomes", tags=["Incomes"])

@router.post("", response_model=IncomeRead)
async def create_income(
    income_data: IncomeCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user)
):
    return await add_income(session,  current_user.id, income_data,)


@router.get("", response_model=list[IncomeReadWithNames])
async def list_incomes(session: AsyncSession = Depends(get_session), current_user=Depends(get_current_user)):
    return await get_user_incomes(session, current_user.id)


@router.get("/summary")
async def income_summary(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user)
):
    return await get_balance_summary(session, current_user.id)

@router.put("/{income_id}", response_model=IncomeRead)
async def edit_income(
    income_id: int,
    income_data: IncomeUpdate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user)
):
    return await update_income(session, income_id, current_user.id, income_data)


@router.delete("/{income_id}")
async def remove_income(
    income_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user)
):
    return await delete_income(session, income_id, current_user.id)

