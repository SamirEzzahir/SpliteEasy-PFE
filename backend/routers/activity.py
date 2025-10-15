from email.headerregistry import Group
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_user
from backend.db import get_session
from backend.models import ActivityLog, Expense, User
from backend.schemas import ActivityLogOut

router = APIRouter(prefix="/activity")

@router.get("", response_model=list[ActivityLogOut])
async def get_activity(current: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(ActivityLog)
        .options(joinedload(ActivityLog.user))
        .order_by(ActivityLog.created_at.desc())
        .limit(50)
    )
    logs = result.scalars().all()

    # Only keep logs where current user is the actor or the target is relevant
    filtered_logs = []
    for log in logs:
        include = False
        if log.user_id == current.id:
            include = True  # user performed the action
        elif log.target_type == "expense":
            # Check if user is part of the expense
            expense = await session.get(Expense, log.target_id)
            if expense:
                participant_ids = [expense.payer_id] + [s.user_id for s in expense.splits]
                if current.id in participant_ids:
                    include = True
        elif log.target_type == "group":
            group = await session.get(Group, log.target_id)
            if group and current.id in [m.user_id for m in group.memberships]:
                include = True
        if include:
            filtered_logs.append(log)

    return [
        {
            "user_id": log.user_id,
            "username": log.user.username if log.user else "Unknown",
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "created_at": log.created_at,
        }
        for log in filtered_logs
    ]