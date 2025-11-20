from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db import get_session
from backend import schemas, crud
from backend.auth import get_current_user
from backend.models import User, GlobalSettlementMode

router = APIRouter(prefix="/users")

@router.get("/", response_model=list[schemas.UserRead])
async def fetch_users(session: AsyncSession = Depends(get_session), current=Depends(get_current_user)):
    users = await crud.get_users(session)
    return [schemas.UserRead.model_validate(u, from_attributes=True) for u in users]

@router.get("/{user_id}", response_model=schemas.UserRead)
async def fetch_user(user_id: int, session: AsyncSession = Depends(get_session), current=Depends(get_current_user)):
    user = await crud.get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return schemas.UserRead.model_validate(user)

@router.get("/user/me", response_model=schemas.UserRead)
async def fetch_current_user(current: User = Depends(get_current_user)):
    return schemas.UserRead.model_validate(current, from_attributes=True)


@router.put("/user/me/global-settlement-mode", response_model=schemas.UserRead)
async def update_global_settlement_mode(
    payload: dict,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """Update the user's global settlement mode preference."""
    mode_value = payload.get("mode", "separate")
    try:
        current.global_settlement_mode = GlobalSettlementMode(mode_value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid mode: {mode_value}. Must be one of: separate, auto_adjust, hybrid")
    await session.commit()
    await session.refresh(current)
    return schemas.UserRead.model_validate(current, from_attributes=True)


@router.put("/{user_id}", response_model=schemas.UserRead)
async def edit_user(user_id: int, payload: schemas.UserUpdate, session: AsyncSession = Depends(get_session), current=Depends(get_current_user)):
    updated = await crud.update_user(session, user_id, payload.dict(exclude_unset=True))
    return schemas.UserRead.model_validate(updated)




"""
@router.delete("/{user_id}", status_code=204)
async def remove_user(user_id: int, session: AsyncSession = Depends(get_session), current=Depends(get_current_user)):
    await crud.delete_user(session, user_id)
    return
"""

@router.delete("/{user_id}", response_model=dict)
async def deactivate_user(user_id: int, session: AsyncSession = Depends(get_session), current=Depends(get_current_user)):
    await crud.delete_user(session, user_id)
    return {"detail": "User deactivated"}