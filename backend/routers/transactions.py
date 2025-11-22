from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.models import Transaction, TransactionType
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
        # Handle empty or invalid transaction_type values
        try:
            # Get transaction_type value
            if not t.transaction_type:
                transaction_type_value = TransactionType.transfer
            elif isinstance(t.transaction_type, str):
                # If it's a string, validate and convert
                if t.transaction_type in ['transfer', 'debt', 'credit']:
                    transaction_type_value = TransactionType(t.transaction_type)
                else:
                    transaction_type_value = TransactionType.transfer
            elif hasattr(t.transaction_type, 'value'):
                # If it's an enum, check if value is valid
                if t.transaction_type.value in ['transfer', 'debt', 'credit']:
                    transaction_type_value = t.transaction_type
                else:
                    transaction_type_value = TransactionType.transfer
            else:
                transaction_type_value = TransactionType.transfer
        except (ValueError, AttributeError):
            # If conversion fails, default to transfer
            transaction_type_value = TransactionType.transfer
        
        # Create transaction dict with corrected transaction_type
        transaction_dict = {
            'id': t.id,
            'user_id': t.user_id,
            'from_wallet_id': t.from_wallet_id,
            'to_wallet_id': t.to_wallet_id,
            'transaction_type': transaction_type_value,
            'amount': float(t.amount),
            'note': t.note,
            'created_at': t.created_at
        }
        
        transaction_data = TransactionRead.model_validate(transaction_dict)
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
    
    # Handle empty or invalid transaction_type values
    try:
        # Get transaction_type value
        if not transaction.transaction_type:
            transaction_type_value = TransactionType.transfer
        elif isinstance(transaction.transaction_type, str):
            # If it's a string, validate and convert
            if transaction.transaction_type in ['transfer', 'debt', 'credit']:
                transaction_type_value = TransactionType(transaction.transaction_type)
            else:
                transaction_type_value = TransactionType.transfer
        elif hasattr(transaction.transaction_type, 'value'):
            # If it's an enum, check if value is valid
            if transaction.transaction_type.value in ['transfer', 'debt', 'credit']:
                transaction_type_value = transaction.transaction_type
            else:
                transaction_type_value = TransactionType.transfer
        else:
            transaction_type_value = TransactionType.transfer
    except (ValueError, AttributeError):
        # If conversion fails, default to transfer
        transaction_type_value = TransactionType.transfer
    
    # Create transaction dict with corrected transaction_type
    transaction_dict = {
        'id': transaction.id,
        'user_id': transaction.user_id,
        'from_wallet_id': transaction.from_wallet_id,
        'to_wallet_id': transaction.to_wallet_id,
        'transaction_type': transaction_type_value,
        'amount': float(transaction.amount),
        'note': transaction.note,
        'created_at': transaction.created_at
    }
    
    transaction_data = TransactionRead.model_validate(transaction_dict)
    transaction_data.from_wallet_name = transaction.from_wallet.name if transaction.from_wallet else None
    transaction_data.to_wallet_name = transaction.to_wallet.name if transaction.to_wallet else None
    
    return transaction_data

