from uuid import UUID
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from decimal import Decimal


class TransactionType(str, Enum):
    transfer = "transfer"
    debt = "debt"
    credit = "credit"


class WalletBase(BaseModel):
    name: str = Field(..., example="Main Wallet")
    category: str = Field("cash", example="bank")
    balance: float = Field(0.0, example=500.00)


class WalletCreate(WalletBase):
    pass


class WalletUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    balance: Optional[float] = None


class WalletRead(WalletBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IncomeTypeBase(BaseModel):
    name: str = Field(..., example="Salary")
    category: Optional[str] = Field(None, example="Work")


class IncomeTypeCreate(IncomeTypeBase):
    pass


class IncomeTypeUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None


class IncomeTypeRead(IncomeTypeBase):
    id: UUID
    user_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class IncomeBase(BaseModel):
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2, allow_inf_nan=False)
    source_type: Optional[str] = Field("bank", example="cash")
    note: Optional[str] = Field(None, example="October salary")
    date: datetime = Field(default_factory=datetime.utcnow)


class IncomeCreate(IncomeBase):
    income_type_id: UUID
    wallet_id: UUID


class IncomeRead(IncomeBase):
    id: UUID
    user_id: UUID
    income_type: IncomeTypeRead
    wallet: WalletRead
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IncomeUpdate(BaseModel):
    amount: Optional[Decimal] = Field(default=None, gt=0, max_digits=12, decimal_places=2, allow_inf_nan=False)
    source_type: Optional[str] = None
    note: Optional[str] = None
    date: Optional[datetime] = None
    income_type_id: Optional[UUID] = None
    wallet_id: Optional[UUID] = None


class IncomeReadWithNames(BaseModel):
    id: UUID
    user_id: UUID
    amount: float
    date: datetime
    note: str | None
    wallet_id: UUID
    wallet_name: str
    income_type_id: UUID
    category_name: str
    created_at: datetime
    updated_at: datetime


class TransactionBase(BaseModel):
    amount: float
    note: Optional[str] = None
    transaction_type: TransactionType = TransactionType.transfer


class TransactionCreate(TransactionBase):
    from_wallet_id: UUID
    to_wallet_id: Optional[UUID] = None


class TransactionRead(TransactionBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    from_wallet: WalletRead
    to_wallet: Optional[WalletRead] = None

    class Config:
        from_attributes = True
