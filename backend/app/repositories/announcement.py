"""Data-access for announcements."""
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import Announcement, User


def to_dict(a: Announcement, author_username=None) -> dict:
    return {
        "id": a.id, "title": a.title, "body": a.body, "type": a.type,
        "visibility": a.visibility, "delivery": a.delivery,
        "publish_at": a.publish_at, "expires_at": a.expires_at,
        "is_published": a.is_published, "created_by": a.created_by,
        "author_username": author_username, "created_at": a.created_at, "updated_at": a.updated_at,
    }


async def list_announcements(session: AsyncSession, page: int = 1, page_size: int = 20) -> tuple[list[dict], int]:
    page = max(1, page); page_size = max(1, min(page_size, 100))
    total = (await session.execute(select(func.count()).select_from(Announcement))).scalar_one()
    author = aliased(User)
    rows = (await session.execute(
        select(Announcement, author.username)
        .outerjoin(author, Announcement.created_by == author.id)
        .order_by(Announcement.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).all()
    return [to_dict(a, au) for a, au in rows], total


async def get(session: AsyncSession, announcement_id: int) -> Optional[Announcement]:
    return await session.get(Announcement, announcement_id)


async def active_for_user(session: AsyncSession, user: User, is_admin: bool) -> list[dict]:
    """Banner/popup announcements currently visible to this user."""
    now = datetime.utcnow()
    rows = (await session.execute(
        select(Announcement).where(
            Announcement.is_published == True,  # noqa: E712
            Announcement.delivery.in_(["banner", "popup"]),
            or_(Announcement.publish_at == None, Announcement.publish_at <= now),  # noqa: E711
            or_(Announcement.expires_at == None, Announcement.expires_at > now),  # noqa: E711
        ).order_by(Announcement.created_at.desc())
    )).scalars().all()

    out = []
    for a in rows:
        vis = a.visibility or "everyone"
        if vis == "everyone":
            ok = True
        elif vis == "admins":
            ok = is_admin
        elif vis.startswith("role:"):
            try:
                ok = user.role_id == int(vis.split(":", 1)[1])
            except (ValueError, IndexError):
                ok = False
        else:
            ok = True
        if ok:
            out.append({"id": a.id, "title": a.title, "body": a.body, "type": a.type, "delivery": a.delivery})
    return out


async def recipients_for(session: AsyncSession, ann: Announcement) -> list[int]:
    """User ids to fan a `notification`-delivery announcement out to."""
    vis = ann.visibility or "everyone"
    stmt = select(User.id).where(User.is_active == True)  # noqa: E712
    if vis == "admins":
        stmt = stmt.where(User.role_id != None)  # noqa: E711
    elif vis.startswith("role:"):
        try:
            stmt = stmt.where(User.role_id == int(vis.split(":", 1)[1]))
        except (ValueError, IndexError):
            return []
    return list((await session.execute(stmt)).scalars().all())
