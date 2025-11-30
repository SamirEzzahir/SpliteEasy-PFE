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
        .options(selectinload(ActivityLog.user).selectinload(User.role))
        .order_by(ActivityLog.created_at.desc())
        .limit(50)
    )
    logs = result.scalars().all()

    # Only keep logs where current user is the actor or the target is relevant
    filtered_logs = []
    for log in logs:
        include = False
        if log.user_id == current.id:
            include = True
        elif log.target_type == "expense":
            result = await session.execute(
                select(Expense)
                .options(selectinload(Expense.splits))
                .where(Expense.id == log.target_id)
            )
            expense = result.scalars().first()
            if expense:
                participant_ids = [expense.payer_id] + [s.user_id for s in expense.splits]
                if current.id in participant_ids:
                    include = True
        elif log.target_type == "group":
            result = await session.execute(
                select(Group)
                .options(selectinload(Group.memberships))
                .where(Group.id == log.target_id)
            )
            group = result.scalars().first()
            if group and current.id in [m.user_id for m in group.memberships]:
                include = True

        if include:
            filtered_logs.append(log)

    return filtered_logs