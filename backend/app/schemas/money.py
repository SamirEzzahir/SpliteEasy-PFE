from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

Amount = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2, allow_inf_nan=False)]
Balance = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2, allow_inf_nan=False)]
Currency = Literal["MAD", "EUR", "USD", "GBP", "CAD", "CHF", "AED", "SAR", "TND", "DZD"]
Jar = Literal["NEC", "FFA", "EDU", "LTSS", "PLAY", "GIVE"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TypeCreate(Input):
    name: str = Field(min_length=1, max_length=50)


class WalletCreate(Input):
    name: str = Field(min_length=1, max_length=50)
    wallet_type_id: UUID | None = None
    category: str = Field(default="Cash", min_length=1, max_length=50)
    currency: Currency = "MAD"
    balance: Balance = Decimal("0")
    idempotency_key: UUID | None = None


class WalletUpdate(Input):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    wallet_type_id: UUID | None = None
    currency: Currency | None = None
    archived: bool | None = None


class Record(Input):
    amount: Amount
    description: str = Field(min_length=1, max_length=255)
    date: datetime = Field(default_factory=datetime.utcnow)
    idempotency_key: UUID

    @field_validator("date")
    @classmethod
    def naive_utc(cls, value):
        return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


class IncomeCreate(Record):
    wallet_id: UUID
    income_type_id: UUID | None = None
    source: str = Field(default="Other income", min_length=1, max_length=50)
    allocate: bool = False
    strategy_id: UUID | None = None


class SpendingCreate(Record):
    wallet_id: UUID
    jar_type: Jar | None = None


class TransferCreate(Record):
    from_wallet_id: UUID
    to_wallet_id: UUID


class AdjustmentCreate(Input):
    balance: Balance
    description: str = Field(min_length=1, max_length=255)
    idempotency_key: UUID


class SettlementPost(Input):
    wallet_id: UUID
    idempotency_key: UUID


class BudgetTransfer(Record):
    from_jar: Jar
    to_jar: Jar
    currency: Currency = "MAD"


class BudgetAllocation(Input):
    event_id: UUID
    strategy_id: UUID | None = None
