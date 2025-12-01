from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_
from backend.db import get_session
from backend.models import User, Friend, FriendStatus
from backend.schemas import UserRead
from backend.auth import get_current_user
from backend.routers.notifications import send_notification

router = APIRouter(prefix="/friends")

# ----------------- Search users by username, email, or phone -----------------
@router.get("/search", response_model=list[UserRead])
async def search_users(query: str, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await session.execute(
        select(User).options(selectinload(User.role)).where(
            or_(
                User.username.ilike(f"%{query}%"),
                User.email.ilike(f"%{query}%"),
                User.phone.ilike(f"%{query}%")
            )
        )
    )
    users = result.scalars().all()
    return [UserRead.model_validate(u, from_attributes=True) for u in users if u.id != current_user.id]

# ----------------- Get my friends -----------------
@router.get("/my")
async def my_friends(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await session.execute(
        select(Friend).where(
            ((Friend.user_id == current_user.id) | (Friend.friend_id == current_user.id)) &
            (Friend.status == FriendStatus.accepted)
        )
    )
    friendships = result.scalars().all()
    friends_list = []
    for f in friendships:
        friend_id = f.friend_id if f.user_id == current_user.id else f.user_id
        user = await session.get(User, friend_id)
        friends_list.append({
            "friendship_id": f.id,  # needed for remove
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "phone": getattr(user, "phone", "")
        })
    return friends_list

# ----------------- Requests sent -----------------
@router.get("/requests/sent")
async def requests_sent(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await session.execute(
        select(Friend).where(Friend.user_id == current_user.id, Friend.status == FriendStatus.pending)
    )
    requests = result.scalars().all()
    return [{"id": r.id, "friend_email": (await session.get(User, r.friend_id)).email} for r in requests]

# ----------------- Requests received -----------------
@router.get("/requests/received")
async def requests_received(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await session.execute(
        select(Friend).where(Friend.friend_id == current_user.id, Friend.status == FriendStatus.pending)
    )
    requests = result.scalars().all()
    return [{"id": r.id, "user_email": (await session.get(User, r.user_id)).email} for r in requests]

# ----------------- Send friend request -----------------
@router.post("/request/{friend_id}")
async def send_friend_request(friend_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    if friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")

    result = await session.execute(
        select(Friend).where(
            ((Friend.user_id == current_user.id) & (Friend.friend_id == friend_id)) |
            ((Friend.user_id == friend_id) & (Friend.friend_id == current_user.id))
        )
    )
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Friendship already exists")

    friend_request = Friend(
        user_id=current_user.id,
        friend_id=friend_id,
        status=FriendStatus.pending
    )
    session.add(friend_request)
    await session.commit()
    await send_notification(friend_id, f"{current_user.username or current_user.email} sent you a friend request")
    return {"message": "Friend request sent"}

# ----------------- Accept request -----------------
@router.post("/request/{request_id}/accept")
async def accept_request(request_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    request = await session.get(Friend, request_id)
    if not request or request.friend_id != current_user.id or request.status != FriendStatus.pending:
        raise HTTPException(status_code=404, detail="Friend request not found")

    request.status = FriendStatus.accepted
    await session.commit()
    await send_notification(request.user_id, f"{current_user.username or current_user.email} accepted your friend request")
    return {"message": "Friend request accepted"}

# ----------------- Reject request -----------------
@router.post("/request/{request_id}/reject")
async def reject_request(request_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    request = await session.get(Friend, request_id)
    if not request or request.friend_id != current_user.id or request.status != FriendStatus.pending:
        raise HTTPException(status_code=404, detail="Friend request not found")

    await session.delete(request)
    await session.commit()
    return {"message": "Friend request rejected"}

# ----------------- Remove friend -----------------
@router.delete("/remove/{friendship_id}")
async def remove_friend(friendship_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    friendship = await session.get(Friend, friendship_id)
    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")
    if current_user.id not in [friendship.user_id, friendship.friend_id]:
        raise HTTPException(status_code=403, detail="Not allowed to remove this friend")

    await session.delete(friendship)
    await session.commit()
    return {"message": "Friend removed"}
