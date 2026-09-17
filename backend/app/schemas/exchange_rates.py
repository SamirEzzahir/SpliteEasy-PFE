from datetime import datetime

from pydantic import BaseModel


class ExchangeRateSnapshot(BaseModel):
    base_currency: str = "USD"
    rates: dict[str, float]
    updated_at: datetime
    next_update_at: datetime
    provider: str
    provider_url: str
    update_frequency: str
    stale: bool = False
    refresh_after_seconds: int = 60
