"""Data-access layer for support tickets (the `reclamations` table + replies).

Shared by the user portal (`routers/support.py`) and the admin panel
(`routers/admin.py`). List helpers return ``(items, total)``.
"""
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.models import Reclamation, TicketReply, User, Role, ReclamationStatus


def _status_str(status) -> str:
    return status.value if hasattr(status, "value") else str(status)


def _read_dict(t: Reclamation, requester_username, assignee_username, reply_count: int) -> dict:
    return {
        "id": t.id, "subject": t.subject, "category": t.category, "priority": t.priority,
        "status": _status_str(t.status), "user_id": t.user_id,
        "requester_username": requester_username,
        "assigned_to_id": t.assigned_to_id, "assignee_username": assignee_username,
        "reply_count": reply_count, "created_at": t.created_at, "updated_at": t.updated_at,
    }


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------
async def list_tickets(
    session: AsyncSession, *,
    requester_id: Optional[int] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to_id: Optional[int] = None,
    q: Optional[str] = None,
    page: int = 1, page_size: int = 20,
) -> tuple[list[dict], int]:
    page = max(1, page)
    page_size = max(1, min(page_size, 100))

    filters = []
    if requester_id is not None:
        filters.append(Reclamation.user_id == requester_id)
    if status:
        try:
            filters.append(Reclamation.status == ReclamationStatus(status))
        except ValueError:
            pass
    if category:
        filters.append(Reclamation.category == category)
    if priority:
        filters.append(Reclamation.priority == priority)
    if assigned_to_id is not None:
        filters.append(Reclamation.assigned_to_id == assigned_to_id)
    if q:
        like = f"%{q.strip()}%"
        filters.append(or_(Reclamation.subject.ilike(like), Reclamation.message.ilike(like)))

    total = (await session.execute(
        select(func.count()).select_from(Reclamation).where(*filters)
    )).scalar_one()

    requester = aliased(User)
    assignee = aliased(User)
    replies_sq = (
        select(TicketReply.reclamation_id, func.count().label("c"))
        .group_by(TicketReply.reclamation_id).subquery()
    )
    rows = (await session.execute(
        select(Reclamation, requester.username, assignee.username, func.coalesce(replies_sq.c.c, 0))
        .outerjoin(requester, Reclamation.user_id == requester.id)
        .outerjoin(assignee, Reclamation.assigned_to_id == assignee.id)
        .outerjoin(replies_sq, replies_sq.c.reclamation_id == Reclamation.id)
        .where(*filters)
        .order_by(Reclamation.updated_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).all()

    items = [_read_dict(t, req, asg, rc) for t, req, asg, rc in rows]
    return items, total


async def get_ticket(session: AsyncSession, ticket_id: int) -> Optional[Reclamation]:
    return (await session.execute(
        select(Reclamation)
        .where(Reclamation.id == ticket_id)
        .options(
            selectinload(Reclamation.user),
            selectinload(Reclamation.assignee),
            selectinload(Reclamation.replies).selectinload(TicketReply.author),
        )
    )).scalar_one_or_none()


def detail_dict(t: Reclamation) -> dict:
    base = _read_dict(
        t,
        t.user.username if t.user else None,
        t.assignee.username if t.assignee else None,
        len(t.replies),
    )
    base["message"] = t.message
    base["replies"] = [{
        "id": r.id, "author_id": r.author_id,
        "author_username": r.author.username if r.author else None,
        "is_admin": r.is_admin, "body": r.body, "created_at": r.created_at,
    } for r in t.replies]
    return base


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------
async def create_ticket(session: AsyncSession, user: User, subject: str, message: str, category: str, priority: str) -> Reclamation:
    ticket = Reclamation(
        user_id=user.id, subject=subject, message=message,
        category=category, priority=priority, status=ReclamationStatus.open,
    )
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return ticket


async def add_reply(session: AsyncSession, ticket: Reclamation, author: User, body: str, is_admin: bool) -> TicketReply:
    from datetime import datetime
    reply = TicketReply(reclamation_id=ticket.id, author_id=author.id, body=body, is_admin=is_admin)
    session.add(reply)
    # Touch the ticket so it bubbles to the top of activity-ordered lists.
    ticket.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(reply)
    return reply


async def set_status(session: AsyncSession, ticket: Reclamation, status: str) -> Reclamation:
    ticket.status = ReclamationStatus(status)
    await session.commit()
    await session.refresh(ticket)
    return ticket


async def set_priority(session: AsyncSession, ticket: Reclamation, priority: str) -> Reclamation:
    ticket.priority = priority
    await session.commit()
    await session.refresh(ticket)
    return ticket


async def assign(session: AsyncSession, ticket: Reclamation, assignee_id: Optional[int]) -> Reclamation:
    ticket.assigned_to_id = assignee_id
    await session.commit()
    await session.refresh(ticket)
    return ticket


async def get_support_admin_ids(session: AsyncSession) -> list[int]:
    """User ids whose role grants support management (wildcard or manage_support)."""
    role_ids = (await session.execute(
        select(Role.id).where(or_(
            Role.permissions.like('%"*"%'),
            Role.permissions.like('%"manage_support"%'),
        ))
    )).scalars().all()
    if not role_ids:
        return []
    return list((await session.execute(
        select(User.id).where(User.role_id.in_(role_ids), User.is_active == True)  # noqa: E712
    )).scalars().all())
