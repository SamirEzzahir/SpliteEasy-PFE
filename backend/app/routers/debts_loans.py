import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from decimal import Decimal
from datetime import datetime
from typing import List, Optional

from app.models import Debt, Loan, DebtRepayment, LoanRepayment, Wallet, DebtLoanStatus
from app.schemas import (
    DebtCreate, DebtRead, DebtUpdate,
    LoanCreate, LoanRead, LoanUpdate,
    DebtRepaymentCreate, DebtRepaymentRead,
    LoanRepaymentCreate, LoanRepaymentRead
)
from app.db import get_session
from app.services import money
from app.auth import get_current_user

router = APIRouter(prefix="/debts-loans", tags=["Debts & Loans"])


# ======================
# DEBTS (Money you owe)
# ======================

@router.post("/debts", response_model=DebtRead)
async def create_debt(
    debt_data: DebtCreate,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Create a new debt (money you borrowed)"""
    await money.lock_owner(session, user.id)
    previous = await money.retry_event(session, user.id, debt_data.idempotency_key, debt_data)
    if previous:
        return await get_debt(previous.source_id, session, user)
    if debt_data.original_amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    
    # If wallet_id is provided, verify ownership and increase balance
    wallet = None
    if debt_data.wallet_id:
        wallet = await money.get_wallet(session, user.id, debt_data.wallet_id)
        if wallet.currency != debt_data.currency:
            raise HTTPException(422, "Wallet and debt currencies must match")
    
    # Create debt record
    debt = Debt(
        user_id=user.id,
        currency=debt_data.currency,
        lender_name=debt_data.lender_name,
        original_amount=debt_data.original_amount,
        remaining_amount=debt_data.original_amount,
        status=DebtLoanStatus.active,
        wallet_id=debt_data.wallet_id,
        due_date=money.utc(debt_data.due_date) if debt_data.due_date else None,
        note=debt_data.note
    )
    session.add(debt)
    await session.flush()
    await money.post_event(session, user.id, "debt", "Borrowed from " + debt.lender_name, debt.currency,
        [(wallet.id, money.amount(debt.original_amount) * 1)] if wallet else [],
        event_amount=debt.original_amount, source_type="debt", source_id=debt.id,
        key=debt_data.idempotency_key, request=debt_data)
    await session.commit()
    await session.refresh(debt)
    
    return DebtRead(
        id=debt.id,
        currency=debt.currency,
        user_id=debt.user_id,
        lender_name=debt.lender_name,
        original_amount=float(debt.original_amount),
        remaining_amount=float(debt.remaining_amount),
        status=debt.status,
        wallet_id=debt.wallet_id,
        due_date=debt.due_date,
        note=debt.note,
        created_at=debt.created_at,
        updated_at=debt.updated_at,
        total_paid=0.0
    )


@router.get("/debts", response_model=List[DebtRead])
async def list_debts(
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get all debts for the current user"""
    query = select(Debt).where(Debt.user_id == user.id)
    
    if status:
        try:
            status_enum = DebtLoanStatus(status)
            query = query.where(Debt.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    
    result = await session.execute(query.order_by(Debt.created_at.desc()))
    debts = result.scalars().all()
    
    debt_list = []
    for debt in debts:
        # Calculate total paid
        repayments_result = await session.execute(
            select(DebtRepayment).where(DebtRepayment.debt_id == debt.id)
        )
        repayments = repayments_result.scalars().all()
        total_paid = sum(float(r.amount) for r in repayments)
        
        debt_list.append(DebtRead(
            id=debt.id,
            currency=debt.currency,
            user_id=debt.user_id,
            lender_name=debt.lender_name,
            original_amount=float(debt.original_amount),
            remaining_amount=float(debt.remaining_amount),
            status=debt.status,
            wallet_id=debt.wallet_id,
            due_date=debt.due_date,
            note=debt.note,
            created_at=debt.created_at,
            updated_at=debt.updated_at,
            total_paid=total_paid
        ))
    
    return debt_list


@router.get("/debts/{debt_id}", response_model=DebtRead)
async def get_debt(
    debt_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get a specific debt by ID"""
    result = await session.execute(
        select(Debt).where(Debt.id == debt_id, Debt.user_id == user.id)
    )
    debt = result.scalar_one_or_none()
    
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    # Calculate total paid
    repayments_result = await session.execute(
        select(DebtRepayment).where(DebtRepayment.debt_id == debt.id)
    )
    repayments = repayments_result.scalars().all()
    total_paid = sum(float(r.amount) for r in repayments)
    
    return DebtRead(
        id=debt.id,
        currency=debt.currency,
        user_id=debt.user_id,
        lender_name=debt.lender_name,
        original_amount=float(debt.original_amount),
        remaining_amount=float(debt.remaining_amount),
        status=debt.status,
        wallet_id=debt.wallet_id,
        due_date=debt.due_date,
        note=debt.note,
        created_at=debt.created_at,
        updated_at=debt.updated_at,
        total_paid=total_paid
    )


@router.put("/debts/{debt_id}", response_model=DebtRead)
async def update_debt(
    debt_id: uuid.UUID,
    debt_data: DebtUpdate,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Update a debt"""
    result = await session.execute(
        select(Debt).where(Debt.id == debt_id, Debt.user_id == user.id)
    )
    debt = result.scalar_one_or_none()
    
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    # Update fields
    if debt_data.lender_name is not None:
        debt.lender_name = debt_data.lender_name
    if debt_data.due_date is not None:
        debt.due_date = debt_data.due_date
    if debt_data.note is not None:
        debt.note = debt_data.note
    
    debt.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(debt)
    
    # Calculate total paid
    repayments_result = await session.execute(
        select(DebtRepayment).where(DebtRepayment.debt_id == debt.id)
    )
    repayments = repayments_result.scalars().all()
    total_paid = sum(float(r.amount) for r in repayments)
    
    return DebtRead(
        id=debt.id,
        currency=debt.currency,
        user_id=debt.user_id,
        lender_name=debt.lender_name,
        original_amount=float(debt.original_amount),
        remaining_amount=float(debt.remaining_amount),
        status=debt.status,
        wallet_id=debt.wallet_id,
        due_date=debt.due_date,
        note=debt.note,
        created_at=debt.created_at,
        updated_at=debt.updated_at,
        total_paid=total_paid
    )


@router.delete("/debts/{debt_id}")
async def delete_debt(
    debt_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Delete a debt"""
    await money.lock_owner(session, user.id)
    result = await session.execute(
        select(Debt).where(Debt.id == debt_id, Debt.user_id == user.id)
    )
    debt = result.scalar_one_or_none()
    
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    payments = await session.scalar(select(DebtRepayment.id).where(DebtRepayment.debt_id == debt.id).limit(1))
    if payments:
        raise HTTPException(409, "Records with repayments cannot be deleted. Payment history must be preserved.")
    event = await money.active_source_event(session, user.id, "debt", debt.id)
    if event:
        await money.reverse_event(session, user.id, event.id, internal=True)
    elif debt.wallet_id:
        wallet = await money.get_wallet(session, user.id, debt.wallet_id, archived=True)
        await money.post_event(session, user.id, "reversal", "Debt cancelled", wallet.currency,
            [(wallet.id, money.amount(debt.original_amount) * -1)], source_type="debt", source_id=debt.id, allow_archived=True)
    
    await session.delete(debt)
    await session.commit()
    
    return {"message": "Debt deleted successfully"}


@router.post("/debts/{debt_id}/repay", response_model=DebtRepaymentRead)
async def repay_debt(
    debt_id: uuid.UUID,
    repayment_data: DebtRepaymentCreate,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Record a repayment for a debt"""
    await money.lock_owner(session, user.id)
    request = {**repayment_data.model_dump(mode="json"), "debt_id": str(debt_id)}
    previous = await money.retry_event(session, user.id, repayment_data.idempotency_key, request)
    if previous:
        record = await session.get(DebtRepayment, previous.source_id)
        return DebtRepaymentRead.model_validate(record)
    if repayment_data.amount <= 0:
        raise HTTPException(status_code=400, detail="Repayment amount must be greater than 0")
    
    # Get debt
    result = await session.execute(
        select(Debt).where(Debt.id == debt_id, Debt.user_id == user.id)
    )
    debt = result.scalar_one_or_none()
    
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    if debt.remaining_amount <= 0:
        raise HTTPException(status_code=400, detail="This debt is already fully paid")
    
    repayment_amount = Decimal(str(repayment_data.amount))
    
    if repayment_amount > debt.remaining_amount:
        raise HTTPException(status_code=400, detail=f"Repayment amount ({repayment_data.amount}) exceeds remaining debt ({float(debt.remaining_amount)})")
    
    # If wallet_id is provided, verify ownership and decrease balance
    wallet = None
    if repayment_data.wallet_id:
        wallet = await money.get_wallet(session, user.id, repayment_data.wallet_id)
        if wallet.currency != debt.currency:
            raise HTTPException(422, "The wallet must match the recorded debt currency")
    
    # Create repayment record
    repayment = DebtRepayment(
        debt_id=debt_id,
        amount=repayment_amount,
        wallet_id=repayment_data.wallet_id,
        note=repayment_data.note
    )
    session.add(repayment)
    await session.flush()
    await money.post_event(session, user.id, "repayment", "Debt repayment", debt.currency or "UNK",
        [(wallet.id, repayment_amount * -1)] if wallet else [], event_amount=repayment_amount,
        source_type="debt_repayment", source_id=repayment.id, key=repayment_data.idempotency_key, request=request)
    
    # Update debt
    debt.remaining_amount -= repayment_amount  # Both are Decimal, so this works
    if debt.remaining_amount <= Decimal('0.00'):  # Consider fully paid if less than 1 cent
        debt.remaining_amount = Decimal('0.0')
        debt.status = DebtLoanStatus.fully_paid
    elif debt.remaining_amount < debt.original_amount:
        debt.status = DebtLoanStatus.partially_paid
    debt.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(repayment)
    
    # Get wallet name if exists
    wallet_name = None
    if repayment.wallet_id:
        wallet_result = await session.get(Wallet, repayment.wallet_id)
        if wallet_result:
            wallet_name = wallet_result.name
    
    return DebtRepaymentRead(
        id=repayment.id,
        debt_id=repayment.debt_id,
        amount=float(repayment.amount),
        wallet_id=repayment.wallet_id,
        wallet_name=wallet_name,
        note=repayment.note,
        created_at=repayment.created_at
    )


@router.get("/debts/{debt_id}/repayments", response_model=List[DebtRepaymentRead])
async def get_debt_repayments(
    debt_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get all repayments for a debt"""
    # Verify debt belongs to user
    result = await session.execute(
        select(Debt).where(Debt.id == debt_id, Debt.user_id == user.id)
    )
    debt = result.scalar_one_or_none()
    
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    # Get repayments
    repayments_result = await session.execute(
        select(DebtRepayment)
        .where(DebtRepayment.debt_id == debt_id)
        .order_by(DebtRepayment.created_at.desc())
    )
    repayments = repayments_result.scalars().all()
    
    repayment_list = []
    for repayment in repayments:
        wallet_name = None
        if repayment.wallet_id:
            wallet_result = await session.get(Wallet, repayment.wallet_id)
            if wallet_result:
                wallet_name = wallet_result.name
        
        repayment_list.append(DebtRepaymentRead(
            id=repayment.id,
            debt_id=repayment.debt_id,
            amount=float(repayment.amount),
            wallet_id=repayment.wallet_id,
            wallet_name=wallet_name,
            note=repayment.note,
            created_at=repayment.created_at
        ))
    
    return repayment_list


# ======================
# LOANS (Money others owe you)
# ======================

@router.post("/loans", response_model=LoanRead)
async def create_loan(
    loan_data: LoanCreate,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Create a new loan (money you lent)"""
    await money.lock_owner(session, user.id)
    previous = await money.retry_event(session, user.id, loan_data.idempotency_key, loan_data)
    if previous:
        return await get_loan(previous.source_id, session, user)
    if loan_data.original_amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    
    # If wallet_id is provided, verify ownership and decrease balance
    wallet = None
    if loan_data.wallet_id:
        wallet = await money.get_wallet(session, user.id, loan_data.wallet_id)
        if wallet.currency != loan_data.currency:
            raise HTTPException(422, "Wallet and loan currencies must match")
    
    # Create loan record
    loan = Loan(
        user_id=user.id,
        currency=loan_data.currency,
        borrower_name=loan_data.borrower_name,
        original_amount=loan_data.original_amount,
        remaining_amount=loan_data.original_amount,
        status=DebtLoanStatus.active,
        wallet_id=loan_data.wallet_id,
        due_date=money.utc(loan_data.due_date) if loan_data.due_date else None,
        note=loan_data.note
    )
    session.add(loan)
    await session.flush()
    await money.post_event(session, user.id, "loan", "Lent to " + loan.borrower_name, loan.currency,
        [(wallet.id, money.amount(loan.original_amount) * -1)] if wallet else [],
        event_amount=loan.original_amount, source_type="loan", source_id=loan.id,
        key=loan_data.idempotency_key, request=loan_data)
    await session.commit()
    await session.refresh(loan)
    
    return LoanRead(
        id=loan.id,
        currency=loan.currency,
        user_id=loan.user_id,
        borrower_name=loan.borrower_name,
        original_amount=float(loan.original_amount),
        remaining_amount=float(loan.remaining_amount),
        status=loan.status,
        wallet_id=loan.wallet_id,
        due_date=loan.due_date,
        note=loan.note,
        created_at=loan.created_at,
        updated_at=loan.updated_at,
        total_paid=0.0
    )


@router.get("/loans", response_model=List[LoanRead])
async def list_loans(
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get all loans for the current user"""
    query = select(Loan).where(Loan.user_id == user.id)
    
    if status:
        try:
            status_enum = DebtLoanStatus(status)
            query = query.where(Loan.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    
    result = await session.execute(query.order_by(Loan.created_at.desc()))
    loans = result.scalars().all()
    
    loan_list = []
    for loan in loans:
        # Calculate total paid
        repayments_result = await session.execute(
            select(LoanRepayment).where(LoanRepayment.loan_id == loan.id)
        )
        repayments = repayments_result.scalars().all()
        total_paid = sum(float(r.amount) for r in repayments)
        
        loan_list.append(LoanRead(
            id=loan.id,
            currency=loan.currency,
            user_id=loan.user_id,
            borrower_name=loan.borrower_name,
            original_amount=float(loan.original_amount),
            remaining_amount=float(loan.remaining_amount),
            status=loan.status,
            wallet_id=loan.wallet_id,
            due_date=loan.due_date,
            note=loan.note,
            created_at=loan.created_at,
            updated_at=loan.updated_at,
            total_paid=total_paid
        ))
    
    return loan_list


@router.get("/loans/{loan_id}", response_model=LoanRead)
async def get_loan(
    loan_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get a specific loan by ID"""
    result = await session.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == user.id)
    )
    loan = result.scalar_one_or_none()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    # Calculate total paid
    repayments_result = await session.execute(
        select(LoanRepayment).where(LoanRepayment.loan_id == loan.id)
    )
    repayments = repayments_result.scalars().all()
    total_paid = sum(float(r.amount) for r in repayments)
    
    return LoanRead(
        id=loan.id,
        currency=loan.currency,
        user_id=loan.user_id,
        borrower_name=loan.borrower_name,
        original_amount=float(loan.original_amount),
        remaining_amount=float(loan.remaining_amount),
        status=loan.status,
        wallet_id=loan.wallet_id,
        due_date=loan.due_date,
        note=loan.note,
        created_at=loan.created_at,
        updated_at=loan.updated_at,
        total_paid=total_paid
    )


@router.put("/loans/{loan_id}", response_model=LoanRead)
async def update_loan(
    loan_id: uuid.UUID,
    loan_data: LoanUpdate,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Update a loan"""
    result = await session.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == user.id)
    )
    loan = result.scalar_one_or_none()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    # Update fields
    if loan_data.borrower_name is not None:
        loan.borrower_name = loan_data.borrower_name
    if loan_data.due_date is not None:
        loan.due_date = loan_data.due_date
    if loan_data.note is not None:
        loan.note = loan_data.note
    
    loan.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(loan)
    
    # Calculate total paid
    repayments_result = await session.execute(
        select(LoanRepayment).where(LoanRepayment.loan_id == loan.id)
    )
    repayments = repayments_result.scalars().all()
    total_paid = sum(float(r.amount) for r in repayments)
    
    return LoanRead(
        id=loan.id,
        currency=loan.currency,
        user_id=loan.user_id,
        borrower_name=loan.borrower_name,
        original_amount=float(loan.original_amount),
        remaining_amount=float(loan.remaining_amount),
        status=loan.status,
        wallet_id=loan.wallet_id,
        due_date=loan.due_date,
        note=loan.note,
        created_at=loan.created_at,
        updated_at=loan.updated_at,
        total_paid=total_paid
    )


@router.delete("/loans/{loan_id}")
async def delete_loan(
    loan_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Delete a loan"""
    await money.lock_owner(session, user.id)
    result = await session.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == user.id)
    )
    loan = result.scalar_one_or_none()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    payments = await session.scalar(select(LoanRepayment.id).where(LoanRepayment.loan_id == loan.id).limit(1))
    if payments:
        raise HTTPException(409, "Records with repayments cannot be deleted. Payment history must be preserved.")
    event = await money.active_source_event(session, user.id, "loan", loan.id)
    if event:
        await money.reverse_event(session, user.id, event.id, internal=True)
    elif loan.wallet_id:
        wallet = await money.get_wallet(session, user.id, loan.wallet_id, archived=True)
        await money.post_event(session, user.id, "reversal", "Loan cancelled", wallet.currency,
            [(wallet.id, money.amount(loan.original_amount) * 1)], source_type="loan", source_id=loan.id, allow_archived=True)
    
    await session.delete(loan)
    await session.commit()
    
    return {"message": "Loan deleted successfully"}


@router.post("/loans/{loan_id}/repay", response_model=LoanRepaymentRead)
async def receive_loan_repayment(
    loan_id: uuid.UUID,
    repayment_data: LoanRepaymentCreate,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Record a repayment received for a loan"""
    await money.lock_owner(session, user.id)
    request = {**repayment_data.model_dump(mode="json"), "loan_id": str(loan_id)}
    previous = await money.retry_event(session, user.id, repayment_data.idempotency_key, request)
    if previous:
        record = await session.get(LoanRepayment, previous.source_id)
        return LoanRepaymentRead.model_validate(record)
    if repayment_data.amount <= 0:
        raise HTTPException(status_code=400, detail="Repayment amount must be greater than 0")
    
    # Get loan
    result = await session.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == user.id)
    )
    loan = result.scalar_one_or_none()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    if loan.remaining_amount <= 0:
        raise HTTPException(status_code=400, detail="This loan is already fully paid")
    
    repayment_amount = Decimal(str(repayment_data.amount))
    
    if repayment_amount > loan.remaining_amount:
        raise HTTPException(status_code=400, detail=f"Repayment amount ({repayment_data.amount}) exceeds remaining loan ({float(loan.remaining_amount)})")
    
    # If wallet_id is provided, verify ownership and increase balance
    wallet = None
    if repayment_data.wallet_id:
        wallet = await money.get_wallet(session, user.id, repayment_data.wallet_id)
        if wallet.currency != loan.currency:
            raise HTTPException(422, "The wallet must match the recorded loan currency")
    
    # Create repayment record
    repayment = LoanRepayment(
        loan_id=loan_id,
        amount=repayment_amount,
        wallet_id=repayment_data.wallet_id,
        note=repayment_data.note
    )
    session.add(repayment)
    await session.flush()
    await money.post_event(session, user.id, "repayment", "Loan repayment", loan.currency or "UNK",
        [(wallet.id, repayment_amount * 1)] if wallet else [], event_amount=repayment_amount,
        source_type="loan_repayment", source_id=repayment.id, key=repayment_data.idempotency_key, request=request)
    
    # Update loan
    loan.remaining_amount -= repayment_amount  # Both are Decimal, so this works
    if loan.remaining_amount <= Decimal('0.00'):  # Consider fully paid if less than 1 cent
        loan.remaining_amount = Decimal('0.0')
        loan.status = DebtLoanStatus.fully_paid
    elif loan.remaining_amount < loan.original_amount:
        loan.status = DebtLoanStatus.partially_paid
    loan.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(repayment)
    
    # Get wallet name if exists
    wallet_name = None
    if repayment.wallet_id:
        wallet_result = await session.get(Wallet, repayment.wallet_id)
        if wallet_result:
            wallet_name = wallet_result.name
    
    return LoanRepaymentRead(
        id=repayment.id,
        loan_id=repayment.loan_id,
        amount=float(repayment.amount),
        wallet_id=repayment.wallet_id,
        wallet_name=wallet_name,
        note=repayment.note,
        created_at=repayment.created_at
    )


@router.get("/loans/{loan_id}/repayments", response_model=List[LoanRepaymentRead])
async def get_loan_repayments(
    loan_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get all repayments for a loan"""
    # Verify loan belongs to user
    result = await session.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == user.id)
    )
    loan = result.scalar_one_or_none()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    # Get repayments
    repayments_result = await session.execute(
        select(LoanRepayment)
        .where(LoanRepayment.loan_id == loan_id)
        .order_by(LoanRepayment.created_at.desc())
    )
    repayments = repayments_result.scalars().all()
    
    repayment_list = []
    for repayment in repayments:
        wallet_name = None
        if repayment.wallet_id:
            wallet_result = await session.get(Wallet, repayment.wallet_id)
            if wallet_result:
                wallet_name = wallet_result.name
        
        repayment_list.append(LoanRepaymentRead(
            id=repayment.id,
            loan_id=repayment.loan_id,
            amount=float(repayment.amount),
            wallet_id=repayment.wallet_id,
            wallet_name=wallet_name,
            note=repayment.note,
            created_at=repayment.created_at
        ))
    
    return repayment_list


# ======================
# SUMMARY
# ======================

@router.get("/summary")
async def get_summary(
    currency: str = "MAD",
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get summary of all debts and loans"""
    # Get all debts
    debts_result = await session.execute(
        select(Debt).where(Debt.user_id == user.id, Debt.currency == currency)
    )
    debts = debts_result.scalars().all()
    
    # Get all loans
    loans_result = await session.execute(
        select(Loan).where(Loan.user_id == user.id, Loan.currency == currency)
    )
    loans = loans_result.scalars().all()
    
    # Calculate totals
    total_debt = sum(float(d.remaining_amount) for d in debts)
    total_loans = sum(float(l.remaining_amount) for l in loans)
    net = total_loans - total_debt
    
    # Count by status
    active_debts = sum(1 for d in debts if d.status == DebtLoanStatus.active)
    active_loans = sum(1 for l in loans if l.status == DebtLoanStatus.active)
    
    return {
        "total_debt": total_debt,
        "total_loans": total_loans,
        "net": net,
        "active_debts_count": active_debts,
        "active_loans_count": active_loans,
        "total_debts_count": len(debts),
        "total_loans_count": len(loans)
    }
