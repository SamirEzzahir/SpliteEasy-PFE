from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.schemas.exchange_rates import ExchangeRateSnapshot
from app.services.exchange_rates import RatesUnavailable, latest_rates

router = APIRouter(prefix="/exchange-rates", tags=["Exchange rates"])


@router.get("/latest", response_model=ExchangeRateSnapshot, dependencies=[Depends(get_current_user)])
async def get_latest_rates():
    try:
        return await latest_rates()
    except RatesUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc), headers={"Retry-After": "60"}) from None
