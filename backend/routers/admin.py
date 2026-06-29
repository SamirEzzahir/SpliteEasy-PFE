"""Admin panel API.

Every write action is guarded by a specific permission (see core/dependencies
.require_permission) and recorded in the admin audit log. Read endpoints return
the shared Paginated envelope. Super Admin holds the "*" wildcard permission.
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.db import get_session
from backend.core.dependencies import require_permission
from backend.models import (
    User, Role, Reclamation, ReclamationStatus,
    Group, Membership, Expense, Settlement, SettlementStatus,
)
from backend import schemas
from backend.repositories import admin as admin_repo
from backend.repositories import support as support_repo
from backend.services import admin as admin_service
from backend.routers.notifications import send_notification

router = APIRouter(prefix="/admin", tags=["Admin"])


def _pages(total: int, page_size: int) -> int:
    return (total + page_size - 1) // page_size if page_size else 0


def _clamp(page: int, page_size: int) -> tuple[int, int]:
    return max(1, page), max(1, min(page_size, 100))


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
