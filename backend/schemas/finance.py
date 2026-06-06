from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


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
    id: int
    user_id: int
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
    id: int
    user_id: Optional[int] = None

    class Config:
        from_attributes = True


class IncomeBase(BaseModel):
    amount: float = Field(..., example=1000.0)
    source_type: Optional[str] = Field("bank", example="cash")
    note: Optional[str] = Field(None, example="October salary")
    date: datetime = datetime.utcnow()


class IncomeCreate(IncomeBase):
    income_type_id: int
    wallet_id: int


class IncomeRead(IncomeBase):
    id: int
    user_id: int
    income_type: IncomeTypeRead
    wallet: WalletRead
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IncomeUpdate(BaseModel):
    amount: Optional[float] = None
    source_type: Optional[str] = None
    note: Optional[str] = None
    date: Optional[datetime] = None
    income_type_id: Optional[int] = None
    wallet_id: Optional[int] = None


class IncomeReadWithNames(BaseModel):
    id: int
    user_id: int
    amount: float
    date: datetime
    note: str | None
    wallet_id: int
    wallet_name: str
    income_type_id: int
    category_name: str
    created_at: datetime
    updated_at: datetime


class TransactionBase(BaseModel):
    amount: float
    note: Optional[str] = None
    transaction_type: TransactionType = TransactionType.transfer


class TransactionCreate(TransactionBase):
    from_wallet_id: int
    to_wallet_id: Optional[int] = None


class TransactionRead(TransactionBase):
    id: int
    user_id: int
    created_at: datetime
    from_wallet: WalletRead
    to_wallet: Optional[WalletRead] = None

    class Config:
        from_attributes = True
