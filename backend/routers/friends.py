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


def user_name_payload(prefix: str, user: User) -> dict:
    return {
        f"{prefix}_id": user.id,
        f"{prefix}_username": user.username,
        f"{prefix}_email": user.email,
        f"{prefix}_first_name": getattr(user, "first_name", None),
        f"{prefix}_last_name": getattr(user, "last_name", None),
    }

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


# ----------------- Suggested users -----------------
@router.get("/suggestions")
async def friend_suggestions(limit: int = 5, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    relations_res = await session.execute(
        select(Friend).where(
            (Friend.user_id == current_user.id) | (Friend.friend_id == current_user.id)
        )
    )
    relations = relations_res.scalars().all()
    blocked_ids = {current_user.id}
    current_friend_ids = set()

    for rel in relations:
        other_id = rel.friend_id if rel.user_id == current_user.id else rel.user_id
        blocked_ids.add(other_id)
        if rel.status == FriendStatus.accepted:
            current_friend_ids.add(other_id)

    users_res = await session.execute(
        select(User)
        .where(User.id.notin_(blocked_ids), User.is_active == True)
        .order_by(User.created_at.desc())
        .limit(limit)
    )
    candidates = users_res.scalars().all()

    suggestions = []
    for candidate in candidates:
        candidate_relations_res = await session.execute(
            select(Friend).where(
                (
                    (Friend.user_id == candidate.id) |
                    (Friend.friend_id == candidate.id)
                ) &
                (Friend.status == FriendStatus.accepted)
            )
        )
        candidate_friend_ids = {
            rel.friend_id if rel.user_id == candidate.id else rel.user_id
            for rel in candidate_relations_res.scalars().all()
        }
        suggestions.append({
            "user": UserRead.model_validate(candidate, from_attributes=True),
            "mutuals": len(current_friend_ids.intersection(candidate_friend_ids)),
        })

    return suggestions

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
    friend_ids = [f.friend_id if f.user_id == current_user.id else f.user_id for f in friendships]
    if not friend_ids:
        return []
    users_res = await session.execute(select(User).where(User.id.in_(friend_ids)))
    users_map = {u.id: u for u in users_res.scalars().all()}
    return [
        {"friendship_id": f.id, "user_id": uid, "username": users_map[uid].username,
         "email": users_map[uid].email, "phone": getattr(users_map[uid], "phone", "")}
        for f in friendships
        for uid in [f.friend_id if f.user_id == current_user.id else f.user_id]
        if uid in users_map
    ]

# ----------------- Requests sent -----------------
@router.get("/requests/sent")
async def requests_sent(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await session.execute(
        select(Friend).where(Friend.user_id == current_user.id, Friend.status == FriendStatus.pending)
    )
    requests = result.scalars().all()
    if not requests:
        return []
    fids = [r.friend_id for r in requests]
    users_res = await session.execute(select(User).where(User.id.in_(fids)))
    users_map = {u.id: u for u in users_res.scalars().all()}
    return [
        {"id": r.id, **user_name_payload("friend", users_map[r.friend_id])}
        for r in requests
        if r.friend_id in users_map
    ]

# ----------------- Requests received -----------------
@router.get("/requests/received")
async def requests_received(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    result = await session.execute(
        select(Friend).where(Friend.friend_id == current_user.id, Friend.status == FriendStatus.pending)
    )
    requests = result.scalars().all()
    if not requests:
        return []
    uids = [r.user_id for r in requests]
    users_res = await session.execute(select(User).where(User.id.in_(uids)))
    users_map = {u.id: u for u in users_res.scalars().all()}
    return [
        {"id": r.id, **user_name_payload("user", users_map[r.user_id])}
        for r in requests
        if r.user_id in users_map
    ]

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
    await send_notification(session, friend_id, f"{current_user.username or current_user.email} sent you a friend request")
    return {"message": "Friend request sent"}

# ----------------- Accept request -----------------
@router.post("/request/{request_id}/accept")
async def accept_request(request_id: int, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    request = await session.get(Friend, request_id)
    if not request or request.friend_id != current_user.id or request.status != FriendStatus.pending:
        raise HTTPException(status_code=404, detail="Friend request not found")

    request.status = FriendStatus.accepted
    await session.commit()
    await send_notification(session, request.user_id, f"{current_user.username or current_user.email} accepted your friend request")
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
