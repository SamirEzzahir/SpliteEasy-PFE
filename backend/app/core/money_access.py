from fastapi import HTTPException
from app.core.settings_store import get_bool


def require_money():
    if not get_bool("feature_personal_finance"):
        raise HTTPException(403, "My Money is currently unavailable")
