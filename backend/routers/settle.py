from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from backend.db import get_session
from backend.models import Expense, Group, User, Settlement, Split, SettlementStatus, GlobalSettlement
from backend.schemas import BalanceItem, SettlementCreate, SettlementOut, SettlementAction, SettlementStatus as SettlementStatusSchema, GlobalSettlementCreate, GlobalSettlementOut
from backend.auth import get_current_user
from backend.crud import compute_group_balances, ensure_user_in_group, log_activity, compute_global_balances, ensure_friendship, get_accepted_friends, compute_group_balances_with_adjustments
from backend.debt import minimize_cash_flow
from backend.routers.notifications import send_notification
from typing import Optional

router = APIRouter(prefix="/settle", tags=["Settle"])


# -----------------------------
# Helper Functions
# -----------------------------
def round_amount(value):
    return float(Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


# ============================================================
# GLOBAL SETTLEMENT ENDPOINTS (Must come BEFORE group routes)
# ============================================================

# -----------------------------
# Global balances (across all groups with friends)
# -----------------------------
@router.get("/global/balances", response_model=list[BalanceItem])
async def global_balances(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    Get global balances between current user and all their friends
    across all groups.
    """
    balances = await compute_global_balances(session, current.id)
    
    # Fetch friend usernames
    friend_ids = list(balances.keys())
    if not friend_ids:
        return []
    
    result = await session.execute(
        select(User.id, User.username).where(User.id.in_(friend_ids))
    )
    users = dict(result.all())
    
    return [
        BalanceItem(
            user_id=friend_id,
            username=users.get(friend_id, f"User {friend_id}"),
            net=balance
        )
        for friend_id, balance in balances.items()
    ]


# -----------------------------
# Suggested global settlements
# -----------------------------
@router.get("/global/settlements", response_model=list[GlobalSettlementOut])
async def global_settlements(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    Get suggested global settlements between current user and friends.
    """
    balances = await compute_global_balances(session, current.id)
    
    # Debug logging
    print(f"🔍 Global balances for user {current.id}: {balances}")
    
    if not balances:
        print("⚠️ No global balances found")
        return []
    
    # Round balances
    def round_balance(val):
        return float(Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    
    balances = {uid: round_balance(bal) for uid, bal in balances.items()}
    
    # The balances from compute_global_balances are from current user's perspective:
    # - Positive = friend owes you (friend is a debtor, you are a creditor)
    # - Negative = you owe friend (you are a debtor, friend is a creditor)
    # 
    # For minimize_cash_flow, we need balances where:
    # - Positive = they are owed money (creditor)
    # - Negative = they owe money (debtor)
    #
    # So we need to invert the friend balances and calculate current user's balance
    
    # Convert friend balances: invert the sign
    # Friend with +10,000 (owes you) becomes -10,000 (they owe, so negative)
    # Friend with -5,000 (you owe them) becomes +5,000 (they are owed, so positive)
    inverted_balances = {uid: -bal for uid, bal in balances.items()}
    
    # Current user's balance is the negative sum of inverted balances
    # (ensures sum of all balances is zero)
    current_user_balance = -sum(inverted_balances.values())
    current_user_balance = round_balance(current_user_balance)
    
    # Combine all balances for minimize_cash_flow
    all_balances = {current.id: current_user_balance, **inverted_balances}
    
    print(f"🔍 Rounded balances (friends): {balances}")
    print(f"🔍 Current user balance: {current_user_balance}")
    print(f"🔍 All balances (including current user): {all_balances}")
    
    # Filter out zero balances before passing to minimize_cash_flow
    non_zero_balances = {uid: bal for uid, bal in all_balances.items() if abs(bal) >= 0.01}
    
    print(f"🔍 Non-zero balances: {non_zero_balances}")
    
    if not non_zero_balances:
        print("⚠️ All balances are zero after filtering")
        return []
    
    raw_settlements = minimize_cash_flow(non_zero_balances)
    
    print(f"🔍 Raw settlements: {raw_settlements}")
    
    if not raw_settlements:
        return []
    
    # Filter to only show settlements involving the current user
    # (since this is the global settlements page from current user's perspective)
    user_settlements = [
        s for s in raw_settlements 
        if s["from_user"] == current.id or s["to_user"] == current.id
    ]
    
    print(f"🔍 Settlements involving current user: {user_settlements}")
    
    if not user_settlements:
        return []
    
    user_ids = {s["from_user"] for s in user_settlements} | {s["to_user"] for s in user_settlements}
    result = await session.execute(select(User.id, User.username).where(User.id.in_(user_ids)))
    users = dict(result.all())
    
    return [
        GlobalSettlementOut(
            from_user_id=s["from_user"],
            from_username=users.get(s["from_user"], f"User {s['from_user']}"),
            to_user_id=s["to_user"],
            to_username=users.get(s["to_user"], f"User {s['to_user']}"),
            amount=s["amount"],
            status=SettlementStatusSchema.pending,
            created_at=datetime.utcnow()
        )
        for s in user_settlements
    ]


# -----------------------------
# Record global settlement
# -----------------------------
@router.post("/global/record", response_model=GlobalSettlementOut, status_code=status.HTTP_201_CREATED)
async def record_global_settlement(
    payload: GlobalSettlementCreate,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    Record a global settlement (applies across all groups between friends).
    """
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if payload.to_user_id == current.id:
        raise HTTPException(status_code=400, detail="You cannot settle with yourself")
    
    # Verify friendship
    await ensure_friendship(session, current.id, payload.to_user_id)
    
    # Fetch usernames
    result = await session.execute(
        select(User.id, User.username).where(User.id.in_([current.id, payload.to_user_id]))
    )
    users = dict(result.all())
    
    from_username = users.get(current.id, "Unknown")
    to_username = users.get(payload.to_user_id, "Unknown")
    
    amount = round_amount(payload.amount)
    
    # Create global settlement with PENDING status
    settlement = GlobalSettlement(
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
    
    # Send notification to User B
    notification_msg = (
        f"{from_username} recorded a global settlement of {amount}. "
        f"Please review and confirm."
    )
    await send_notification(session, payload.to_user_id, notification_msg)
    
    # Log activity
    await log_activity(
        session,
        user_id=current.id,
        action=f"requested global settlement with {to_username} for {amount}",
        target_type="global_settlement",
        target_id=settlement.id
    )
    
    return GlobalSettlementOut(
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
# Global settlement history
# -----------------------------
@router.get("/global/history", response_model=list[GlobalSettlementOut])
async def global_settlement_history(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """
    Get global settlement history for current user.
    """
    try:
        result = await session.execute(
            select(GlobalSettlement)
            .where(
                (GlobalSettlement.from_user_id == current.id) |
                (GlobalSettlement.to_user_id == current.id)
            )
            .order_by(GlobalSettlement.created_at.desc())
        )
        
        settlements = result.scalars().all()
        
        user_ids = {s.from_user_id for s in settlements} | {s.to_user_id for s in settlements}
        if not user_ids:
            return []
        
        res_users = await session.execute(
            select(User.id, User.username).where(User.id.in_(user_ids))
        )
        users = dict(res_users.all())
        
        settlement_outs = []
        for s in settlements:
            # Handle status safely
            status_val = s.status.value if hasattr(s.status, 'value') else str(s.status)
            if status_val.lower() in ["pending", "accepted", "rejected"]:
                status_val = status_val.lower()

            settlement_outs.append(GlobalSettlementOut(
                id=s.id,
                from_user_id=s.from_user_id,
                from_username=users.get(s.from_user_id, "Unknown"),
                to_user_id=s.to_user_id,
                to_username=users.get(s.to_user_id, "Unknown"),
                amount=s.amount,
                status=SettlementStatusSchema(status_val),
                message=s.message,
                proof_photo=s.proof_photo,
                rejected_reason=s.rejected_reason,
                created_at=s.created_at,
                updated_at=s.updated_at
            ))
            
        return settlement_outs
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"❌ Error in global_settlement_history: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


# -----------------------------
# Accept global settlement
# -----------------------------
@router.post("/global/{settlement_id}/accept", response_model=GlobalSettlementOut)
async def accept_global_settlement(
    settlement_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """User B accepts a pending global settlement from User A."""
    settlement = await session.get(GlobalSettlement, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Global settlement not found")
    
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
        session,
        settlement.from_user_id,
        f"{current.username} accepted your global settlement of {settlement.amount}"
    )
    
    await log_activity(
        session,
        user_id=current.id,
        action=f"accepted global settlement from {from_user.username if from_user else 'Unknown'}",
        target_type="global_settlement",
        target_id=settlement.id
    )
    
    from_user = await session.get(User, settlement.from_user_id)
    to_user = await session.get(User, settlement.to_user_id)
    
    return GlobalSettlementOut(
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
# Reject global settlement
# -----------------------------
@router.post("/global/{settlement_id}/reject", response_model=GlobalSettlementOut)
async def reject_global_settlement(
    settlement_id: int,
    payload: SettlementAction,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """User B rejects a pending global settlement from User A."""
    settlement = await session.get(GlobalSettlement, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Global settlement not found")
    
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
        session,
        settlement.from_user_id,
        f"{current.username} rejected your global settlement of {settlement.amount}.{reason_text}"
    )
    
    await log_activity(
        session,
        user_id=current.id,
        action=f"rejected global settlement from {from_user.username if from_user else 'Unknown'}",
        target_type="global_settlement",
        target_id=settlement.id
    )
    
    from_user = await session.get(User, settlement.from_user_id)
    to_user = await session.get(User, settlement.to_user_id)
    
    return GlobalSettlementOut(
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
# Resend global settlement
# -----------------------------
@router.post("/global/{settlement_id}/resend", response_model=GlobalSettlementOut)
async def resend_global_settlement(
    settlement_id: int,
    payload: GlobalSettlementCreate,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """User A resends/reopens a rejected global settlement."""
    original = await session.get(GlobalSettlement, settlement_id)
    if not original:
        raise HTTPException(status_code=404, detail="Global settlement not found")
    
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
        session,
        original.to_user_id,
        f"{current.username} resent the global settlement request for {original.amount}"
    )
    
    await log_activity(
        session,
        user_id=current.id,
        action=f"resent global settlement to {to_user.username if to_user else 'Unknown'}",
        target_type="global_settlement",
        target_id=original.id
    )
    
    from_user = await session.get(User, original.from_user_id)
    to_user = await session.get(User, original.to_user_id)
    
    return GlobalSettlementOut(
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
# Get pending global settlements
# -----------------------------
@router.get("/global/pending", response_model=list[GlobalSettlementOut])
async def get_pending_global_settlements(
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    """Get all pending global settlements where current user is the recipient."""
    result = await session.execute(
        select(GlobalSettlement)
        .where(
            (GlobalSettlement.to_user_id == current.id) &
            (GlobalSettlement.status == SettlementStatus.pending)
        )
        .order_by(GlobalSettlement.created_at.desc())
    )
    
    settlements = result.scalars().all()
    
    user_ids = {s.from_user_id for s in settlements}
    if not user_ids:
        return []
    
    res_users = await session.execute(
        select(User.id, User.username).where(User.id.in_(user_ids))
    )
    users = dict(res_users.all())
    
    return [
        GlobalSettlementOut(
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


# ============================================================
# GROUP SETTLEMENT ENDPOINTS (Must come AFTER global routes)
# ============================================================

# -----------------------------
# Group balances
# -----------------------------
@router.get("/{group_id}/balances", response_model=list[BalanceItem])
async def group_balances(
    group_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    try:
        await ensure_user_in_group(session, current.id, group_id)
        
        # Get user's global settlement mode preference
        # Reload user from database to ensure we have the latest mode
        try:
            # Reload the user to get the latest global_settlement_mode
            await session.refresh(current)
            mode = current.global_settlement_mode.value if current.global_settlement_mode else "separate"
        except Exception as e:
            print(f"⚠️ Warning: Could not refresh user, using current value: {e}")
            # Fallback to current value if refresh fails
            mode = current.global_settlement_mode.value if current.global_settlement_mode else "separate"
        
        print(f"🔍 Group {group_id} balances - User {current.id}, Mode: {mode}")
        
        # Get balances with adjustments
        original_balances, adjusted_balances, adjustments = await compute_group_balances_with_adjustments(
            session, group_id, current.id, mode
        )
        
        print(f"🔍 Original balances: {original_balances}")
        print(f"🔍 Adjusted balances: {adjusted_balances}")
        print(f"🔍 Adjustments: {adjustments}")
        
        # Determine which balances to return based on mode
        if mode == "hybrid":
            # Return adjusted balances with original and adjustment info
            balances_to_show = adjusted_balances
        elif mode == "auto_adjust":
            # Return only adjusted balances
            balances_to_show = adjusted_balances
        else:  # separate
            # Return original balances (no global adjustment)
            balances_to_show = original_balances

        # Fetch usernames
        result = await session.execute(
                select(User.id, User.username).where(User.id.in_(balances_to_show.keys()))
        )
        users = dict(result.all())

        return [
                BalanceItem(
                    user_id=uid,
                    username=users.get(uid, f"User {uid}"),
                    net=balances_to_show[uid],
                    original_net=original_balances.get(uid) if mode == "hybrid" else None,
                    global_adjustment=adjustments.get(uid) if mode == "hybrid" else None
                )
                for uid in balances_to_show.keys()
            ]
    except Exception as e:
        print(f"❌ Error in group_balances endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error calculating balances: {str(e)}")
 

# -----------------------------
# Suggested settlements
# -----------------------------
@router.get("/{group_id}/settlements", response_model=list[SettlementOut])
async def suggested_settlements(
    group_id: int,
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    try:
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
                group_id=group_id,  # ✅ Added group_id
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
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"❌ Error in suggested_settlements: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


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
    try:
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
        settlement_outs = []
        for s in settlements:
            # Handle status safely (it might be an Enum or a string)
            status_val = s.status.value if hasattr(s.status, 'value') else str(s.status)
            # Ensure status_val matches schema (lowercase)
            if status_val.lower() in ["pending", "accepted", "rejected"]:
                status_val = status_val.lower()
            
            settlement_outs.append(SettlementOut(
                id=s.id,
                group_id=s.group_id,  # ✅ Added group_id from settlement object
                from_user_id=s.from_user_id,
                from_username=users.get(s.from_user_id, "Unknown"),
                to_user_id=s.to_user_id,
                to_username=users.get(s.to_user_id, "Unknown"),
                amount=s.amount,
                status=SettlementStatusSchema(status_val),
                message=s.message,
                proof_photo=s.proof_photo,
                rejected_reason=s.rejected_reason,
                created_at=s.created_at,
                updated_at=s.updated_at
            ))
            
        return settlement_outs
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"❌ Error in settlement_history: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

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
    await send_notification(session, payload.to_user_id, notification_msg)

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
        group_id=group_id,  # ✅ Added group_id
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
        session,
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
        group_id=settlement.group_id,  # ✅ Added group_id
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
        session,
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
        group_id=settlement.group_id,  # ✅ Added group_id
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
        session,
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
        group_id=original.group_id,  # ✅ Added group_id
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
