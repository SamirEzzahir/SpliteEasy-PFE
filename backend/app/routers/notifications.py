import uuid
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from jose import jwt
from app.db import get_session
from app import models, schemas
from app.auth import get_current_user
from app.core.config import settings
from app.core.db import async_session
from app.core.realtime import active_connections, broadcast, disconnect

router = APIRouter(prefix="/Notifications")

# ================== WEBSOCKET ENDPOINT ==================
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: uuid.UUID):
    """
    WebSocket endpoint for real-time notifications.
    Each connected client subscribes to notifications using their user_id.
    """
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Authentication required")
        return

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
        username = payload.get("username")
        token_ver = payload.get("ver", 0)
        async with async_session() as session:
            user = (await session.execute(
                select(models.User).where(models.User.username == username)
            )).scalar_one_or_none()
        if not user or user.id != user_id or (user.token_version or 0) != token_ver:
            await websocket.close(code=1008, reason="Invalid session")
            return
    except Exception:
        await websocket.close(code=1008, reason="Invalid token")
        return

    await websocket.accept()
    active_connections.setdefault(user_id, set()).add(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        disconnect(user_id, websocket)

# ================== HELPER FUNCTION ==================
async def send_notification(session: AsyncSession, user_id: uuid.UUID, message: str, type: str = "info", link: str = None):
    """
    Send a real-time notification to a connected user AND save to database.
    """
    try:
        # 1. Save to Database
        notification = models.Notification(
            user_id=user_id,
            message=message,
            type=type,
            link=link
        )
        session.add(notification)
        await session.commit()
        await session.refresh(notification)

        return await broadcast(user_id, message)

    except Exception as e:
        print(f"❌ Error sending/saving notification to user {user_id}: {e}")
        return False

# ================== REST ENDPOINTS ==================

# Served at the no-slash path ("/Notifications") so the Next.js proxy — which
# strips trailing slashes — hits it directly without a 307 redirect. The 307
# was dropping the Authorization header and causing 401s.
@router.get("", response_model=List[schemas.NotificationRead])
async def get_my_notifications(
    limit: int = 20, 
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    current: models.User = Depends(get_current_user)
):
    """Fetch user's notifications"""
    result = await session.execute(
        select(models.Notification)
        .where(models.Notification.user_id == current.id)
        .order_by(models.Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()

@router.put("/{notification_id}/read", response_model=schemas.NotificationRead)
async def mark_notification_read(
    notification_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current: models.User = Depends(get_current_user)
):
    """Mark a notification as read"""
    result = await session.execute(
        select(models.Notification)
        .where(models.Notification.id == notification_id, models.Notification.user_id == current.id)
    )
    notification = result.scalars().first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notification.is_read = True
    await session.commit()
    await session.refresh(notification)
    return notification

@router.post("/read-all")
async def mark_all_read(
    session: AsyncSession = Depends(get_session),
    current: models.User = Depends(get_current_user)
):
    """Mark all user's notifications as read"""
    await session.execute(
        update(models.Notification)
        .where(models.Notification.user_id == current.id, models.Notification.is_read == False)
        .values(is_read=True)
    )
    await session.commit()
    return {"status": "success", "message": "All notifications marked as read"}

@router.delete("/clear")
async def clear_notifications(
    session: AsyncSession = Depends(get_session),
    current: models.User = Depends(get_current_user)
):
    """Delete all read notifications or all notifications"""
    await session.execute(
        delete(models.Notification)
        .where(models.Notification.user_id == current.id)
    )
    await session.commit()
    return {"status": "success", "message": "Notifications cleared"}
