from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.models import Transaction
from backend.schemas import TransactionRead
from backend.db import get_session
from backend.auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("", response_model=list[TransactionRead])
async def list_transactions(
    session: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_user)
):
    """Get all transactions for the current user"""
    result = await session.execute(
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .options(
            selectinload(Transaction.from_wallet),
            selectinload(Transaction.to_wallet)
        )
        .order_by(Transaction.created_at.desc())
    )
    transactions = result.scalars().all()
    
    # Serialize with wallet names
    transaction_list = []
    for t in transactions:
        transaction_data = TransactionRead.model_validate(t)
        transaction_data.from_wallet_name = t.from_wallet.name if t.from_wallet else None
        transaction_data.to_wallet_name = t.to_wallet.name if t.to_wallet else None
        transaction_list.append(transaction_data)
    
    return transaction_list

@router.get("/{transaction_id}", response_model=TransactionRead)
async def get_transaction(
    transaction_id: int,
    session: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_user)
):
    """Get a specific transaction by ID"""
    result = await session.execute(
        select(Transaction)
        .where(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .options(
            selectinload(Transaction.from_wallet),
            selectinload(Transaction.to_wallet)
        )
    )
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    transaction_data = TransactionRead.model_validate(transaction)
    transaction_data.from_wallet_name = transaction.from_wallet.name if transaction.from_wallet else None
    transaction_data.to_wallet_name = transaction.to_wallet.name if transaction.to_wallet else None
    
    return transaction_data

