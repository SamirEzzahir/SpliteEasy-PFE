from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationBase(BaseModel):
    message: str
    type: str = "info"
    link: Optional[str] = None


class NotificationCreate(NotificationBase):
    user_id: int


class NotificationRead(NotificationBase):
    id: int
    user_id: int
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationUpdate(BaseModel):
    is_read: bool
