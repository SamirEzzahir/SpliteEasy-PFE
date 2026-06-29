"""User-facing announcements (`GET /announcements/active`).

Returns the banner/popup announcements currently visible to the signed-in user.
Admin CRUD lives in routers/admin.py (`/admin/announcements`).
"""
import json

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.db import get_session
from backend.core.auth import get_current_user
from backend.models import User
from backend import schemas
from backend.repositories import announcement as announcement_repo

router = APIRouter(prefix="/announcements", tags=["Announcements"])


@router.get("/active", response_model=list[schemas.ActiveAnnouncement])
async def active_announcements(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user),
):
    is_admin = False
    if current.role and current.role.permissions:
        try:
            is_admin = bool(json.loads(current.role.permissions))
        except Exception:
            is_admin = False
    return await announcement_repo.active_for_user(session, current, is_admin)
