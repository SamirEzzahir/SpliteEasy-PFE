from uuid import UUID
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class SplitBase(BaseModel):
    user_id: UUID
    share_amount: float
    username: Optional[str] = None


class SplitCreate(SplitBase):
    pass


class SplitRead(SplitBase):
    id: UUID
    expense_id: UUID
    user_id: UUID
    share_amount: float
    username: Optional[str] = None

    class Config:
        from_attributes = True


class ExpenseBase(BaseModel):
    group_id: Optional[UUID] = None
    payer_id: Optional[UUID] = None
    added_by: Optional[UUID] = None
    description: str
    amount: float
    currency: Optional[str] = None
    category: Optional[str] = None
    wallet_id: Optional[UUID] = None
    split_type: Optional[str] = "equal"
    jar_type: Optional[str] = None
    is_from_jar: Optional[bool] = False
    note: Optional[str] = None
    photo: Optional[str] = None


class ExpenseCreate(ExpenseBase):
    splits: List[SplitCreate] = []
    created_at: datetime


class ExpenseRead(BaseModel):
    id: UUID
    group_id: UUID
    payer_id: UUID
    added_by: UUID
    description: str
    amount: float
    currency: str
    category: str | None = None
    wallet_id: UUID | None = None
    split_type: str | None = None
    jar_type: str | None = None
    is_from_jar: bool | None = False
    note: str | None = None
    photo: str | None = None
    created_at: datetime
    updated_at: datetime
    splits: list[SplitRead] = []
    payer_username: str | None = None
    added_by_username: str | None = None
    group_name: str | None = None
    payer_name: str | None = None
    wallet_name: str | None = None

    class Config:
        from_attributes = True


class ExpenseUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    payer_id: Optional[UUID] = None
    wallet_id: Optional[UUID] = None
    split_type: Optional[str] = None
    jar_type: Optional[str] = None
    is_from_jar: Optional[bool] = None
    note: Optional[str] = None
    photo: Optional[str] = None
    splits: Optional[List[SplitCreate]] = None


class ExpensePaginatedResponse(BaseModel):
    expenses: List[ExpenseRead]
    total: int
    offset: int
    limit: int
    has_more: bool
