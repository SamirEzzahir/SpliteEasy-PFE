"""Admin-side business logic: audit logging, user state transitions, security."""
from typing import Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import hash_password
from backend.models import User
from backend.repositories import admin as admin_repo

VALID_STATUSES = {"active", "suspended", "banned"}


def client_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    # Honour a proxy header when present, otherwise the direct peer.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


async def record_audit(
    session: AsyncSession, admin: User, action: str,
    target_type: Optional[str] = None, target_id: Optional[int] = None,
    details: Optional[str] = None, request: Optional[Request] = None,
) -> None:
    await admin_repo.create_audit_log(
        session, admin_id=admin.id, action=action,
        target_type=target_type, target_id=target_id,
        details=details, ip=client_ip(request),
    )


async def set_user_status(session: AsyncSession, user: User, status: str, reason: Optional[str]) -> User:
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{status}'")
    user.status = status
    user.status_reason = reason
    # Keep the legacy is_active flag in sync so existing auth checks still work.
    user.is_active = status == "active"
    await session.commit()
    await session.refresh(user)
    return user


async def force_logout(session: AsyncSession, user: User) -> User:
    """Invalidate every outstanding token by bumping the user's token_version."""
    user.token_version = (user.token_version or 0) + 1
    await session.commit()
    await session.refresh(user)
    return user


async def reset_password(session: AsyncSession, user: User, new_password: str) -> User:
    user.password_hash = hash_password(new_password)
    # A password reset should also end existing sessions.
    user.token_version = (user.token_version or 0) + 1
    await session.commit()
    await session.refresh(user)
    return user
