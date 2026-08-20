from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from .user import UserRead


class ActivityLogOut(BaseModel):
    id: UUID
    user_id: UUID
    action: str
    target_type: str | None
    target_id: UUID | None
    created_at: datetime
    user: UserRead

    class Config:
        from_attributes = True
