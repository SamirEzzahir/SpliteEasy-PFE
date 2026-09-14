from uuid import UUID
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel
from app.schemas.money import Amount, Currency


class DebtLoanStatus(str, Enum):
    active = "active"
    partially_paid = "partially_paid"
    fully_paid = "fully_paid"


class DebtBase(BaseModel):
    lender_name: str
    original_amount: float
    wallet_id: Optional[UUID] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None


class DebtCreate(DebtBase):
    original_amount: Amount
    currency: Currency = "MAD"
    idempotency_key: Optional[UUID] = None


class DebtUpdate(BaseModel):
    lender_name: Optional[str] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None


class DebtRead(DebtBase):
    currency: Optional[str] = None
    id: UUID
    user_id: UUID
    remaining_amount: float
    status: DebtLoanStatus
    created_at: datetime
    updated_at: datetime
    total_paid: float = 0.0

    class Config:
        from_attributes = True


class LoanBase(BaseModel):
    borrower_name: str
    original_amount: float
    wallet_id: Optional[UUID] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None


class LoanCreate(LoanBase):
    original_amount: Amount
    currency: Currency = "MAD"
    idempotency_key: Optional[UUID] = None


class LoanUpdate(BaseModel):
    borrower_name: Optional[str] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None


class LoanRead(LoanBase):
    currency: Optional[str] = None
    id: UUID
    user_id: UUID
    remaining_amount: float
    status: DebtLoanStatus
    created_at: datetime
    updated_at: datetime
    total_paid: float = 0.0

    class Config:
        from_attributes = True


class DebtRepaymentCreate(BaseModel):
    amount: Amount
    idempotency_key: Optional[UUID] = None
    wallet_id: Optional[UUID] = None
    note: Optional[str] = None


class DebtRepaymentRead(BaseModel):
    id: UUID
    debt_id: UUID
    amount: float
    wallet_id: Optional[UUID] = None
    wallet_name: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LoanRepaymentCreate(BaseModel):
    amount: Amount
    idempotency_key: Optional[UUID] = None
    wallet_id: Optional[UUID] = None
    note: Optional[str] = None


class LoanRepaymentRead(BaseModel):
    id: UUID
    loan_id: UUID
    amount: float
    wallet_id: Optional[UUID] = None
    wallet_name: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
