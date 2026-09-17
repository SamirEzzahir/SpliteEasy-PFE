"""Shared, cached rate snapshots for display-only currency estimates."""
import asyncio
import json
import math
import re
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen

from app.core.config import settings
from app.schemas.exchange_rates import ExchangeRateSnapshot

MAX_AGE = 7 * 24 * 60 * 60
_snapshot: ExchangeRateSnapshot | None = None
_retry_at = 0.0
_lock = asyncio.Lock()


class RatesUnavailable(Exception):
    pass


def _download() -> dict:
    # Fixed provider URLs; no account, group or expense data leaves the backend.
    if settings.CURRENCY_API_KEY:
        request = Request(
            "https://api.currencyapi.com/v3/latest?base_currency=USD&type=fiat",
            headers={"apikey": settings.CURRENCY_API_KEY, "Accept": "application/json"},
        )
    else:
        request = Request("https://open.er-api.com/v6/latest/USD", headers={"Accept": "application/json"})
    with urlopen(request, timeout=8) as response:
        return json.loads(response.read(1024 * 1024))


def _date(timestamp: float) -> datetime:
    return datetime.fromtimestamp(timestamp, timezone.utc)


def _normalize(data: dict, now: float) -> ExchangeRateSnapshot:
    if settings.CURRENCY_API_KEY:
        updated = datetime.fromisoformat(data["meta"]["last_updated_at"].replace("Z", "+00:00"))
        if updated.tzinfo is None:
            raise ValueError("Missing rate timezone")
        raw_rates = {code: item["value"] for code, item in data["data"].items()}
        interval = max(60, min(settings.CURRENCY_API_REFRESH_SECONDS, 86400))
        next_update = now + interval
        provider, url, frequency = "CurrencyAPI", "https://currencyapi.com", "Updates depend on provider plan"
    else:
        if data.get("result") != "success" or data.get("base_code") != "USD":
            raise ValueError("Invalid rate response")
        updated = _date(float(data["time_last_update_unix"]))
        next_update = float(data["time_next_update_unix"])
        raw_rates = data["rates"]
        provider, url, frequency = "ExchangeRate-API", "https://www.exchangerate-api.com", "Daily rates"
    rates = {}
    for code, value in raw_rates.items():
        if re.fullmatch(r"[A-Z]{3}", code) and not isinstance(value, bool):
            number = float(value)
            if math.isfinite(number) and number > 0:
                rates[code] = number
    age = now - updated.timestamp()
    if rates.get("USD") != 1 or len(rates) < 2 or age < -300 or age > MAX_AGE:
        raise ValueError("Invalid or expired rate data")
    if not math.isfinite(next_update) or next_update < updated.timestamp():
        raise ValueError("Invalid update time")
    return ExchangeRateSnapshot(
        rates=rates, updated_at=updated, next_update_at=_date(next_update),
        provider=provider, provider_url=url, update_frequency=frequency,
        stale=next_update <= now or age > 48 * 60 * 60,
    )


def _cached(now: float, failed: bool = False) -> ExchangeRateSnapshot:
    if _snapshot is None or now - _snapshot.updated_at.timestamp() > MAX_AGE:
        raise RatesUnavailable("Exchange rates are temporarily unavailable.")
    return _snapshot.model_copy(update={
        "stale": failed or _snapshot.stale or now >= _snapshot.next_update_at.timestamp(),
        "refresh_after_seconds": max(60, min(86400, int(_retry_at - now))),
    })


async def latest_rates() -> ExchangeRateSnapshot:
    global _snapshot, _retry_at
    async with _lock:
        now = time.time()
        if now < _retry_at:
            return _cached(now)
        try:
            data = await asyncio.to_thread(_download)
            now = time.time()
            _snapshot = _normalize(data, now)
            _retry_at = max(now + 60, min(now + 86400, _snapshot.next_update_at.timestamp()))
            return _cached(now)
        except Exception:
            # Back off even without a cache; never expose provider errors or keys.
            _retry_at = now + 60
            if _snapshot is not None:
                _snapshot = _snapshot.model_copy(update={"stale": True})
            try:
                return _cached(now, failed=True)
            except RatesUnavailable:
                raise RatesUnavailable("Exchange rates are temporarily unavailable.") from None
