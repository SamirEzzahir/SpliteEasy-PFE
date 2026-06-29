"""Data-access for moderation reports."""
from typing import Optional

from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from backend.models import ModerationReport, User, Role


def report_to_dict(r: ModerationReport, reporter_username=None, handler_username=None, target_username=None) -> dict:
    return {
        "id": r.id, "reporter_id": r.reporter_id, "reporter_username": reporter_username,
        "target_type": r.target_type, "target_id": r.target_id, "target_username": target_username,
        "reason": r.reason, "description": r.description,
        "status": r.status, "notes": r.notes,
        "handled_by": r.handled_by, "handled_by_username": handler_username,
        "created_at": r.created_at, "updated_at": r.updated_at,
    }


async def create_report(session: AsyncSession, reporter: User, target_type: str, target_id: int, reason: str, description: Optional[str]) -> ModerationReport:
    report = ModerationReport(
        reporter_id=reporter.id, target_type=target_type, target_id=target_id,
        reason=reason, description=description, status="open",
    )
    session.add(report)
    await session.commit()
    await session.refresh(report)
    return report


async def list_reports(
    session: AsyncSession, *, status: Optional[str] = None, reason: Optional[str] = None,
    target_type: Optional[str] = None, q: Optional[str] = None, page: int = 1, page_size: int = 20,
) -> tuple[list[dict], int]:
    page = max(1, page); page_size = max(1, min(page_size, 100))
    filters = []
    if status:
        filters.append(ModerationReport.status == status)
    if reason:
        filters.append(ModerationReport.reason == reason)
    if target_type:
        filters.append(ModerationReport.target_type == target_type)
    if q:
        filters.append(ModerationReport.description.ilike(f"%{q.strip()}%"))

    total = (await session.execute(
        select(func.count()).select_from(ModerationReport).where(*filters)
    )).scalar_one()

    reporter = aliased(User)
    handler = aliased(User)
    target_user = aliased(User)
    rows = (await session.execute(
        select(ModerationReport, reporter.username, handler.username, target_user.username)
        .outerjoin(reporter, ModerationReport.reporter_id == reporter.id)
        .outerjoin(handler, ModerationReport.handled_by == handler.id)
        .outerjoin(target_user, and_(ModerationReport.target_type == "user", ModerationReport.target_id == target_user.id))
        .where(*filters)
        .order_by(ModerationReport.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).all()
    items = [report_to_dict(r, ru, hu, tu) for r, ru, hu, tu in rows]
    return items, total


async def get_report(session: AsyncSession, report_id: int) -> Optional[ModerationReport]:
    return (await session.execute(
        select(ModerationReport)
        .where(ModerationReport.id == report_id)
        .options(selectinload(ModerationReport.reporter), selectinload(ModerationReport.handler))
    )).scalar_one_or_none()


async def set_status(session: AsyncSession, report: ModerationReport, status: str, handler: User) -> ModerationReport:
    report.status = status
    report.handled_by = handler.id
    await session.commit()
    await session.refresh(report)
    return report


async def set_notes(session: AsyncSession, report: ModerationReport, notes: str) -> ModerationReport:
    report.notes = notes
    await session.commit()
    await session.refresh(report)
    return report


async def get_moderator_ids(session: AsyncSession) -> list[int]:
    role_ids = (await session.execute(
        select(Role.id).where(or_(
            Role.permissions.like('%"*"%'),
            Role.permissions.like('%"manage_moderation"%'),
        ))
    )).scalars().all()
    if not role_ids:
        return []
    return list((await session.execute(
        select(User.id).where(User.role_id.in_(role_ids), User.is_active == True)  # noqa: E712
    )).scalars().all())
