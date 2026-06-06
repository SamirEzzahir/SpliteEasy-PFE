from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class GroupBase(BaseModel):
    title: str
    currency: Optional[str] = "USD"
    type: Optional[str] = "Other"
    photo: Optional[str] = None
    owner_id: int


class GroupCreate(BaseModel):
    title: str
    currency: Optional[str] = "USD"
    type: Optional[str] = "Other"
    photo: Optional[str] = None
    member_ids: list[int] = []


class GroupRead(BaseModel):
    id: int
    title: str
    currency: str
    type: str
    photo: Optional[str]
    owner_id: int
    description: str
    owner_username: Optional[str] = None
    members_usernames: list[str] = []
    expenses_count: Optional[int] = 0
    total_amount: Optional[float] = 0.0
    has_unsettled_balance: Optional[bool] = False
    created_at: datetime

    class Config:
        from_attributes = True


class GroupMessageBase(BaseModel):
    content: str
    group_id: int


class GroupMessageCreate(GroupMessageBase):
    pass


class GroupMessageRead(GroupMessageBase):
    id: int
    user_id: int
    username: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MembershipBase(BaseModel):
    user_id: int
    group_id: int
    is_admin: Optional[bool] = False
    username: Optional[str] = None


class MembershipCreate(MembershipBase):
    pass


class MembershipUpdate(BaseModel):
    is_admin: bool


class MembershipRead(MembershipBase):
    id: int

    class Config:
        from_attributes = True
