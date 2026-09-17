import asyncio
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.routers.exchange_rates import router
from app.services import exchange_rates as service

NOW = 1800000000.0


def daily(now=NOW, rates=None):
    return {
        "result": "success", "base_code": "USD",
        "time_last_update_unix": now - 10,
        "time_next_update_unix": now + 86400,
        "rates": rates or {"USD": 1, "MAD": 10, "EUR": 0.8},
    }


@pytest.fixture(autouse=True)
def isolated_cache(monkeypatch):
    monkeypatch.setattr(service, "_snapshot", None)
    monkeypatch.setattr(service, "_retry_at", 0)
    monkeypatch.setattr(service, "_lock", asyncio.Lock())
    monkeypatch.setattr(service.time, "time", lambda: NOW)
    monkeypatch.setattr(service.settings, "CURRENCY_API_KEY", "")


def test_daily_cache_shared_across_requests(monkeypatch):
    calls = []
    monkeypatch.setattr(service, "_download", lambda: calls.append(1) or daily())

    async def scenario():
        results = await asyncio.gather(*(service.latest_rates() for _ in range(10)))
        assert len(calls) == 1
        assert all(result.rates["MAD"] == 10 for result in results)
        assert results[0].update_frequency == "Daily rates"
        assert not results[0].stale
        assert results[0].refresh_after_seconds == 86400
        monkeypatch.setattr(service.time, "time", lambda: NOW + 86401)
        monkeypatch.setattr(service, "_download", lambda: calls.append(1) or daily(NOW + 86401))
        assert not (await service.latest_rates()).stale
        assert len(calls) == 2
    asyncio.run(scenario())


def test_failure_uses_labelled_stale_cache_then_expires(monkeypatch):
    monkeypatch.setattr(service, "_download", lambda: daily())

    def fail():
        raise TimeoutError("provider error containing secret")

    async def scenario():
        await service.latest_rates()
        monkeypatch.setattr(service.time, "time", lambda: NOW + 86401)
        monkeypatch.setattr(service, "_download", fail)
        old = await service.latest_rates()
        assert old.stale and old.rates["MAD"] == 10
        assert (await service.latest_rates()).stale
        monkeypatch.setattr(service.time, "time", lambda: NOW + service.MAX_AGE + 100)
        with pytest.raises(service.RatesUnavailable, match="temporarily unavailable"):
            await service.latest_rates()
    asyncio.run(scenario())


def test_failure_without_cache_backs_off(monkeypatch):
    calls = []

    def fail():
        calls.append(1)
        raise OSError("offline")

    monkeypatch.setattr(service, "_download", fail)

    async def scenario():
        for _ in range(3):
            with pytest.raises(service.RatesUnavailable):
                await service.latest_rates()
        assert len(calls) == 1
    asyncio.run(scenario())


@pytest.mark.parametrize("data", [
    {"result": "error"},
    daily(NOW - service.MAX_AGE - 100),
    daily(NOW + 1000),
    daily(rates={"USD": 2, "MAD": 10}),
    daily(rates={"USD": 1, "MAD": float("nan")}),
    daily(rates={"USD": 1, "MAD": -10}),
])
def test_invalid_provider_response_is_not_a_conversion(data):
    with pytest.raises((ValueError, KeyError)):
        service._normalize(data, NOW)


def test_key_provider_uses_actual_timestamp_and_configured_refresh(monkeypatch):
    monkeypatch.setattr(service.settings, "CURRENCY_API_KEY", "test-only")
    monkeypatch.setattr(service.settings, "CURRENCY_API_REFRESH_SECONDS", 60)
    data = {
        "meta": {"last_updated_at": datetime.fromtimestamp(NOW - 30, timezone.utc).isoformat()},
        "data": {"USD": {"value": 1}, "MAD": {"value": 9.5}},
    }
    result = service._normalize(data, NOW)
    assert result.provider == "CurrencyAPI"
    assert result.updated_at.timestamp() == NOW - 30
    assert result.next_update_at.timestamp() == NOW + 60
    assert "test-only" not in result.model_dump_json()


def test_endpoint_auth_and_generic_failure(monkeypatch):
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        assert client.get("/exchange-rates/latest").status_code == 401
        app.dependency_overrides[get_current_user] = lambda: object()
        monkeypatch.setattr(service, "_download", lambda: {"error": "private-provider-error"})
        response = client.get("/exchange-rates/latest")
        assert response.status_code == 503
        assert response.headers["retry-after"] == "60"
        assert "private-provider-error" not in response.text
