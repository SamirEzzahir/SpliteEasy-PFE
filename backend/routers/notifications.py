from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

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
                print(f"📨 Received from user {user_id}: {data}")
                
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
async def send_notification(user_id: int, message: str):
    """
    Send a real-time notification to a connected user.
    """
    try:
        websocket = active_connections.get(user_id)
        if websocket:
            await websocket.send_text(message)
            print(f"📨 Sent notification to user {user_id}: {message}")
            return True
        else:
            print(f"⚠️ User {user_id} not connected to WebSocket")
            return False
    except Exception as e:
        print(f"❌ Error sending notification to user {user_id}: {e}")
        # Clean up broken connection
        if user_id in active_connections:
            del active_connections[user_id]
        return False