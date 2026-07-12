from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models import User, Role
from app.schemas import UserCreate, UserRead
from app.core.security import hash_password


async def create_user(session: AsyncSession, user_data: UserCreate) -> UserRead:
    result = await session.execute(select(Role).where(Role.name == "User"))
    default_role = result.scalar_one_or_none()

    user = User(
        email=user_data.email,
        username=user_data.username,
        password_hash=hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        gender=user_data.gender,
        phone=user_data.phone,
        profile_photo=user_data.profile_photo,
        is_active=user_data.is_active,
        role_id=default_role.id if default_role else None,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user, ["role"])
    return UserRead.model_validate(user, from_attributes=True)


async def get_user_by_id(session: AsyncSession, user_id: int) -> UserRead:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserRead.model_validate(user)


async def get_users(session: AsyncSession) -> list[UserRead]:
    result = await session.execute(select(User))
    users = result.scalars().all()
    return [UserRead.model_validate(u, from_attributes=True) for u in users]


async def update_user(session: AsyncSession, user_id: int, data: dict) -> UserRead:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    for key, value in data.items():
        if hasattr(user, key) and value is not None:
            setattr(user, key, value)

    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user, from_attributes=True)


async def delete_user(session: AsyncSession, user_id: int):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = False
    await session.commit()


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    return (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()


async def get_user_by_username(session: AsyncSession, username: str) -> User | None:
    # Case-insensitive so registration rejects case-duplicate usernames
    # ("admin" vs "Admin") and lookups match regardless of case. .first()
    # tolerates any legacy rows that already differ only by case.
    return (await session.execute(
        select(User).where(func.lower(User.username) == username.lower())
    )).scalars().first()
