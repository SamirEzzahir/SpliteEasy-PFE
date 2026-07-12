"""Smoke tests — verify the FastAPI app imports and wires up its routes.

These run without a database (importing the app only builds the ASGI object and
registers routers; DB connections happen lazily at request/startup time).
"""
from app.main import app


def test_app_imports_and_has_routes():
    assert len(app.routes) > 50


def test_health_route_registered():
    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/" in paths
