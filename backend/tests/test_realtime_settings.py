import asyncio
import uuid
from types import SimpleNamespace

import pytest

from app.core import realtime, settings_store


def test_authenticated_websocket_tabs_and_heartbeat(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect
    from app.routers import notifications

    user_id = uuid.uuid4()
    user = SimpleNamespace(id=user_id, token_version=1)

    class Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def execute(self, query):
            return SimpleNamespace(scalar_one_or_none=lambda: user)

    monkeypatch.setattr(notifications, "async_session", Session)
    monkeypatch.setattr(notifications.jwt, "decode", lambda *a, **k: {"username": "test", "ver": 1})
    app = FastAPI()
    app.include_router(notifications.router)
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(f"/Notifications/ws/{user_id}"):
                pass
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(f"/Notifications/ws/{uuid.uuid4()}?token=test"):
                pass
        url = f"/Notifications/ws/{user_id}?token=test"
        with client.websocket_connect(url) as first:
            first.send_text("ping")
            assert first.receive_text() == "pong"
            with client.websocket_connect(url) as second:
                second.send_text("ping")
                assert second.receive_text() == "pong"
                assert client.portal.call(realtime.broadcast, user_id, "chat")
                assert first.receive_text() == second.receive_text() == "chat"
            first.send_text("ping")
            assert first.receive_text() == "pong"
            assert client.portal.call(realtime.broadcast, user_id, "notification")
            assert first.receive_text() == "notification"
    assert user_id not in realtime.active_connections


def test_socket_fanout_and_failed_tab_cleanup():
    class Socket:
        def __init__(self, broken=False):
            self.messages = []
            self.broken = broken

        async def send_text(self, message):
            if self.broken:
                raise RuntimeError("Closed tab")
            self.messages.append(message)

    async def scenario():
        user, other = uuid.uuid4(), uuid.uuid4()
        a, b, broken, outsider = Socket(), Socket(), Socket(True), Socket()
        realtime.active_connections[user] = {a, b, broken}
        realtime.active_connections[other] = {outsider}
        try:
            assert await realtime.broadcast(user, "message")
            assert a.messages == b.messages == ["message"]
            assert not outsider.messages
            assert realtime.active_connections[user] == {a, b}
            realtime.disconnect(user, a)
            assert await realtime.broadcast(user, "next")
            assert b.messages == ["message", "next"]
            realtime.disconnect(user, b)
            assert user not in realtime.active_connections
            assert not await realtime.broadcast(user, "offline")
        finally:
            realtime.active_connections.pop(user, None)
            realtime.active_connections.pop(other, None)
    asyncio.run(scenario())


def test_analytics_validation_and_atomic_cache(monkeypatch):
    class Session:
        fail = False
        rows = []

        async def get(self, *args):
            return None

        def add(self, row):
            self.rows.append(row)

        async def commit(self):
            if self.fail:
                raise RuntimeError("Database unavailable")

    async def scenario():
        monkeypatch.setattr(settings_store, "_cache", dict(settings_store.DEFAULTS))
        session = Session()
        with pytest.raises(ValueError):
            await settings_store.update_settings(session, {"app_name": "changed", "google_analytics_measurement_id": '<script>'})
        assert not session.rows
        assert settings_store.get("app_name") == "SplitEasy"
        await settings_store.update_settings(session, {"google_analytics_measurement_id": " g-abc1234567 "})
        assert settings_store.public_settings()["google_analytics_measurement_id"] == "G-ABC1234567"
        session.fail = True
        with pytest.raises(RuntimeError):
            await settings_store.update_settings(session, {"google_analytics_measurement_id": "G-OTHER12345"})
        assert settings_store.get("google_analytics_measurement_id") == "G-ABC1234567"
        session.fail = False
        await settings_store.update_settings(session, {"google_analytics_measurement_id": ""})
        assert settings_store.get("google_analytics_measurement_id") == ""
    asyncio.run(scenario())
