"""Public platform settings (`/settings/public`).

Exposes the safe subset of settings (app identity, feature flags, maintenance
status) so the frontend can respect feature flags and show a maintenance state.
No privileged permission required — served from the in-process cache.
"""
from fastapi import APIRouter

from backend.core import settings_store

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/public")
async def get_public_settings():
    return settings_store.public_settings()
