from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class GlobalSettlementMode(str, Enum):
    separate = "separate"
    auto_adjust = "auto_adjust"
    hybrid = "hybrid"


class RoleBase(BaseModel):
    name: str
    permissions: str = "[]"


class RoleCreate(RoleBase):
    pass


class RoleRead(RoleBase):
    id: int

    class Config:
        from_attributes = True


class ReclamationBase(BaseModel):
    subject: str
    message: str


class ReclamationCreate(ReclamationBase):
    pass


class ReclamationUpdate(BaseModel):
    status: str


class ReclamationRead(ReclamationBase):
    id: int
    user_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserBase(BaseModel):
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    profile_photo: Optional[str] = None
    is_active: Optional[bool] = True

    model_config = {"from_attributes": True}


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
    role_id: Optional[int] = None
    role: Optional[RoleRead] = None
    global_settlement_mode: Optional[GlobalSettlementMode] = GlobalSettlementMode.separate
    preferred_currency: Optional[str] = "USD"
    onboarding_completed: Optional[bool] = False

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
    preferred_currency: Optional[str] = None


class ChangePassword(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
