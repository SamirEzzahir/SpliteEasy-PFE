from uuid import UUID
from datetime import datetime
from enum import Enum
from pydantic import BaseModel


class FriendStatus(str, Enum):
    pending = "Pending"
    accepted = "Accepted"
    rejected = "Rejected"


class FriendBase(BaseModel):
    user_id: UUID
    friend_id: UUID
    status: FriendStatus = FriendStatus.pending


class FriendCreate(FriendBase):
    pass


class FriendRead(FriendBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
