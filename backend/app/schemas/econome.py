from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class JarStrategyBase(BaseModel):
    name: str
    nec: float
    ffa: float
    edu: float
    ltss: float
    play: float
    give: float


class JarStrategyCreate(JarStrategyBase):
    pass


class JarStrategyRead(JarStrategyBase):
    id: UUID
    user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class JarTransactionBase(BaseModel):
    jar_type: str
    amount: float
    description: str
    date: datetime = datetime.utcnow()


class JarTransactionCreate(JarTransactionBase):
    pass


class JarTransactionUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    date: Optional[datetime] = None


class JarTransactionRead(JarTransactionBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class JarBalance(BaseModel):
    jar_type: str
    balance: float


class IncomeSourceBase(BaseModel):
    name: str


class IncomeSourceCreate(IncomeSourceBase):
    pass


class IncomeSourceRead(IncomeSourceBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class MonthlySummary(BaseModel):
    month: str
    NEC: float = 0.0
    FFA: float = 0.0
    EDU: float = 0.0
    LTSS: float = 0.0
    PLAY: float = 0.0
    GIVE: float = 0.0
    total: float = 0.0


class IncomeLogRead(BaseModel):
    id: UUID
    user_id: UUID
    amount: float
    income_source: str
    strategy_name: str
    description: Optional[str] = None
    date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class IncomeLogUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    income_source: Optional[str] = None
    date: Optional[datetime] = None


class LedgerItem(BaseModel):
    id: UUID
    type: str
    amount: float
    description: str
    date: datetime
    jar_type: Optional[str] = None
    strategy_name: Optional[str] = None
    income_source: Optional[str] = None
