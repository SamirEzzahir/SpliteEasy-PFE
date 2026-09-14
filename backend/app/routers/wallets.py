from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from app.auth import get_current_user
from app.db import get_session
from app.models import Wallet, MoneyEvent, WalletEntry, Debt, Loan
from app.schemas.money import WalletCreate, WalletUpdate, AdjustmentCreate, TransferCreate
from app.services import money
from pydantic import ValidationError
from app.core.money_access import require_money

router = APIRouter(prefix="/wallets", tags=["Wallets"], dependencies=[Depends(require_money)])


@router.get("")
async def list_wallets(include_archived: bool = False, session=Depends(get_session), user=Depends(get_current_user)):
    query = select(Wallet).where(Wallet.user_id == user.id)
    if not include_archived:
        query = query.where(Wallet.archived_at.is_(None))
    return [money.wallet_read(wallet) for wallet in (await session.scalars(query.order_by(Wallet.created_at, Wallet.id))).all()]


@router.post("")
async def create_wallet(data: WalletCreate, session=Depends(get_session), user=Depends(get_current_user)):
    await money.lock_owner(session, user.id)
    existing = await money.retry_event(session, user.id, data.idempotency_key, data)
    if existing:
        await session.refresh(existing, ["entries"])
        return money.wallet_read(await session.get(Wallet, existing.entries[0].wallet_id))
    wallet_type = await money.get_type(session, user.id, data.wallet_type_id) if data.wallet_type_id else await money.create_type(session, user.id, data.category)
    wallet = Wallet(user_id=user.id, name=data.name, category=wallet_type.name, wallet_type_id=wallet_type.id,
                    currency=data.currency, balance=0, ledger_started_at=datetime.utcnow())
    session.add(wallet)
    await session.flush()
    await money.post_event(session, user.id, "opening", "Opening balance", wallet.currency,
        [(wallet.id, data.balance)], event_amount=data.balance, source_type="wallet", source_id=wallet.id,
        key=data.idempotency_key, request=data)
    await session.commit()
    return money.wallet_read(wallet)


@router.get("/{wallet_id}")
async def get_wallet(wallet_id: UUID, session=Depends(get_session), user=Depends(get_current_user)):
    wallet = await session.scalar(select(Wallet).where(Wallet.id == wallet_id, Wallet.user_id == user.id))
    if not wallet:
        raise HTTPException(404, "Wallet not found")
    return money.wallet_read(wallet)


@router.put("/{wallet_id}")
async def edit_wallet(wallet_id: UUID, data: WalletUpdate, session=Depends(get_session), user=Depends(get_current_user)):
    await money.lock_owner(session, user.id)
    wallet = await money.get_wallet(session, user.id, wallet_id, archived=True, currency_required=False)
    if data.name is not None:
        wallet.name = data.name
    if data.wallet_type_id is not None:
        wallet_type = await money.get_type(session, user.id, data.wallet_type_id)
        wallet.wallet_type_id, wallet.category = wallet_type.id, wallet_type.name
    if data.currency is not None and data.currency != wallet.currency:
        if wallet.currency is not None:
            raise HTTPException(409, "A wallet's recorded currency cannot be changed. Create another wallet.")
        wallet.currency = data.currency
        for model in (Debt, Loan):
            await session.execute(update(model).where(model.user_id == user.id, model.wallet_id == wallet.id,
                model.currency.is_(None)).values(currency=data.currency))
        await session.execute(update(MoneyEvent).where(MoneyEvent.user_id == user.id, MoneyEvent.source_type == "cutover",
                                                       MoneyEvent.source_id == wallet.id).values(currency=data.currency))
        await session.execute(update(WalletEntry).where(WalletEntry.wallet_id == wallet.id, WalletEntry.currency == "UNK")
                              .values(currency=data.currency))
    if data.archived is not None:
        if data.archived and wallet.balance != 0:
            raise HTTPException(409, "Move or record the remaining balance before archiving this wallet")
        wallet.archived_at = datetime.utcnow() if data.archived else None
    await session.commit()
    return money.wallet_read(wallet)


@router.delete("/{wallet_id}")
async def archive_wallet(wallet_id: UUID, session=Depends(get_session), user=Depends(get_current_user)):
    return await edit_wallet(wallet_id, WalletUpdate(archived=True), session, user)


@router.post("/{wallet_id}/adjustments")
async def adjust_wallet(wallet_id: UUID, data: AdjustmentCreate, session=Depends(get_session), user=Depends(get_current_user)):
    await money.lock_owner(session, user.id)
    request = {**data.model_dump(mode="json"), "wallet_id": str(wallet_id)}
    existing = await money.retry_event(session, user.id, data.idempotency_key, request)
    if existing:
        return await money.event_read(session, existing)
    wallet = await money.get_wallet(session, user.id, wallet_id)
    delta = data.balance - wallet.balance
    event = await money.post_event(session, user.id, "adjustment", data.description, wallet.currency,
        [(wallet.id, delta)], event_amount=abs(delta), key=data.idempotency_key, request=request)
    await session.commit()
    return await money.event_read(session, event)


@router.get("/{wallet_id}/entries")
async def wallet_entries(wallet_id: UUID, page: int = 1, session=Depends(get_session), user=Depends(get_current_user)):
    from app.routers.money import activity
    return await activity(wallet_id=wallet_id, page=max(1, page), limit=20, session=session, user=user)


@router.post("/transfer")
async def legacy_transfer(data: dict, session=Depends(get_session), user=Depends(get_current_user)):
    from app.routers.money import transfer
    try:
        payload = TransferCreate(from_wallet_id=data.get("from_wallet_id"), to_wallet_id=data.get("to_wallet_id"),
            amount=data.get("amount"), description=data.get("note") or "Wallet transfer", idempotency_key=data.get("idempotency_key") or uuid4())
    except ValidationError:
        raise HTTPException(422, "Enter two valid wallet IDs and a positive amount with at most two decimals")
    event = await transfer(payload, session, user)
    return {"message": "Transfer recorded", "event": event, "transaction_id": event["id"]}
