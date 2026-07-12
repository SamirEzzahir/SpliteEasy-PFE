from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_session
from app import schemas, crud
from app.models import Group, Membership
from app.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/groups")

@router.post("", response_model=schemas.GroupRead)
async def create_group_ep(payload: schemas.GroupCreate, session: AsyncSession = Depends(get_session), current: User = Depends(get_current_user)):
    group = await crud.create_group(session, payload, current)
    return schemas.GroupRead.model_validate(group)

@router.get("", response_model=list[schemas.GroupRead])
async def fetch_groups(session: AsyncSession = Depends(get_session), current=Depends(get_current_user)):
    groups = await crud.get_groups(session, current)
    return [schemas.GroupRead.model_validate(g) for g in groups]

@router.get("/{group_id}", response_model=schemas.GroupRead)
async def fetch_group(group_id: int, session: AsyncSession = Depends(get_session), current=Depends(get_current_user)):
    await crud.ensure_user_in_group(session, current.id, group_id)
    groups = await crud.get_group(session, group_id)
    return schemas.GroupRead.model_validate(groups)

@router.put("/{group_id}", response_model=schemas.GroupRead)
async def route_update_group(group_id: int, payload: dict, session: AsyncSession = Depends(get_session), current=Depends(get_current_user)):
    await crud.ensure_user_in_group(session, current.id, group_id)
    updated = await crud.update_group(session, group_id, payload)
    return schemas.GroupRead.model_validate(updated)

@router.delete("/{group_id}", status_code=204)
async def route_delete_group(group_id: int, session: AsyncSession = Depends(get_session), current=Depends(get_current_user)):
    await crud.delete_group(session, group_id, current)
    return
 

# 🔹 Join via invitation link (GET to preview, POST to join)
@router.get("/join/{group_id}/info")
async def join_group_info(
    group_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    group = await session.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    existing = await session.execute(
        select(Membership).where(Membership.group_id == group_id, Membership.user_id == current.id)
    )
    already_member = existing.scalar_one_or_none() is not None
    member_count_res = await session.execute(
        select(Membership).where(Membership.group_id == group_id)
    )
    member_count = len(member_count_res.scalars().all())
    return {
        "id": group.id,
        "title": group.title,
        "type": group.type,
        "currency": group.currency,
        "member_count": member_count,
        "already_member": already_member,
    }


@router.post("/join/{group_id}")
async def join_group_via_link(
    group_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    group = await session.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    existing = await session.execute(
        select(Membership).where(Membership.group_id == group_id, Membership.user_id == current.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You are already a member of this group.")
    membership = Membership(user_id=current.id, group_id=group_id, is_admin=False)
    session.add(membership)
    await session.commit()
    return {"detail": f"Successfully joined {group.title}!", "group_id": group.id}


# 🔹 Leave group
@router.post("/{group_id}/leave")
async def leave_group_ep(
    group_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    await crud.leave_group(session, current.id, group_id)
    return {"detail": "Left group successfully"}

# 🔹 Check if user can leave group
@router.get("/{group_id}/can_leave")
async def can_leave_group_ep(
    group_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    can_leave = await crud.can_leave_group(session, current.id, group_id)
    return {"can_leave": can_leave}

# 🔹 Fetch Group Messages
@router.get("/{group_id}/messages", response_model=list[schemas.GroupMessageRead])
async def fetch_group_messages_ep(
    group_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    await crud.ensure_user_in_group(session, current.id, group_id)
    return await crud.get_group_messages(session, group_id)

# 🔹 Send Group Message
@router.post("/{group_id}/messages", response_model=schemas.GroupMessageRead)
async def send_group_message_ep(
    group_id: int,
    payload: schemas.GroupMessageCreate,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    await crud.ensure_user_in_group(session, current.id, group_id)
    
    # Save to db
    msg = await crud.add_group_message(session, group_id, current.id, payload.content)
    
    # Broadcast to other members in the group via websocket
    from app.routers.notifications import active_connections
    import json

    memberships = await crud.get_group_members(session, group_id)
    
    msg_data = {
        "type": "new_chat_message",
        "message": {
            "id": msg.id,
            "group_id": msg.group_id,
            "user_id": msg.user_id,
            "username": msg.username,
            "content": msg.content,
            "created_at": msg.created_at.isoformat()
        }
    }
    
    for member in memberships:
        if member.user_id == current.id:
            continue
            
        websocket = active_connections.get(member.user_id)
        if websocket:
            try:
                await websocket.send_text(json.dumps(msg_data))
            except Exception as e:
                print(f"Failed to send chat message to user {member.user_id}: {e}")
                
    return msg


# 🔹 Typing indicator — broadcast to other group members via WebSocket
@router.post("/{group_id}/typing", status_code=204)
async def broadcast_typing_ep(
    group_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    await crud.ensure_user_in_group(session, current.id, group_id)

    from app.routers.notifications import active_connections
    import json

    memberships = await crud.get_group_members(session, group_id)
    payload = json.dumps({
        "type": "typing",
        "group_id": group_id,
        "user_id": current.id,
        "username": current.username,
    })

    for member in memberships:
        if member.user_id == current.id:
            continue
        ws = active_connections.get(member.user_id)
        if ws:
            try:
                await ws.send_text(payload)
            except Exception:
                pass