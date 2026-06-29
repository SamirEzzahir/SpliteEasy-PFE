"""Data-access layer for the admin panel.

All functions are async and take an AsyncSession. List helpers return
``(items, total)`` tuples so routers can build the Paginated envelope.
"""
from datetime import datetime, timedelta, date
from typing import Optional

from sqlalchemy import select, func, cast, Date, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models import (
    User, Group, Membership, Expense, Settlement, SettlementStatus, Reclamation,
    ReclamationStatus, AdminAuditLog,
)

# Columns that the user list may be sorted by (whitelist guards against injection).
_USER_SORT = {
    "created_at": User.created_at,
    "username": User.username,
    "email": User.email,
    "last_login_at": User.last_login_at,
    "status": User.status,
}


def _paginate(page: int, page_size: int) -> tuple[int, int]:
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    return page, page_size


def _pages(total: int, page_size: int) -> int:
    return (total + page_size - 1) // page_size if page_size else 0


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
async def list_users(
    session: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    q: Optional[str] = None,
    status: Optional[str] = None,
    role_id: Optional[int] = None,
    sort: str = "created_at",
    order: str = "desc",
) -> tuple[list[User], int]:
    page, page_size = _paginate(page, page_size)
    filters = []
    if q:
        like = f"%{q.strip()}%"
        filters.append(or_(
            User.username.ilike(like), User.email.ilike(like),
            User.first_name.ilike(like), User.last_name.ilike(like),
        ))
    if status:
        filters.append(User.status == status)
    if role_id is not None:
        filters.append(User.role_id == role_id)

    total = (await session.execute(
        select(func.count()).select_from(User).where(*filters)
    )).scalar_one()

    col = _USER_SORT.get(sort, User.created_at)
    col = col.desc() if order.lower() == "desc" else col.asc()
    rows = (await session.execute(
        select(User).where(*filters).options(selectinload(User.role))
        .order_by(col).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()
    return list(rows), total


async def get_user_detail(session: AsyncSession, user_id: int) -> Optional[dict]:
    user = (await session.execute(
        select(User).where(User.id == user_id).options(selectinload(User.role))
    )).scalar_one_or_none()
    if not user:
        return None

    groups_count = (await session.execute(
        select(func.count()).select_from(Membership).where(Membership.user_id == user_id)
    )).scalar_one()
    owned_groups_count = (await session.execute(
        select(func.count()).select_from(Group).where(Group.owner_id == user_id)
    )).scalar_one()
    expenses_count = (await session.execute(
        select(func.count()).select_from(Expense).where(Expense.payer_id == user_id)
    )).scalar_one()
    settlements_count = (await session.execute(
        select(func.count()).select_from(Settlement).where(
            or_(Settlement.from_user_id == user_id, Settlement.to_user_id == user_id)
        )
    )).scalar_one()

    return {
        "user": user,
        "groups_count": groups_count,
        "owned_groups_count": owned_groups_count,
        "expenses_count": expenses_count,
        "settlements_count": settlements_count,
    }


# ---------------------------------------------------------------------------
# Groups
# ---------------------------------------------------------------------------
async def list_groups(
    session: AsyncSession, page: int = 1, page_size: int = 20, q: Optional[str] = None,
) -> tuple[list[dict], int]:
    page, page_size = _paginate(page, page_size)
    filters = []
    if q:
        filters.append(Group.title.ilike(f"%{q.strip()}%"))

    total = (await session.execute(
        select(func.count()).select_from(Group).where(*filters)
    )).scalar_one()

    members_sq = (
        select(Membership.group_id, func.count().label("c"))
        .group_by(Membership.group_id).subquery()
    )
    expenses_sq = (
        select(Expense.group_id, func.count().label("c"))
        .group_by(Expense.group_id).subquery()
    )
    rows = (await session.execute(
        select(
            Group, User.username,
            func.coalesce(members_sq.c.c, 0), func.coalesce(expenses_sq.c.c, 0),
        )
        .outerjoin(User, Group.owner_id == User.id)
        .outerjoin(members_sq, members_sq.c.group_id == Group.id)
        .outerjoin(expenses_sq, expenses_sq.c.group_id == Group.id)
        .where(*filters)
        .order_by(Group.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).all()

    items = [{
        "id": g.id, "title": g.title, "type": g.type, "currency": g.currency,
        "owner_id": g.owner_id, "owner_username": owner,
        "members_count": members, "expenses_count": expenses, "created_at": g.created_at,
    } for g, owner, members, expenses in rows]
    return items, total


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------
async def list_expenses(
    session: AsyncSession, page: int = 1, page_size: int = 20,
    q: Optional[str] = None, group_id: Optional[int] = None,
) -> tuple[list[dict], int]:
    page, page_size = _paginate(page, page_size)
    filters = []
    if q:
        filters.append(Expense.description.ilike(f"%{q.strip()}%"))
    if group_id is not None:
        filters.append(Expense.group_id == group_id)

    total = (await session.execute(
        select(func.count()).select_from(Expense).where(*filters)
    )).scalar_one()

    payer = User.__table__.alias("payer_u")
    rows = (await session.execute(
        select(Expense, Group.title, payer.c.username)
        .outerjoin(Group, Expense.group_id == Group.id)
        .outerjoin(payer, Expense.payer_id == payer.c.id)
        .where(*filters)
        .order_by(Expense.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).all()

    items = [{
        "id": e.id, "group_id": e.group_id, "group_title": gtitle,
        "payer_id": e.payer_id, "payer_username": pusername,
        "description": e.description, "amount": float(e.amount), "currency": e.currency,
        "category": e.category, "created_at": e.created_at,
    } for e, gtitle, pusername in rows]
    return items, total


# ---------------------------------------------------------------------------
# Settlements
# ---------------------------------------------------------------------------
async def list_settlements(
    session: AsyncSession, page: int = 1, page_size: int = 20, status: Optional[str] = None,
) -> tuple[list[dict], int]:
    page, page_size = _paginate(page, page_size)
    filters = []
    if status:
        try:
            filters.append(Settlement.status == SettlementStatus(status))
        except ValueError:
            pass  # unknown status -> no filter rather than an error

    total = (await session.execute(
        select(func.count()).select_from(Settlement).where(*filters)
    )).scalar_one()

    from_u = User.__table__.alias("from_u")
    to_u = User.__table__.alias("to_u")
    rows = (await session.execute(
        select(Settlement, from_u.c.username, to_u.c.username)
        .outerjoin(from_u, Settlement.from_user_id == from_u.c.id)
        .outerjoin(to_u, Settlement.to_user_id == to_u.c.id)
        .where(*filters)
        .order_by(Settlement.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).all()

    items = [{
        "id": s.id, "group_id": s.group_id,
        "from_user_id": s.from_user_id, "from_username": fu,
        "to_user_id": s.to_user_id, "to_username": tu,
        "amount": float(s.amount),
        "status": s.status.value if hasattr(s.status, "value") else str(s.status),
        "created_at": s.created_at,
    } for s, fu, tu in rows]
    return items, total


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
async def _daily_series(session, model_col, date_col, days: int = 14) -> list[dict]:
    start = date.today() - timedelta(days=days - 1)
    rows = (await session.execute(
        select(cast(date_col, Date).label("d"), func.count().label("c"))
        .where(date_col >= start)
        .group_by(cast(date_col, Date))
    )).all()
    counts = {r.d: r.c for r in rows}
    out = []
    for i in range(days):
        d = start + timedelta(days=i)
        out.append({"label": d.strftime("%m-%d"), "value": int(counts.get(d, 0))})
    return out


async def dashboard_stats(session: AsyncSession) -> dict:
    async def count(model, *where):
        return (await session.execute(select(func.count()).select_from(model).where(*where))).scalar_one()

    week_ago = datetime.utcnow() - timedelta(days=7)
    total_users = await count(User)
    active_users = await count(User, User.status == "active")
    suspended_users = await count(User, User.status == "suspended")
    banned_users = await count(User, User.status == "banned")
    new_users_7d = await count(User, User.created_at >= week_ago)
    total_groups = await count(Group)
    total_expenses = await count(Expense)
    total_settlements = await count(Settlement)
    pending_settlements = await count(Settlement, Settlement.status == SettlementStatus.pending)
    pending_support = await count(Reclamation, Reclamation.status.in_([
        ReclamationStatus.open, ReclamationStatus.in_progress, ReclamationStatus.waiting_user,
    ]))

    return {
        "total_users": total_users,
        "active_users": active_users,
        "suspended_users": suspended_users,
        "banned_users": banned_users,
        "new_users_7d": new_users_7d,
        "total_groups": total_groups,
        "total_expenses": total_expenses,
        "total_settlements": total_settlements,
        "pending_settlements": pending_settlements,
        "pending_support": pending_support,
        "signups_last_14d": await _daily_series(session, User, User.created_at),
        "expenses_last_14d": await _daily_series(session, Expense, Expense.created_at),
    }


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------
async def create_audit_log(
    session: AsyncSession, admin_id: Optional[int], action: str,
    target_type: Optional[str] = None, target_id: Optional[int] = None,
    details: Optional[str] = None, ip: Optional[str] = None,
) -> AdminAuditLog:
    log = AdminAuditLog(
        admin_id=admin_id, action=action, target_type=target_type,
        target_id=target_id, details=details, ip=ip,
    )
    session.add(log)
    await session.commit()
    await session.refresh(log)
    return log


async def list_audit_logs(
    session: AsyncSession, page: int = 1, page_size: int = 30,
    admin_id: Optional[int] = None, action: Optional[str] = None,
) -> tuple[list[dict], int]:
    page, page_size = _paginate(page, page_size)
    filters = []
    if admin_id is not None:
        filters.append(AdminAuditLog.admin_id == admin_id)
    if action:
        filters.append(AdminAuditLog.action == action)

    total = (await session.execute(
        select(func.count()).select_from(AdminAuditLog).where(*filters)
    )).scalar_one()

    rows = (await session.execute(
        select(AdminAuditLog, User.username)
        .outerjoin(User, AdminAuditLog.admin_id == User.id)
        .where(*filters)
        .order_by(AdminAuditLog.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).all()

    items = [{
        "id": log.id, "admin_id": log.admin_id, "admin_username": uname,
        "action": log.action, "target_type": log.target_type, "target_id": log.target_id,
        "details": log.details, "ip": log.ip, "created_at": log.created_at,
    } for log, uname in rows]
    return items, total
