from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from backend.db import get_session
from backend import models, schemas
from backend.auth import get_current_user

router = APIRouter(prefix="/Notifications")

# ================== ACTIVE CONNECTIONS ==================
active_connections: Dict[int, WebSocket] = {}

# ================== WEBSOCKET ENDPOINT ==================
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    """
    WebSocket endpoint for real-time notifications.
    Each connected client subscribes to notifications using their user_id.
    """
    try:
        await websocket.accept()
        
        # Store the connection
        active_connections[user_id] = websocket
        print(f"✅ User {user_id} connected to WebSocket")
        
        try:
            while True:
                # Keep the connection alive by receiving messages
                data = await websocket.receive_text()
                # print(f"📨 Received from user {user_id}: {data}")
                
        except WebSocketDisconnect:
            # Clean up connection when client disconnects
            if user_id in active_connections:
                del active_connections[user_id]
                print(f"❌ User {user_id} disconnected from WebSocket")
                
    except Exception as e:
        print(f"❌ WebSocket error for user {user_id}: {e}")
        try:
            await websocket.close(code=1008, reason="Internal server error")
        except:
            pass

# ================== HELPER FUNCTION ==================
async def send_notification(session: AsyncSession, user_id: int, message: str, type: str = "info", link: str = None):
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

        # 2. Send Real-time WebSocket Message if user is connected
        websocket = active_connections.get(user_id)
        if websocket:
            # Send simplified JSON message to frontend, or just the text
            # Here sending just the message text for compatibility with existing frontend simple string handling
            # Ideally should send JSON but existing frontend expects string? 
            # Let's check: "this.handleNotification(event.data);" -> shows toast.
            # We'll send the message string for toast, but the frontend should ideally re-fetch or use the data.
            # To keep it backward compatible:
            await websocket.send_text(message)
            print(f"📨 Sent notification to user {user_id}: {message}")
            return True
        else:
            print(f"⚠️ User {user_id} not connected to WebSocket (Saved to DB only)")
            return False
            
    except Exception as e:
        print(f"❌ Error sending/saving notification to user {user_id}: {e}")
        return False

# ================== REST ENDPOINTS ==================

@router.get("/", response_model=List[schemas.NotificationRead])
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
    notification_id: int,
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