from uuid import UUID
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel


class SettlementStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class BalanceItem(BaseModel):
    user_id: UUID
    username: str
    net: float
    original_net: Optional[float] = None
    global_adjustment: Optional[float] = None


class SettlementCreate(BaseModel):
    to_user_id: UUID
    amount: float
    message: Optional[str] = None


class SettlementAction(BaseModel):
    reason: Optional[str] = None


class SettlementOut(BaseModel):
    id: Optional[UUID] = None
    group_id: UUID
    from_user_id: UUID
    from_username: str
    to_user_id: UUID
    to_username: str
    amount: float
    status: SettlementStatus
    message: Optional[str] = None
    proof_photo: Optional[str] = None
    rejected_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class GlobalSettlementCreate(BaseModel):
    to_user_id: UUID
    amount: float
    message: Optional[str] = None


class GlobalSettlementOut(BaseModel):
    id: Optional[UUID] = None
    from_user_id: UUID
    from_username: str
    to_user_id: UUID
    to_username: str
    amount: float
    status: SettlementStatus
    message: Optional[str] = None
    proof_photo: Optional[str] = None
    rejected_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
