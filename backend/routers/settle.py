from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from backend.db import get_session
from backend.models import Expense, Group, User, Settlement, Split, SettlementStatus
from backend.schemas import BalanceItem, SettlementCreate, SettlementOut, SettlementAction, SettlementStatus as SettlementStatusSchema
from backend.auth import get_current_user
from backend.crud import compute_group_balances, ensure_user_in_group, log_activity
from backend.debt import minimize_cash_flow
from backend.routers.notifications import send_notification
from typing import Optional

router = APIRouter(prefix="/settle", tags=["Settle"])


# -----------------------------
# Group balances
# -----------------------------
@router.get("/{group_id}/balances", response_model=list[BalanceItem])
async def group_balances(
    group_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    await ensure_user_in_group(session, current.id, group_id)
    balances = await compute_group_balances(session, group_id)

    # Fetch usernames
    result = await session.execute(
        select(User.id, User.username).where(User.id.in_(balances.keys()))
    )
    users = dict(result.all())

    return [
        BalanceItem(user_id=uid, username=users.get(uid, f"User {uid}"), net=net)
        for uid, net in balances.items()
    ]
 

# -----------------------------
# Suggested settlements
# -----------------------------
@router.get("/{group_id}/settlements", response_model=list[SettlementOut])
async def suggested_settlements(
    group_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    await ensure_user_in_group(session, current.id, group_id)
    balances = await compute_group_balances(session, group_id)
    
    # Round balances to ensure consistency (balances are already rounded in compute_group_balances,
    # but we round again here to ensure exact match with displayed values)
    from decimal import Decimal, ROUND_HALF_UP
    def round_balance(val):
        return float(Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    
    balances = {uid: round_balance(bal) for uid, bal in balances.items()}
    
    raw_settlements = minimize_cash_flow(balances)

    if not raw_settlements:
        return []

    user_ids = {s["from_user"] for s in raw_settlements} | {s["to_user"] for s in raw_settlements}
    result = await session.execute(select(User.id, User.username).where(User.id.in_(user_ids)))
    users = dict(result.all())

    return [
        SettlementOut(
            from_user_id=s["from_user"],
            from_username=users.get(s["from_user"], f"User {s['from_user']}"),
            to_user_id=s["to_user"],
            to_username=users.get(s["to_user"], f"User {s['to_user']}"),
            amount=s["amount"],
            status=SettlementStatusSchema.pending,
            created_at=datetime.utcnow()
        )
        for s in raw_settlements
    ]


# -----------------------------
# Settlement history (per group)
# -----------------------------
@router.get("/{group_id}/history", response_model=list[SettlementOut])
async def settlement_history(
    group_id: int,
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    # ✅ Ensure user belongs to the group
    await ensure_user_in_group(session, current.id, group_id)

    # ✅ Fetch settlements only for the current group
    # ✅ Include ALL statuses (accepted, pending, rejected) for history page
    query = select(Settlement).where(
        (Settlement.group_id == group_id) & (
                (Settlement.from_user_id == current.id) |
                (Settlement.to_user_id == current.id)
            )
        )
    
    # Filter by status if provided
    if status:
        try:
            status_enum = SettlementStatus[status]
            query = query.where(Settlement.status == status_enum)
        except KeyError:
            pass  # Invalid status, ignore filter
    
    query = query.order_by(Settlement.created_at.desc())
    
    result = await session.execute(query)
    settlements = result.scalars().all()

    # ✅ Fetch usernames for all involved users
    user_ids = {s.from_user_id for s in settlements} | {s.to_user_id for s in settlements}
    if not user_ids:
        return []  # No settlements found for this group

    res_users = await session.execute(
        select(User.id, User.username).where(User.id.in_(user_ids))
    )
    users = dict(res_users.all())

    # ✅ Format output with status
    return [
        SettlementOut(
            id=s.id,
            from_user_id=s.from_user_id,
            from_username=users.get(s.from_user_id, "Unknown"),
            to_user_id=s.to_user_id,
            to_username=users.get(s.to_user_id, "Unknown"),
            amount=s.amount,
            status=SettlementStatusSchema(s.status.value),
            message=s.message,
            proof_photo=s.proof_photo,
            rejected_reason=s.rejected_reason,
            created_at=s.created_at,
            updated_at=s.updated_at
        )
        for s in settlements
    ]

from decimal import Decimal, ROUND_HALF_UP
 
def round_amount(value):
    return float(Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

# -----------------------------
# Record a settlement
# -----------------------------
@router.post("/{group_id}/record", response_model=SettlementOut, status_code=status.HTTP_201_CREATED)
async def record_settlement(
    group_id: int,
    payload: SettlementCreate,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
   
    await ensure_user_in_group(session, current.id, group_id)
    await ensure_user_in_group(session, payload.to_user_id, group_id)

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if payload.to_user_id == current.id:
        raise HTTPException(status_code=400, detail="You cannot settle with yourself")

     # ✅ Fetch the group currency automatically
    result = await session.execute(select(Group.currency).where(Group.id == group_id))
    group_currency = result.scalar_one_or_none() or None # default if group not found or no currency set

    # Fetch usernames
    result = await session.execute(
        select(User.id, User.username).where(User.id.in_([current.id, payload.to_user_id]))
    )
    users = dict(result.all())

    from_username = users.get(current.id, "Unknown")
    to_username = users.get(payload.to_user_id, "Unknown")

    amount = round_amount(payload.amount)
    # -------------------------------
    # 1️⃣ Create settlement record with PENDING status
    # -------------------------------
    settlement = Settlement(
        group_id=group_id,
        from_user_id=current.id,
        to_user_id=payload.to_user_id,
        amount=float(amount),
        status=SettlementStatus.pending,
        message=payload.message,
        created_at=datetime.utcnow()
    )

    session.add(settlement)
    await session.commit()
    await session.refresh(settlement)

    # ✅ Send notification to User B
    notification_msg = (
        f"{from_username} recorded a settlement of {amount} {group_currency or 'MAD'}. "
        f"Please review and confirm."
    )
    await send_notification(payload.to_user_id, notification_msg)

    # ✅ Log activity
    await log_activity(
        session,
        user_id=current.id,
        action=f"requested settlement with {to_username} for {amount} {group_currency or 'MAD'}",
        target_type="settlement",
        target_id=settlement.id
    )

    return SettlementOut(
        id=settlement.id,
        from_user_id=current.id,
        from_username=from_username, 
        to_user_id=payload.to_user_id,  
        to_username=to_username,
        amount=payload.amount,
        status=SettlementStatusSchema.pending,
        message=settlement.message,
        created_at=settlement.created_at,
        updated_at=settlement.updated_at
    )


# -----------------------------
# Accept a settlement
# -----------------------------
@router.post("/{settlement_id}/accept", response_model=SettlementOut)
async def accept_settlement(
    settlement_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    User B accepts a pending settlement from User A.
    """
    settlement = await session.get(Settlement, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    
    if settlement.to_user_id != current.id:
        raise HTTPException(
            status_code=403,
            detail="Only the recipient can accept this settlement"
        )
    
    if settlement.status != SettlementStatus.pending:
        raise HTTPException(
            status_code=400,
            detail=f"Settlement is already {settlement.status.value}"
        )
    
    settlement.status = SettlementStatus.accepted
    settlement.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(settlement)
    
    # Send notification to User A
    from_user = await session.get(User, settlement.from_user_id)
    await send_notification(
        settlement.from_user_id,
        f"{current.username} accepted your settlement of {settlement.amount}"
    )
    
    await log_activity(
        session,
        user_id=current.id,
        action=f"accepted settlement from {from_user.username if from_user else 'Unknown'}",
        target_type="settlement",
        target_id=settlement.id
    )
    
    from_user = await session.get(User, settlement.from_user_id)
    to_user = await session.get(User, settlement.to_user_id)
    
    return SettlementOut(
        id=settlement.id,
        from_user_id=settlement.from_user_id,
        from_username=from_user.username if from_user else "Unknown",
        to_user_id=settlement.to_user_id,
        to_username=to_user.username if to_user else "Unknown",
        amount=settlement.amount,
        status=SettlementStatusSchema(settlement.status.value),
        message=settlement.message,
        proof_photo=settlement.proof_photo,
        created_at=settlement.created_at,
        updated_at=settlement.updated_at
    )


# -----------------------------
# Reject a settlement
# -----------------------------
@router.post("/{settlement_id}/reject", response_model=SettlementOut)
async def reject_settlement(
    settlement_id: int,
    payload: SettlementAction,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    User B rejects a pending settlement from User A.
    """
    settlement = await session.get(Settlement, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    
    if settlement.to_user_id != current.id:
        raise HTTPException(
            status_code=403,
            detail="Only the recipient can reject this settlement"
        )
    
    if settlement.status != SettlementStatus.pending:
        raise HTTPException(
            status_code=400,
            detail=f"Settlement is already {settlement.status.value}"
        )
    
    settlement.status = SettlementStatus.rejected
    settlement.rejected_reason = payload.reason
    settlement.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(settlement)
    
    # Send notification to User A
    from_user = await session.get(User, settlement.from_user_id)
    reason_text = f" Reason: {payload.reason}" if payload.reason else ""
    await send_notification(
        settlement.from_user_id,
        f"{current.username} rejected your settlement of {settlement.amount}.{reason_text}"
    )
    
    await log_activity(
        session,
        user_id=current.id,
        action=f"rejected settlement from {from_user.username if from_user else 'Unknown'}",
        target_type="settlement",
        target_id=settlement.id
    )
    
    from_user = await session.get(User, settlement.from_user_id)
    to_user = await session.get(User, settlement.to_user_id)
    
    return SettlementOut(
        id=settlement.id,
        from_user_id=settlement.from_user_id,
        from_username=from_user.username if from_user else "Unknown",
        to_user_id=settlement.to_user_id,
        to_username=to_user.username if to_user else "Unknown",
        amount=settlement.amount,
        status=SettlementStatusSchema(settlement.status.value),
        message=settlement.message,
        rejected_reason=settlement.rejected_reason,
        created_at=settlement.created_at,
        updated_at=settlement.updated_at
    )


# -----------------------------
# Resend/Reopen a rejected settlement
# -----------------------------
@router.post("/{settlement_id}/resend", response_model=SettlementOut)
async def resend_settlement(
    settlement_id: int,
    payload: SettlementCreate,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    User A resends/reopens a rejected settlement.
    """
    original = await session.get(Settlement, settlement_id)
    if not original:
        raise HTTPException(status_code=404, detail="Settlement not found")
    
    if original.from_user_id != current.id:
        raise HTTPException(
            status_code=403,
            detail="Only the sender can resend this settlement"
        )
    
    if original.status != SettlementStatus.rejected:
        raise HTTPException(
            status_code=400,
            detail="Can only resend rejected settlements"
        )
    
    # Update existing settlement
    original.status = SettlementStatus.pending
    original.amount = float(round_amount(payload.amount))
    original.message = payload.message
    original.rejected_reason = None
    original.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(original)
    
    # Send notification to User B
    to_user = await session.get(User, original.to_user_id)
    await send_notification(
        original.to_user_id,
        f"{current.username} resent the settlement request for {original.amount}"
    )
    
    await log_activity(
        session,
        user_id=current.id,
        action=f"resent settlement to {to_user.username if to_user else 'Unknown'}",
        target_type="settlement",
        target_id=original.id
    )
    
    from_user = await session.get(User, original.from_user_id)
    to_user = await session.get(User, original.to_user_id)
    
    return SettlementOut(
        id=original.id,
        from_user_id=original.from_user_id,
        from_username=from_user.username if from_user else "Unknown",
        to_user_id=original.to_user_id,
        to_username=to_user.username if to_user else "Unknown",
        amount=original.amount,
        status=SettlementStatusSchema(original.status.value),
        message=original.message,
        created_at=original.created_at,
        updated_at=original.updated_at
    )


# -----------------------------
# Get pending settlements
# -----------------------------
@router.get("/pending", response_model=list[SettlementOut])
async def get_pending_settlements(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    Get all pending settlements where current user is the recipient (needs to accept/reject).
    """
    result = await session.execute(
        select(Settlement)
        .where(
            (Settlement.to_user_id == current.id) &
            (Settlement.status == SettlementStatus.pending)
        )
        .order_by(Settlement.created_at.desc())
    )
    
    settlements = result.scalars().all()
    
    user_ids = {s.from_user_id for s in settlements}
    if not user_ids:
        return []
    
    res_users = await session.execute(
        select(User.id, User.username).where(User.id.in_(user_ids))
    )
    users = dict(res_users.all())
    
    res_groups = await session.execute(
        select(Group.id, Group.title).where(
            Group.id.in_({s.group_id for s in settlements})
        )
    )
    groups = dict(res_groups.all())
    
    return [
        SettlementOut(
            id=s.id,
            from_user_id=s.from_user_id,
            from_username=users.get(s.from_user_id, "Unknown"),
            to_user_id=s.to_user_id,
            to_username=current.username,
            amount=s.amount,
            status=SettlementStatusSchema(s.status.value),
            message=s.message,
            created_at=s.created_at,
            updated_at=s.updated_at
        )
        for s in settlements
    ]
