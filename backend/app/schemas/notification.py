from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationBase(BaseModel):
    message: str
    type: str = "info"
    link: Optional[str] = None


class NotificationCreate(NotificationBase):
    user_id: UUID


class NotificationRead(NotificationBase):
    id: UUID
    user_id: UUID
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationUpdate(BaseModel):
    is_read: bool
