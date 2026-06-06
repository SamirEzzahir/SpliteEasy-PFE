from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from .user import UserRead


class ActivityLogOut(BaseModel):
    id: int
    user_id: int
    action: str
    target_type: str | None
    target_id: int | None
    created_at: datetime
    user: UserRead

    class Config:
        from_attributes = True
