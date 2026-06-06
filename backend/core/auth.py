from datetime import datetime, timedelta
from jose import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.core.config import settings
from backend.core.db import get_session
from backend.core.security import verify_password
from backend.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def authenticate(session: AsyncSession, username: str, password: str) -> User | None:
    user = (await session.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if user and verify_password(password, user.password_hash):
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account Was Deleted")
        return user
    return None


def create_access_token(username: str, minutes: int = settings.ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    payload = {"username": username, "exp": datetime.utcnow() + timedelta(minutes=minutes)}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)


async def get_current_user(session: AsyncSession = Depends(get_session), token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
        username: str = payload.get("username")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = (await session.execute(
        select(User).where(User.username == username).options(selectinload(User.role))
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
