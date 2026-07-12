from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel


class DebtLoanStatus(str, Enum):
    active = "active"
    partially_paid = "partially_paid"
    fully_paid = "fully_paid"


class DebtBase(BaseModel):
    lender_name: str
    original_amount: float
    wallet_id: Optional[int] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None


class DebtCreate(DebtBase):
    pass


class DebtUpdate(BaseModel):
    lender_name: Optional[str] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None


class DebtRead(DebtBase):
    id: int
    user_id: int
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
    wallet_id: Optional[int] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None


class LoanCreate(LoanBase):
    pass


class LoanUpdate(BaseModel):
    borrower_name: Optional[str] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None


class LoanRead(LoanBase):
    id: int
    user_id: int
    remaining_amount: float
    status: DebtLoanStatus
    created_at: datetime
    updated_at: datetime
    total_paid: float = 0.0

    class Config:
        from_attributes = True


class DebtRepaymentCreate(BaseModel):
    amount: float
    wallet_id: Optional[int] = None
    note: Optional[str] = None


class DebtRepaymentRead(BaseModel):
    id: int
    debt_id: int
    amount: float
    wallet_id: Optional[int] = None
    wallet_name: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LoanRepaymentCreate(BaseModel):
    amount: float
    wallet_id: Optional[int] = None
    note: Optional[str] = None


class LoanRepaymentRead(BaseModel):
    id: int
    loan_id: int
    amount: float
    wallet_id: Optional[int] = None
    wallet_name: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
