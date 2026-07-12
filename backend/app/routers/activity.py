from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db import get_session
from app.models import ActivityLog, User
from app.schemas import ActivityLogOut

router = APIRouter(prefix="/activity")

@router.get("", response_model=list[ActivityLogOut])
async def get_activity(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ActivityLog)
        .options(selectinload(ActivityLog.user).selectinload(User.role))
        .where(ActivityLog.user_id == current.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()