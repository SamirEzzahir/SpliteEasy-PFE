from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import Optional
from app.models import Wallet, Transaction, TransactionType
from app.db import get_session
from app.auth import get_current_user
from app.schemas import WalletCreate, WalletRead, WalletUpdate

router = APIRouter(prefix="/wallets", tags=["Wallets"])

class WalletTransfer(BaseModel):
    from_wallet_id: int
    to_wallet_id: int
    amount: float
    note: str = ""


@router.post("", response_model=WalletRead)
async def create_wallet(wallet_data: WalletCreate, session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    wallet = Wallet(user_id=user.id, **wallet_data.dict())
    session.add(wallet)
    await session.commit()
    await session.refresh(wallet)
    return wallet

@router.get("", response_model=list[WalletRead])
async def list_wallets(session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    result = await session.execute(select(Wallet).filter(Wallet.user_id == user.id))
    return result.scalars().all()

@router.put("/{wallet_id}", response_model=WalletRead)
async def update_wallet(wallet_id: int, data: WalletUpdate, session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    wallet = await session.get(Wallet, wallet_id)
    if not wallet or wallet.user_id != user.id:
        raise HTTPException(status_code=404, detail="Wallet not found")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(wallet, key, value)
    await session.commit()
    await session.refresh(wallet)
    return wallet

@router.delete("/{wallet_id}")
async def delete_wallet(wallet_id: int, session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    wallet = await session.get(Wallet, wallet_id)
    if not wallet or wallet.user_id != user.id:
        raise HTTPException(status_code=404, detail="Wallet not found")
    await session.delete(wallet)
    await session.commit()
    return {"message": "Wallet deleted"}

@router.post("/transfer")
async def transfer_between_wallets(
    transfer_data: WalletTransfer, 
    session: AsyncSession = Depends(get_session), 
    user=Depends(get_current_user)
):
    # Get both wallets and verify ownership
    from_wallet = await session.get(Wallet, transfer_data.from_wallet_id)
    to_wallet = await session.get(Wallet, transfer_data.to_wallet_id)
    
    if not from_wallet or from_wallet.user_id != user.id:
        raise HTTPException(status_code=404, detail="Source wallet not found")
    
    if not to_wallet or to_wallet.user_id != user.id:
        raise HTTPException(status_code=404, detail="Destination wallet not found")
    
    if from_wallet.id == to_wallet.id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same wallet")
    
    if transfer_data.amount <= 0:
        raise HTTPException(status_code=400, detail="Transfer amount must be positive")
    
    # Convert amount to Decimal for comparison and calculation
    transfer_amount = Decimal(str(transfer_data.amount))
    
   
    
    if from_wallet.balance < transfer_amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Perform the transfer
    from_wallet.balance -= transfer_amount
    to_wallet.balance += transfer_amount
    
    # Create transaction record with transfer type
    transaction = Transaction(
        user_id=user.id,
        from_wallet_id=from_wallet.id,
        to_wallet_id=to_wallet.id,
        transaction_type=TransactionType.transfer,
        amount=float(transfer_amount),
        note=transfer_data.note or f"Transfer from {from_wallet.name} to {to_wallet.name}"
    )
    session.add(transaction)
    
    await session.commit()
    
    return {
        "message": "Transfer completed successfully",
        "transaction_id": transaction.id,
        "from_wallet": {"id": from_wallet.id, "name": from_wallet.name, "new_balance": float(from_wallet.balance)},
        "to_wallet": {"id": to_wallet.id, "name": to_wallet.name, "new_balance": float(to_wallet.balance)},
        "amount": transfer_data.amount
    }
