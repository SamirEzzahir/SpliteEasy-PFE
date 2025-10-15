from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/Notifications")

# Keep active WebSocket connections
active_connections: dict[int, WebSocket] = {}

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    """Client connects with their user_id to receive notifications"""
    await websocket.accept()
    active_connections[user_id] = websocket
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        if user_id in active_connections:
            del active_connections[user_id]

# Helper to send a notification
async def send_notification(user_id: int, message: str):
    """Send a real-time notification to a user if connected"""
    if user_id in active_connections:
        await active_connections[user_id].send_text(message)
