from datetime import datetime
from enum import Enum
from typing import Generic, Optional, TypeVar
from pydantic import BaseModel, EmailStr, field_validator

from .user import RoleRead

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Generic pagination envelope (shared by every admin list endpoint)
# ---------------------------------------------------------------------------
class Paginated(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class AdminUserRead(BaseModel):
    id: int
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    profile_photo: Optional[str] = None
    is_active: bool = True
    status: str = "active"
    status_reason: Optional[str] = None
    email_verified: bool = False
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    role_id: Optional[int] = None
    role: Optional[RoleRead] = None
    preferred_currency: Optional[str] = None

    @field_validator("gender", mode="before")
    @classmethod
    def _coerce_enum(cls, v):
        # User.gender is a Python Enum (native_enum=False); serialize its value.
        return v.value if isinstance(v, Enum) else v

    class Config:
        from_attributes = True


class AdminUserDetail(AdminUserRead):
    groups_count: int = 0
    owned_groups_count: int = 0
    expenses_count: int = 0
    settlements_count: int = 0


class UserStatusUpdate(BaseModel):
    # active = restore, suspended = temporary block, banned = permanent block
    status: str
    reason: Optional[str] = None


class UserRoleUpdate(BaseModel):
    role_id: Optional[int] = None


class AdminUserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email_verified: Optional[bool] = None


class ResetPasswordIn(BaseModel):
    new_password: str


# ---------------------------------------------------------------------------
# Groups / Expenses / Settlements (admin read views with joined labels)
# ---------------------------------------------------------------------------
class AdminGroupRead(BaseModel):
    id: int
    title: str
    type: Optional[str] = None
    currency: Optional[str] = None
    owner_id: Optional[int] = None
    owner_username: Optional[str] = None
    members_count: int = 0
    expenses_count: int = 0
    created_at: Optional[datetime] = None


class TransferOwnerIn(BaseModel):
    new_owner_id: int


class AdminExpenseRead(BaseModel):
    id: int
    group_id: int
    group_title: Optional[str] = None
    payer_id: Optional[int] = None
    payer_username: Optional[str] = None
    description: Optional[str] = None
    amount: float
    currency: Optional[str] = None
    category: Optional[str] = None
    created_at: Optional[datetime] = None


class AdminSettlementRead(BaseModel):
    id: int
    group_id: Optional[int] = None
    from_user_id: int
    from_username: Optional[str] = None
    to_user_id: int
    to_username: Optional[str] = None
    amount: float
    status: str
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------
class AuditLogRead(BaseModel):
    id: int
    admin_id: Optional[int] = None
    admin_username: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    details: Optional[str] = None
    ip: Optional[str] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class DayCount(BaseModel):
    label: str
    value: int


class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    suspended_users: int
    banned_users: int
    new_users_7d: int
    total_groups: int
    total_expenses: int
    total_settlements: int
    pending_settlements: int
    pending_support: int
    signups_last_14d: list[DayCount]
    expenses_last_14d: list[DayCount]


# ---------------------------------------------------------------------------
# Roles & permissions
# ---------------------------------------------------------------------------
class RoleUpdate(BaseModel):
    name: Optional[str] = None
    permissions: Optional[str] = None  # JSON string array


class PermissionInfo(BaseModel):
    key: str
    label: str
    group: str


class PermissionCatalog(BaseModel):
    permissions: list[PermissionInfo]
