"""Socket fan-out for the single-worker API; every tab/device receives events."""
import asyncio
import uuid

from fastapi import WebSocket

active_connections: dict[uuid.UUID, set[WebSocket]] = {}


def disconnect(user_id: uuid.UUID, socket: WebSocket) -> None:
    sockets = active_connections.get(user_id)
    if sockets is not None:
        sockets.discard(socket)
        if not sockets:
            active_connections.pop(user_id, None)


async def broadcast(user_id: uuid.UUID, message: str) -> bool:
    async def deliver(socket: WebSocket) -> bool:
        try:
            await asyncio.wait_for(socket.send_text(message), timeout=5)
            return True
        except Exception:
            disconnect(user_id, socket)
            return False

    sockets = tuple(active_connections.get(user_id, ()))
    return any(await asyncio.gather(*(deliver(socket) for socket in sockets)))
