"""In-process platform settings store backed by the `app_settings` table.

Loaded once into a cache at startup; reads are cache hits (no per-request DB).
Writes upsert the row and refresh the cache. Values are stored as text and coerced
to the type of their entry in DEFAULTS.
"""
from typing import Any

from sqlalchemy import select

from app.core.db import async_session
from app.models import AppSetting

# key -> default (python-typed). The set of keys here IS the schema.
DEFAULTS: dict[str, Any] = {
    # General
    "app_name": "SplitEasy",
    "app_description": "Split bills, track balances, and settle up with friends.",
    "logo_url": "",
    "favicon_url": "",
    "default_language": "en",
    "default_timezone": "UTC",
    # Authentication
    "registration_enabled": True,
    "email_verification_enabled": False,
    "session_timeout_minutes": 60 * 24 * 7,  # 7 days
    "password_min_length": 6,
    # Maintenance
    "maintenance_mode": False,
    "maintenance_message": "SplitEasy is undergoing scheduled maintenance. Please check back soon.",
    "maintenance_allow_admins": True,
    # Upload (stored now, enforced once an upload subsystem exists)
    "upload_max_mb": 5,
    "upload_allowed_types": "jpg,jpeg,png,pdf",
    # Feature flags
    "feature_chat": True,
    "feature_notifications": True,
    "feature_budget": True,
    "feature_reports": True,
    "feature_support": True,
}

# Keys safe to expose without privileged auth (drives the frontend).
PUBLIC_KEYS = [
    "app_name", "app_description", "logo_url", "favicon_url",
    "default_language", "default_timezone",
    "maintenance_mode", "maintenance_message",
    "registration_enabled", "email_verification_enabled",
    "feature_chat", "feature_notifications", "feature_budget", "feature_reports", "feature_support",
]

_cache: dict[str, Any] = dict(DEFAULTS)


def _coerce(key: str, raw: Any) -> Any:
    default = DEFAULTS.get(key)
    if raw is None:
        return default
    if isinstance(default, bool):
        if isinstance(raw, bool):
            return raw
        return str(raw).strip().lower() in ("1", "true", "yes", "on")
    if isinstance(default, int):
        try:
            return int(raw)
        except (TypeError, ValueError):
            return default
    return str(raw)


def _to_text(val: Any) -> str:
    if isinstance(val, bool):
        return "true" if val else "false"
    return str(val)


async def load_settings() -> None:
    """Populate the cache from the DB. Call once at startup (after migrations)."""
    global _cache
    merged = dict(DEFAULTS)
    try:
        async with async_session() as session:
            rows = (await session.execute(select(AppSetting))).scalars().all()
            for r in rows:
                if r.key in DEFAULTS:
                    merged[r.key] = _coerce(r.key, r.value)
    except Exception as e:  # never let settings break startup
        print(f"⚠️  Settings load failed, using defaults: {e}")
    _cache = merged


def all_settings() -> dict[str, Any]:
    return dict(_cache)


def public_settings() -> dict[str, Any]:
    return {k: _cache.get(k, DEFAULTS.get(k)) for k in PUBLIC_KEYS}


def get(key: str, default: Any = None) -> Any:
    return _cache.get(key, DEFAULTS.get(key, default))


def get_bool(key: str) -> bool:
    return bool(_cache.get(key, DEFAULTS.get(key, False)))


def get_int(key: str) -> int:
    try:
        return int(_cache.get(key, DEFAULTS.get(key, 0)))
    except (TypeError, ValueError):
        return 0


async def update_settings(session, values: dict[str, Any]) -> dict[str, Any]:
    """Upsert known settings and refresh the cache. Unknown keys are ignored."""
    for key, val in values.items():
        if key not in DEFAULTS:
            continue
        stored = _to_text(val)
        existing = await session.get(AppSetting, key)
        if existing:
            existing.value = stored
        else:
            session.add(AppSetting(key=key, value=stored))
        _cache[key] = _coerce(key, stored)
    await session.commit()
    return all_settings()
