"""User-facing content reporting (`POST /reports`).

Anyone authenticated can report a user/group/expense/message. Admin review lives in
routers/admin.py (`/admin/reports`). Shared repository: repositories/moderation.py.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.auth import get_current_user
from app.models import User
from app import schemas
from app.repositories import moderation as moderation_repo
from app.routers.notifications import send_notification

router = APIRouter(prefix="/reports", tags=["Moderation"])


@router.post("", response_model=schemas.ReportRead)
async def submit_report(
    payload: schemas.ReportCreate,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user),
):
    report = await moderation_repo.create_report(
        session, current, payload.target_type, payload.target_id, payload.reason, payload.description,
    )
    for mid in await moderation_repo.get_moderator_ids(session):
        if mid and mid != current.id:
            await send_notification(
                session, mid, f"New {payload.reason.replace('_', ' ')} report",
                type="moderation", link=f"/admin/moderation/{report.id}",
            )
    return moderation_repo.report_to_dict(report, current.username, None)
