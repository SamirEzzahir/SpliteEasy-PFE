from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from app.auth import get_current_user
from app.db import get_session
from app.models import Wallet, WalletType
from app.schemas.money import TypeCreate
from app.services import money
from app.core.money_access import require_money

router = APIRouter(prefix="/wallet-types", tags=["Wallet types"], dependencies=[Depends(require_money)])


@router.get("")
async def list_types(session=Depends(get_session), user=Depends(get_current_user)):
    return (await session.scalars(select(WalletType).where(
        (WalletType.user_id == user.id) | WalletType.user_id.is_(None), WalletType.archived_at.is_(None))
        .order_by(WalletType.user_id.nullsfirst(), WalletType.name))).all()


@router.post("")
async def create_type(data: TypeCreate, session=Depends(get_session), user=Depends(get_current_user)):
    record = await money.create_type(session, user.id, data.name)
    await session.commit()
    return record


@router.put("/{type_id}")
async def rename_type(type_id: UUID, data: TypeCreate, session=Depends(get_session), user=Depends(get_current_user)):
    await money.lock_owner(session, user.id)
    record = await session.scalar(select(WalletType).where(WalletType.id == type_id, WalletType.user_id == user.id))
    if not record:
        raise HTTPException(404, "Custom wallet type not found")
    existing = await session.scalar(select(WalletType).where(WalletType.name_key == data.name.lower(), WalletType.id != type_id,
        (WalletType.user_id == user.id) | WalletType.user_id.is_(None)))
    if existing:
        raise HTTPException(409, "This wallet type already exists")
    record.name, record.name_key = data.name, data.name.lower()
    await session.execute(update(Wallet).where(Wallet.user_id == user.id, Wallet.wallet_type_id == type_id).values(category=data.name))
    await session.commit()
    return record


@router.delete("/{type_id}")
async def archive_type(type_id: UUID, session=Depends(get_session), user=Depends(get_current_user)):
    await money.lock_owner(session, user.id)
    record = await session.scalar(select(WalletType).where(WalletType.id == type_id, WalletType.user_id == user.id))
    if not record:
        raise HTTPException(404, "Custom wallet type not found")
    record.archived_at = datetime.utcnow()
    await session.commit()
    return {"message": "Type archived. Existing wallets and their history are preserved."}
