from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, EmailStr

# ======================
# FriendStatus Enum
# ======================
class FriendStatus(str, Enum):
    pending = "Pending"
    accepted = "Accepted"
    rejected = "Rejected"

# ======================
# User Schemas
# ======================
class UserBase(BaseModel):
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    profile_photo: Optional[str] = None
    is_active: Optional[bool] = True
    is_admin: Optional[bool] = False


    model_config = {
        "from_attributes": True
    }

class UserCreate(UserBase):
    password: str

class UserRead(BaseModel):
    id: int
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    profile_photo: Optional[str] = None
    is_active: Optional[bool] = True
    is_admin: Optional[bool] = False


    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    profile_photo: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# ======================
# Group Schemas
# ======================
class GroupBase(BaseModel):
    title: str
    currency: Optional[str] = "USD"
    type: Optional[str] = "Other"
    photo: Optional[str] = None
    owner_id: int

# For input
class GroupCreate(BaseModel):
    title: str
    currency: Optional[str] = "USD"
    type: Optional[str] = "Other"
    photo: Optional[str] = None
    member_ids: list[int] = []

# For output
class GroupRead(BaseModel):
    id: int
    title: str
    currency: str
    type: str
    photo: Optional[str]
    owner_id: int
    owner_username: Optional[str] = None
    members_usernames: list[str] = []
    created_at: datetime

    class Config:
        from_attributes = True



# ======================
# Membership Schemas
# ======================
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

# ======================
# Splites Schemas
# ======================
class SplitBase(BaseModel):
    user_id: int
    share_amount: float
    username: Optional[str] = None

class SplitCreate(SplitBase):
    pass

class SplitRead(SplitBase):
    id: int
    expense_id: int
    user_id: int
    share_amount: float
    username: Optional[str] = None

    class Config:
        from_attributes = True

 
        
# ======================
# Expense Schemas
# ======================

class ExpenseBase(BaseModel):
    group_id: Optional[int] = None
    payer_id: Optional[int] = None
    description: str
    amount: float
    currency: str
    category: Optional[str] = None
    split_type: Optional[str] = "equal"
    note: Optional[str] = None
    photo: Optional[str] = None

class ExpenseCreate(ExpenseBase):
    splits: List[SplitCreate] = []

class ExpenseRead(BaseModel):
    id: int
    group_id: int
    payer_id: int
    description: str
    amount: float
    currency: str
    category: str | None = None
    split_type: str | None = None
    note: str | None = None
    photo: str | None = None
    created_at: datetime
    updated_at: datetime 
    splits: list[SplitRead] = []
    payer_username: str | None = None

    class Config:
        from_attributes = True

class ExpenseUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    split_type: Optional[str] = None
    note: Optional[str] = None
    photo: Optional[str] = None
    splits: Optional[List[SplitCreate]] = None

# ======================
# Friend Schemas
# ======================
class FriendBase(BaseModel):
    user_id: int
    friend_id: int
    status: FriendStatus = FriendStatus.pending

class FriendCreate(FriendBase):
    pass

class FriendRead(FriendBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ======================
# Balance / Settlement
# ======================
class BalanceItem(BaseModel):
    user_id: int
    username: str
    net: float
 
class SettlementCreate(BaseModel):
    to_user_id: int
    amount: float

class SettlementOut(BaseModel):
    id: Optional[int] = None
    from_user_id: int
    from_username: str
    to_user_id: int
    to_username: str
    amount: float
    created_at: Optional[datetime] = None





class ActivityLogOut(BaseModel):
    user_id: int
    username: str
    action: str
    target_type: str | None
    target_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True
