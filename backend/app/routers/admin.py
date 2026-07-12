"""Admin panel API.

Every write action is guarded by a specific permission (see core/dependencies
.require_permission) and recorded in the admin audit log. Read endpoints return
the shared Paginated envelope. Super Admin holds the "*" wildcard permission.
"""
import json
import time
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_session
from app.core.dependencies import require_permission
from app.models import (
    User, Role, Reclamation, ReclamationStatus,
    Group, Membership, Expense, Settlement, SettlementStatus,
)
from app import schemas
from app.repositories import admin as admin_repo
from app.repositories import support as support_repo
from app.repositories import moderation as moderation_repo
from app.repositories import announcement as announcement_repo
from app.services import admin as admin_service
from app.routers.notifications import send_notification, active_connections
from app.core import settings_store

_PROCESS_START = time.time()

router = APIRouter(prefix="/admin", tags=["Admin"])


def _pages(total: int, page_size: int) -> int:
    return (total + page_size - 1) // page_size if page_size else 0


def _clamp(page: int, page_size: int) -> tuple[int, int]:
    return max(1, page), max(1, min(page_size, 100))


def _naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Coerce a (possibly tz-aware) datetime to naive UTC for TIMESTAMP columns."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        from datetime import timezone
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


# ===========================================================================
# Permission catalog (used by the Roles editor)
# ===========================================================================
PERMISSION_CATALOG = [
    {"key": "view_dashboard",      "label": "View dashboard",        "group": "Dashboard"},
    {"key": "view_users",          "label": "View users",            "group": "Users"},
    {"key": "manage_users",        "label": "Manage users",          "group": "Users"},
    {"key": "view_groups",         "label": "View groups",           "group": "Groups"},
    {"key": "manage_groups",       "label": "Manage groups",         "group": "Groups"},
    {"key": "view_expenses",       "label": "View expenses",         "group": "Expenses"},
    {"key": "manage_expenses",     "label": "Manage expenses",       "group": "Expenses"},
    {"key": "view_settlements",    "label": "View settlements",      "group": "Settlements"},
    {"key": "manage_settlements",  "label": "Manage settlements",    "group": "Settlements"},
    {"key": "view_support",        "label": "View support tickets",  "group": "Support"},
    {"key": "manage_support",      "label": "Manage support tickets","group": "Support"},
    {"key": "view_roles",          "label": "View roles",            "group": "Roles"},
    {"key": "manage_roles",        "label": "Manage roles",          "group": "Roles"},
    {"key": "view_audit_logs",     "label": "View audit logs",       "group": "Audit"},
    {"key": "view_settings",       "label": "View settings",         "group": "Platform"},
    {"key": "manage_settings",     "label": "Manage settings",       "group": "Platform"},
    {"key": "view_moderation",     "label": "View moderation",       "group": "Platform"},
    {"key": "manage_moderation",   "label": "Manage moderation",     "group": "Platform"},
    {"key": "view_announcements",  "label": "View announcements",    "group": "Platform"},
    {"key": "manage_announcements","label": "Manage announcements",  "group": "Platform"},
    {"key": "view_analytics",      "label": "View analytics",        "group": "Platform"},
    {"key": "view_system",         "label": "View system health",    "group": "Platform"},
]


@router.get("/permissions", response_model=schemas.PermissionCatalog)
async def get_permission_catalog(
    current_user: User = Depends(require_permission("view_roles")),
):
    return {"permissions": PERMISSION_CATALOG}


# ===========================================================================
# Dashboard
# ===========================================================================
@router.get("/stats/overview", response_model=schemas.DashboardStats)
async def stats_overview(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_dashboard")),
):
    return await admin_repo.dashboard_stats(session)


@router.get("/stats/recent-activity", response_model=schemas.Paginated[schemas.AuditLogRead])
async def stats_recent_activity(
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_dashboard")),
):
    items, total = await admin_repo.list_audit_logs(session, page=1, page_size=limit)
    return schemas.Paginated[schemas.AuditLogRead](
        items=items, total=total, page=1, page_size=limit, pages=_pages(total, limit),
    )


# ===========================================================================
# User management
# ===========================================================================
@router.get("/users", response_model=schemas.Paginated[schemas.AdminUserRead])
async def list_users(
    page: int = 1, page_size: int = 20,
    q: Optional[str] = None, status: Optional[str] = None, role_id: Optional[int] = None,
    sort: str = "created_at", order: str = "desc",
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_users")),
):
    page, page_size = _clamp(page, page_size)
    users, total = await admin_repo.list_users(
        session, page, page_size, q=q, status=status, role_id=role_id, sort=sort, order=order,
    )
    return schemas.Paginated[schemas.AdminUserRead](
        items=[schemas.AdminUserRead.model_validate(u) for u in users],
        total=total, page=page, page_size=page_size, pages=_pages(total, page_size),
    )


@router.get("/users/{user_id}", response_model=schemas.AdminUserDetail)
async def get_user(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_users")),
):
    detail = await admin_repo.get_user_detail(session, user_id)
    if not detail:
        raise HTTPException(status_code=404, detail="User not found")
    base = schemas.AdminUserRead.model_validate(detail["user"]).model_dump()
    return schemas.AdminUserDetail(
        **base,
        groups_count=detail["groups_count"],
        owned_groups_count=detail["owned_groups_count"],
        expenses_count=detail["expenses_count"],
        settlements_count=detail["settlements_count"],
    )


@router.put("/users/{user_id}", response_model=schemas.AdminUserRead)
async def update_user(
    user_id: int, payload: schemas.AdminUserUpdate, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_users")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(user, field, value)
    await session.commit()
    await session.refresh(user, attribute_names=["role"])
    await admin_service.record_audit(
        session, current_user, "user.update", "user", user_id,
        details=json.dumps(data), request=request,
    )
    return schemas.AdminUserRead.model_validate(user)


@router.post("/users/{user_id}/status")
async def update_user_status(
    user_id: int, payload: schemas.UserStatusUpdate, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_users")),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own status")
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        await admin_service.set_user_status(session, user, payload.status, payload.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await admin_service.record_audit(
        session, current_user, f"user.status.{payload.status}", "user", user_id,
        details=payload.reason, request=request,
    )
    return {"message": f"User '{user.username}' is now {payload.status}"}


@router.post("/users/{user_id}/role")
async def assign_role(
    user_id: int, payload: schemas.UserRoleUpdate, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_users")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    role = None
    if payload.role_id is not None:
        role = await session.get(Role, payload.role_id)
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
    user.role_id = payload.role_id
    await session.commit()
    await admin_service.record_audit(
        session, current_user, "user.role", "user", user_id,
        details=(role.name if role else "cleared"), request=request,
    )
    return {"message": f"Role updated for '{user.username}'"}


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int, payload: schemas.ResetPasswordIn, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_users")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    await admin_service.reset_password(session, user, payload.new_password)
    await admin_service.record_audit(
        session, current_user, "user.reset_password", "user", user_id, request=request,
    )
    return {"message": f"Password reset for '{user.username}'"}


@router.post("/users/{user_id}/force-logout")
async def force_logout_user(
    user_id: int, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_users")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await admin_service.force_logout(session, user)
    await admin_service.record_audit(
        session, current_user, "user.force_logout", "user", user_id, request=request,
    )
    return {"message": f"All sessions revoked for '{user.username}'"}


@router.post("/users/{user_id}/verify-email")
async def verify_user_email(
    user_id: int, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_users")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.email_verified = True
    await session.commit()
    await admin_service.record_audit(
        session, current_user, "user.verify_email", "user", user_id, request=request,
    )
    return {"message": f"Email verified for '{user.username}'"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_users")),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    username = user.username
    await session.delete(user)
    await session.commit()
    await admin_service.record_audit(
        session, current_user, "user.delete", "user", user_id, details=username, request=request,
    )
    return {"message": f"User '{username}' permanently deleted"}


# ===========================================================================
# Group management
# ===========================================================================
@router.get("/groups", response_model=schemas.Paginated[schemas.AdminGroupRead])
async def list_groups(
    page: int = 1, page_size: int = 20, q: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_groups")),
):
    page, page_size = _clamp(page, page_size)
    items, total = await admin_repo.list_groups(session, page, page_size, q=q)
    return schemas.Paginated[schemas.AdminGroupRead](
        items=items, total=total, page=page, page_size=page_size, pages=_pages(total, page_size),
    )


@router.get("/groups/{group_id}", response_model=schemas.AdminGroupRead)
async def get_group(
    group_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_groups")),
):
    group = await session.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    owner = await session.get(User, group.owner_id)
    members = (await session.execute(
        select(Membership).where(Membership.group_id == group_id)
    )).scalars().all()
    expenses_count = len((await session.execute(
        select(Expense.id).where(Expense.group_id == group_id)
    )).scalars().all())
    return schemas.AdminGroupRead(
        id=group.id, title=group.title, type=group.type, currency=group.currency,
        owner_id=group.owner_id, owner_username=owner.username if owner else None,
        members_count=len(members), expenses_count=expenses_count, created_at=group.created_at,
    )


@router.post("/groups/{group_id}/transfer-owner")
async def transfer_group_owner(
    group_id: int, payload: schemas.TransferOwnerIn, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_groups")),
):
    group = await session.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    new_owner = await session.get(User, payload.new_owner_id)
    if not new_owner:
        raise HTTPException(status_code=404, detail="New owner not found")
    group.owner_id = new_owner.id
    # Ensure the new owner is a member of the group.
    existing = (await session.execute(
        select(Membership).where(
            Membership.group_id == group_id, Membership.user_id == new_owner.id
        )
    )).scalar_one_or_none()
    if not existing:
        session.add(Membership(group_id=group_id, user_id=new_owner.id, is_admin=True))
    await session.commit()
    await admin_service.record_audit(
        session, current_user, "group.transfer_owner", "group", group_id,
        details=new_owner.username, request=request,
    )
    return {"message": f"Ownership of '{group.title}' transferred to '{new_owner.username}'"}


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: int, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_groups")),
):
    group = await session.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    title = group.title
    await session.delete(group)
    await session.commit()
    await admin_service.record_audit(
        session, current_user, "group.delete", "group", group_id, details=title, request=request,
    )
    return {"message": f"Group '{title}' deleted"}


# ===========================================================================
# Expense management
# ===========================================================================
@router.get("/expenses", response_model=schemas.Paginated[schemas.AdminExpenseRead])
async def list_expenses(
    page: int = 1, page_size: int = 20, q: Optional[str] = None, group_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_expenses")),
):
    page, page_size = _clamp(page, page_size)
    items, total = await admin_repo.list_expenses(session, page, page_size, q=q, group_id=group_id)
    return schemas.Paginated[schemas.AdminExpenseRead](
        items=items, total=total, page=page, page_size=page_size, pages=_pages(total, page_size),
    )


@router.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: int, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_expenses")),
):
    expense = await session.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    desc = expense.description
    await session.delete(expense)
    await session.commit()
    await admin_service.record_audit(
        session, current_user, "expense.delete", "expense", expense_id, details=desc, request=request,
    )
    return {"message": "Expense deleted"}


# ===========================================================================
# Settlement management
# ===========================================================================
@router.get("/settlements", response_model=schemas.Paginated[schemas.AdminSettlementRead])
async def list_settlements(
    page: int = 1, page_size: int = 20, status: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_settlements")),
):
    page, page_size = _clamp(page, page_size)
    items, total = await admin_repo.list_settlements(session, page, page_size, status=status)
    return schemas.Paginated[schemas.AdminSettlementRead](
        items=items, total=total, page=page, page_size=page_size, pages=_pages(total, page_size),
    )


@router.post("/settlements/{settlement_id}/cancel")
async def cancel_settlement(
    settlement_id: int, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_settlements")),
):
    settlement = await session.get(Settlement, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    settlement.status = SettlementStatus.rejected
    settlement.rejected_reason = "Cancelled by administrator"
    await session.commit()
    await admin_service.record_audit(
        session, current_user, "settlement.cancel", "settlement", settlement_id, request=request,
    )
    return {"message": "Settlement cancelled"}


# ===========================================================================
# Support center (tickets)
# ===========================================================================
async def _get_ticket_or_404(session, ticket_id: int):
    ticket = await support_repo.get_ticket(session, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.get("/tickets", response_model=schemas.Paginated[schemas.TicketRead])
async def list_tickets(
    page: int = 1, page_size: int = 20,
    status: Optional[str] = None, priority: Optional[str] = None,
    category: Optional[str] = None, assigned_to_id: Optional[int] = None, q: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_support")),
):
    page, page_size = _clamp(page, page_size)
    items, total = await support_repo.list_tickets(
        session, status=status, priority=priority, category=category,
        assigned_to_id=assigned_to_id, q=q, page=page, page_size=page_size,
    )
    return schemas.Paginated[schemas.TicketRead](
        items=items, total=total, page=page, page_size=page_size, pages=_pages(total, page_size),
    )


@router.get("/tickets/{ticket_id}", response_model=schemas.TicketDetail)
async def get_ticket(
    ticket_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_support")),
):
    ticket = await _get_ticket_or_404(session, ticket_id)
    return support_repo.detail_dict(ticket)


@router.post("/tickets/{ticket_id}/replies", response_model=schemas.TicketReplyRead)
async def reply_to_ticket(
    ticket_id: int, payload: schemas.TicketReplyCreate, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_support")),
):
    ticket = await _get_ticket_or_404(session, ticket_id)
    reply = await support_repo.add_reply(session, ticket, current_user, payload.body, is_admin=True)
    # An admin reply puts the ball in the user's court.
    if ticket.status.value not in ("resolved", "closed"):
        await support_repo.set_status(session, ticket, "waiting_user")
    await send_notification(
        session, ticket.user_id, f"Support replied to your ticket: {ticket.subject}",
        type="support", link=f"/support/{ticket.id}",
    )
    await admin_service.record_audit(session, current_user, "support.reply", "ticket", ticket_id, request=request)
    return {
        "id": reply.id, "author_id": current_user.id, "author_username": current_user.username,
        "is_admin": True, "body": reply.body, "created_at": reply.created_at,
    }


@router.post("/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: int, payload: schemas.TicketStatusUpdate, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_support")),
):
    ticket = await _get_ticket_or_404(session, ticket_id)
    await support_repo.set_status(session, ticket, payload.status)
    await send_notification(
        session, ticket.user_id, f"Your ticket '{ticket.subject}' is now {payload.status.replace('_', ' ')}",
        type="support", link=f"/support/{ticket.id}",
    )
    await admin_service.record_audit(session, current_user, "support.status", "ticket", ticket_id, details=payload.status, request=request)
    return {"message": f"Ticket status updated to {payload.status}"}


@router.post("/tickets/{ticket_id}/priority")
async def update_ticket_priority(
    ticket_id: int, payload: schemas.TicketPriorityUpdate, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_support")),
):
    ticket = await _get_ticket_or_404(session, ticket_id)
    await support_repo.set_priority(session, ticket, payload.priority)
    await admin_service.record_audit(session, current_user, "support.priority", "ticket", ticket_id, details=payload.priority, request=request)
    return {"message": f"Priority set to {payload.priority}"}


@router.post("/tickets/{ticket_id}/assign")
async def assign_ticket(
    ticket_id: int, payload: schemas.TicketAssign, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_support")),
):
    ticket = await _get_ticket_or_404(session, ticket_id)
    if payload.assignee_id is not None:
        assignee = await session.get(User, payload.assignee_id)
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee not found")
    await support_repo.assign(session, ticket, payload.assignee_id)
    await admin_service.record_audit(
        session, current_user, "support.assign", "ticket", ticket_id,
        details=str(payload.assignee_id) if payload.assignee_id else "unassigned", request=request,
    )
    return {"message": "Ticket assignment updated"}


@router.get("/tickets-assignees")
async def list_ticket_assignees(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_support")),
):
    """Support staff a ticket can be assigned to (wildcard / manage_support roles)."""
    ids = await support_repo.get_support_admin_ids(session)
    if not ids:
        return []
    rows = (await session.execute(select(User.id, User.username).where(User.id.in_(ids)))).all()
    return [{"id": uid, "username": uname} for uid, uname in rows]


# ===========================================================================
# Role management
# ===========================================================================
@router.get("/roles", response_model=list[schemas.RoleRead])
async def list_roles(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_roles")),
):
    result = await session.execute(select(Role).order_by(Role.id))
    return result.scalars().all()


@router.post("/roles", response_model=schemas.RoleRead)
async def create_role(
    role: schemas.RoleCreate, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_roles")),
):
    result = await session.execute(select(Role).where(Role.name == role.name))
    if result.scalar():
        raise HTTPException(status_code=400, detail="Role already exists")
    new_role = Role(name=role.name, permissions=role.permissions)
    session.add(new_role)
    await session.commit()
    await session.refresh(new_role)
    await admin_service.record_audit(
        session, current_user, "role.create", "role", new_role.id, details=role.name, request=request,
    )
    return new_role


@router.put("/roles/{role_id}", response_model=schemas.RoleRead)
async def update_role(
    role_id: int, payload: schemas.RoleUpdate, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_roles")),
):
    role = await session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        role.name = data["name"]
    if "permissions" in data and data["permissions"] is not None:
        role.permissions = data["permissions"]
    await session.commit()
    await session.refresh(role)
    await admin_service.record_audit(
        session, current_user, "role.update", "role", role_id, details=role.name, request=request,
    )
    return role


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: int, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_roles")),
):
    role = await session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    name = role.name
    await session.delete(role)
    await session.commit()
    await admin_service.record_audit(
        session, current_user, "role.delete", "role", role_id, details=name, request=request,
    )
    return {"message": f"Role '{name}' deleted"}


# ===========================================================================
# Audit logs
# ===========================================================================
@router.get("/audit-logs", response_model=schemas.Paginated[schemas.AuditLogRead])
async def list_audit_logs(
    page: int = 1, page_size: int = 30,
    admin_id: Optional[int] = None, action: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_audit_logs")),
):
    page, page_size = _clamp(page, page_size)
    items, total = await admin_repo.list_audit_logs(session, page, page_size, admin_id=admin_id, action=action)
    return schemas.Paginated[schemas.AuditLogRead](
        items=items, total=total, page=page, page_size=page_size, pages=_pages(total, page_size),
    )


# ===========================================================================
# Platform settings
# ===========================================================================
@router.get("/settings")
async def get_settings(
    current_user: User = Depends(require_permission("view_settings")),
):
    """Full settings map (cached). Keys are defined by settings_store.DEFAULTS."""
    return settings_store.all_settings()


@router.put("/settings")
async def update_settings(
    payload: dict, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_settings")),
):
    updated = await settings_store.update_settings(session, payload)
    await admin_service.record_audit(
        session, current_user, "settings.update", "settings", None,
        details=", ".join(k for k in payload.keys() if k in settings_store.DEFAULTS)[:480],
        request=request,
    )
    return updated


# ===========================================================================
# Moderation
# ===========================================================================
@router.get("/reports", response_model=schemas.Paginated[schemas.ReportRead])
async def list_reports(
    page: int = 1, page_size: int = 20,
    status: Optional[str] = None, reason: Optional[str] = None,
    target_type: Optional[str] = None, q: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_moderation")),
):
    page, page_size = _clamp(page, page_size)
    items, total = await moderation_repo.list_reports(
        session, status=status, reason=reason, target_type=target_type, q=q,
        page=page, page_size=page_size,
    )
    return schemas.Paginated[schemas.ReportRead](
        items=items, total=total, page=page, page_size=page_size, pages=_pages(total, page_size),
    )


async def _get_report_or_404(session, report_id: int):
    report = await moderation_repo.get_report(session, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/reports/{report_id}", response_model=schemas.ReportRead)
async def get_report(
    report_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_moderation")),
):
    r = await _get_report_or_404(session, report_id)
    target_username = None
    if r.target_type == "user":
        tu = await session.get(User, r.target_id)
        target_username = tu.username if tu else None
    return moderation_repo.report_to_dict(
        r, r.reporter.username if r.reporter else None,
        r.handler.username if r.handler else None, target_username,
    )


@router.post("/reports/{report_id}/status")
async def update_report_status(
    report_id: int, payload: schemas.ReportStatusUpdate, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_moderation")),
):
    report = await _get_report_or_404(session, report_id)
    await moderation_repo.set_status(session, report, payload.status, current_user)
    await admin_service.record_audit(session, current_user, "moderation.status", "report", report_id, details=payload.status, request=request)
    return {"message": f"Report marked {payload.status}"}


@router.post("/reports/{report_id}/notes")
async def update_report_notes(
    report_id: int, payload: schemas.ReportNotesUpdate, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_moderation")),
):
    report = await _get_report_or_404(session, report_id)
    await moderation_repo.set_notes(session, report, payload.notes)
    await admin_service.record_audit(session, current_user, "moderation.notes", "report", report_id, request=request)
    return {"message": "Notes saved"}


@router.post("/reports/{report_id}/warn")
async def warn_reported_user(
    report_id: int, payload: schemas.ReportWarn, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_moderation")),
):
    report = await _get_report_or_404(session, report_id)
    if report.target_type != "user":
        raise HTTPException(status_code=400, detail="Only user reports can warn a user")
    message = payload.message or "You have received a warning from the moderation team for a community-guidelines violation."
    await send_notification(session, report.target_id, message, type="warning", link="/support")
    await admin_service.record_audit(session, current_user, "moderation.warn", "user", report.target_id, request=request)
    return {"message": "Warning sent"}


# ===========================================================================
# Announcements
# ===========================================================================
async def _deliver_announcement(session, ann) -> None:
    """Fan a `notification`-delivery announcement out to its audience (once)."""
    if ann.delivery != "notification" or ann.notified:
        return
    recipients = await announcement_repo.recipients_for(session, ann)
    for uid in recipients:
        await send_notification(session, uid, f"📣 {ann.title}", type="announcement", link="/")
    ann.notified = True
    await session.commit()


@router.get("/announcements", response_model=schemas.Paginated[schemas.AnnouncementRead])
async def list_announcements(
    page: int = 1, page_size: int = 20,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_announcements")),
):
    page, page_size = _clamp(page, page_size)
    items, total = await announcement_repo.list_announcements(session, page, page_size)
    return schemas.Paginated[schemas.AnnouncementRead](
        items=items, total=total, page=page, page_size=page_size, pages=_pages(total, page_size),
    )


@router.post("/announcements", response_model=schemas.AnnouncementRead)
async def create_announcement(
    payload: schemas.AnnouncementCreate, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_announcements")),
):
    from app.models import Announcement
    publish_at = _naive_utc(payload.publish_at)
    expires_at = _naive_utc(payload.expires_at)
    publish_now = payload.publish_now and (publish_at is None or publish_at <= datetime.utcnow())
    ann = Announcement(
        title=payload.title, body=payload.body, type=payload.type,
        visibility=payload.visibility, delivery=payload.delivery,
        publish_at=publish_at or (datetime.utcnow() if publish_now else None),
        expires_at=expires_at, is_published=publish_now, created_by=current_user.id,
    )
    session.add(ann)
    await session.commit()
    await session.refresh(ann)
    if publish_now:
        await _deliver_announcement(session, ann)
    await admin_service.record_audit(session, current_user, "announcement.create", "announcement", ann.id, details=ann.title, request=request)
    return announcement_repo.to_dict(ann, current_user.username)


@router.put("/announcements/{announcement_id}", response_model=schemas.AnnouncementRead)
async def update_announcement(
    announcement_id: int, payload: schemas.AnnouncementUpdate, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_announcements")),
):
    ann = await announcement_repo.get(session, announcement_id)
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field in ("publish_at", "expires_at"):
            value = _naive_utc(value)
        setattr(ann, field, value)
    await session.commit()
    await session.refresh(ann)
    await admin_service.record_audit(session, current_user, "announcement.update", "announcement", announcement_id, request=request)
    return announcement_repo.to_dict(ann)


@router.post("/announcements/{announcement_id}/publish", response_model=schemas.AnnouncementRead)
async def publish_announcement(
    announcement_id: int, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_announcements")),
):
    ann = await announcement_repo.get(session, announcement_id)
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    ann.is_published = True
    if ann.publish_at is None:
        ann.publish_at = datetime.utcnow()
    await session.commit()
    await session.refresh(ann)
    await _deliver_announcement(session, ann)
    await admin_service.record_audit(session, current_user, "announcement.publish", "announcement", announcement_id, request=request)
    return announcement_repo.to_dict(ann)


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: int, request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("manage_announcements")),
):
    ann = await announcement_repo.get(session, announcement_id)
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    title = ann.title
    await session.delete(ann)
    await session.commit()
    await admin_service.record_audit(session, current_user, "announcement.delete", "announcement", announcement_id, details=title, request=request)
    return {"message": "Announcement deleted"}


# ===========================================================================
# Analytics
# ===========================================================================
def _parse_date(s: Optional[str], fallback: date) -> date:
    if not s:
        return fallback
    try:
        return date.fromisoformat(s)
    except ValueError:
        return fallback


@router.get("/analytics")
async def analytics(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    granularity: str = "day",
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_analytics")),
):
    today = date.today()
    to_date = _parse_date(to, today)
    from_date = _parse_date(from_, to_date - timedelta(days=29))
    if from_date > to_date:
        from_date, to_date = to_date, from_date
    return await admin_repo.analytics(session, from_date, to_date, granularity)


# ===========================================================================
# Platform health
# ===========================================================================
@router.get("/system")
async def system_health(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_permission("view_system")),
):
    # Database
    db_ok = True
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        db_ok = False

    # Host metrics (optional — psutil may not be installed)
    cpu = mem = disk = None
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory().percent
        disk = psutil.disk_usage("/").percent
    except Exception:
        pass

    import os
    return {
        "backend": "ok",
        "database": "ok" if db_ok else "down",
        "websocket": {"status": "ok", "active_connections": len(active_connections)},
        "app_version": "1.0",
        "build_version": os.getenv("BUILD_VERSION", "dev"),
        "uptime_seconds": int(time.time() - _PROCESS_START),
        "cpu_percent": cpu,
        "memory_percent": mem,
        "disk_percent": disk,
        "metrics_available": cpu is not None,
    }
