"""User-facing support portal (`/support`).

Authenticated users create and follow their own tickets. Admin-side management lives
in routers/admin.py (`/admin/tickets`). Both share repositories/support.py.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.auth import get_current_user
from app.models import User
from app import schemas
from app.repositories import support as support_repo
from app.routers.notifications import send_notification

router = APIRouter(prefix="/support", tags=["Support"])


def _pages(total: int, page_size: int) -> int:
    return (total + page_size - 1) // page_size if page_size else 0


async def _notify_support_admins(session: AsyncSession, ticket, message: str, exclude_id: Optional[int] = None):
    admin_ids = await support_repo.get_support_admin_ids(session)
    for aid in admin_ids:
        if aid and aid != exclude_id:
            await send_notification(session, aid, message, type="support", link=f"/admin/support/{ticket.id}")


@router.post("/tickets", response_model=schemas.TicketDetail)
async def create_ticket(
    payload: schemas.TicketCreate,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user),
):
    ticket = await support_repo.create_ticket(
        session, current, payload.subject, payload.message, payload.category, payload.priority,
    )
    await _notify_support_admins(session, ticket, f"New support ticket: {ticket.subject}", exclude_id=current.id)
    full = await support_repo.get_ticket(session, ticket.id)
    return support_repo.detail_dict(full)


@router.get("/tickets", response_model=schemas.Paginated[schemas.TicketRead])
async def my_tickets(
    page: int = 1, page_size: int = 20,
    status: Optional[str] = None, category: Optional[str] = None, q: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user),
):
    page = max(1, page); page_size = max(1, min(page_size, 100))
    items, total = await support_repo.list_tickets(
        session, requester_id=current.id, status=status, category=category, q=q,
        page=page, page_size=page_size,
    )
    return schemas.Paginated[schemas.TicketRead](
        items=items, total=total, page=page, page_size=page_size, pages=_pages(total, page_size),
    )


async def _owned_ticket(session: AsyncSession, ticket_id: int, current: User):
    ticket = await support_repo.get_ticket(session, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.user_id != current.id:
        raise HTTPException(status_code=403, detail="This ticket isn't yours")
    return ticket


@router.get("/tickets/{ticket_id}", response_model=schemas.TicketDetail)
async def get_my_ticket(
    ticket_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user),
):
    ticket = await _owned_ticket(session, ticket_id, current)
    return support_repo.detail_dict(ticket)


@router.post("/tickets/{ticket_id}/replies", response_model=schemas.TicketReplyRead)
async def reply_to_ticket(
    ticket_id: int, payload: schemas.TicketReplyCreate,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user),
):
    ticket = await _owned_ticket(session, ticket_id, current)
    if ticket.status.value == "closed":
        raise HTTPException(status_code=400, detail="This ticket is closed. Open a new one.")
    reply = await support_repo.add_reply(session, ticket, current, payload.body, is_admin=False)
    # A user reply reopens a ticket that was waiting on them or already resolved.
    if ticket.status.value in ("waiting_user", "resolved"):
        await support_repo.set_status(session, ticket, "in_progress")
    # Notify the assignee, or all support admins if unassigned.
    if ticket.assigned_to_id:
        await send_notification(session, ticket.assigned_to_id, f"New reply on ticket: {ticket.subject}", type="support", link=f"/admin/support/{ticket.id}")
    else:
        await _notify_support_admins(session, ticket, f"New reply on ticket: {ticket.subject}", exclude_id=current.id)
    return {
        "id": reply.id, "author_id": current.id, "author_username": current.username,
        "is_admin": False, "body": reply.body, "created_at": reply.created_at,
    }


@router.post("/tickets/{ticket_id}/close")
async def close_my_ticket(
    ticket_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user),
):
    ticket = await _owned_ticket(session, ticket_id, current)
    await support_repo.set_status(session, ticket, "closed")
    return {"message": "Ticket closed"}
