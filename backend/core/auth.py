from datetime import datetime, timedelta
from jose import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from backend.core.config import settings
from backend.core.db import get_session
from backend.core.security import verify_password
from backend.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def authenticate(session: AsyncSession, username: str, password: str) -> User | None:
    # Case-insensitive login: "admin" and "Admin" resolve to the same account.
    # .first() (not scalar_one_or_none) in case legacy data has usernames that
    # differ only by case.
    user = (await session.execute(
        select(User).where(func.lower(User.username) == username.lower())
    )).scalars().first()
    if user and verify_password(password, user.password_hash):
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account Was Deleted")
        return user
    return None


def create_access_token(username: str, ver: int = 0, minutes: int = settings.ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    # ``ver`` mirrors User.token_version. Admin "force logout" bumps that value,
    # which makes every token issued with the old version fail verification below.
    payload = {"username": username, "ver": ver, "exp": datetime.utcnow() + timedelta(minutes=minutes)}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)


async def get_current_user(session: AsyncSession = Depends(get_session), token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
        username: str = payload.get("username")
        token_ver: int = payload.get("ver", 0)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = (await session.execute(
        select(User).where(User.username == username).options(selectinload(User.role))
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    # Tokens minted before a force-logout (lower version) are rejected. Older
    # tokens that predate this field decode as ver=0, matching fresh accounts.
    if (user.token_version or 0) != token_ver:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    return user
