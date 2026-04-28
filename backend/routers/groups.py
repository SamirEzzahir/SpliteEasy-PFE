from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db import get_session
from backend import schemas, crud
from backend.models import Membership
from backend.auth import get_current_user
from backend.models import User

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
    from backend.routers.notifications import active_connections
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