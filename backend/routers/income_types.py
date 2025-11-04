from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend.models import IncomeType, Wallet
from backend.db import get_session
from backend.auth import get_current_user
from backend.schemas import IncomeTypeCreate, IncomeTypeRead, IncomeTypeUpdate

router = APIRouter(prefix="/incometype", tags=["incomeType"])

@router.post("/", response_model=IncomeTypeRead)
async def create_income_type(data: IncomeTypeCreate, session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    income_type = IncomeType(user_id=user.id, **data.dict())
    session.add(income_type)
    await session.commit()
    await session.refresh(income_type)
    return income_type

@router.get("/", response_model=list[IncomeTypeRead])
async def list_income_types(session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    result = await session.execute(
        select(IncomeType).filter((IncomeType.user_id == user.id) | (IncomeType.user_id == None))
    )
    return result.scalars().all()

@router.put("/{type_id}", response_model=IncomeTypeRead)
async def update_income_type(type_id: int, data: IncomeTypeUpdate, session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    income_type = await session.get(IncomeType, type_id)
    if not income_type or income_type.user_id != user.id:
        raise HTTPException(status_code=404, detail="Income type not found")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(income_type, key, value)
    await session.commit()
    await session.refresh(income_type)
    return income_type

@router.delete("/{type_id}")
async def delete_income_type(type_id: int, session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    income_type = await session.get(IncomeType, type_id)
    if not income_type or income_type.user_id != user.id:
        raise HTTPException(status_code=404, detail="Income type not found")
    await session.delete(income_type)
    await session.commit()
    return {"message": "Deleted"}
