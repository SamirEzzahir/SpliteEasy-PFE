from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_user
from backend.db import get_session
from backend.models import ActivityLog, Expense, User, Group
from backend.schemas import ActivityLogOut

router = APIRouter(prefix="/activity")

@router.get("", response_model=list[ActivityLogOut])
async def get_activity(current: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(ActivityLog)
        .options(selectinload(ActivityLog.user))
        .where(ActivityLog.user_id == current.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(20)
    )
    return result.scalars().all()