from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from backend.db import get_session
from backend.models import Expense, Group, User, Settlement, Split
from backend.schemas import BalanceItem, SettlementCreate, SettlementOut
from backend.auth import get_current_user
from backend.crud import compute_group_balances, ensure_user_in_group, log_activity
from backend.debt import minimize_cash_flow

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
    session: AsyncSession = Depends(get_session),
    current: User = Depends(get_current_user)
):
    # ✅ Ensure user belongs to the group
    await ensure_user_in_group(session, current.id, group_id)

    # ✅ Fetch settlements only for the current group
    result = await session.execute(
        select(Settlement)
        .where(
            (Settlement.group_id == group_id) & (   # <--- FILTER BY GROUP
                (Settlement.from_user_id == current.id) |
                (Settlement.to_user_id == current.id)
            )
        )
        .order_by(Settlement.created_at.desc())
    )

    settlements = result.scalars().all()

    # ✅ Fetch usernames for all involved users
    user_ids = {s.from_user_id for s in settlements} | {s.to_user_id for s in settlements}
    if not user_ids:
        return []  # No settlements found for this group

    res_users = await session.execute(
        select(User.id, User.username).where(User.id.in_(user_ids))
    )
    users = dict(res_users.all())

    # ✅ Format output
    return [
        SettlementOut(
            id=s.id,
            from_user_id=s.from_user_id,
            from_username=users.get(s.from_user_id, "Unknown"),
            to_user_id=s.to_user_id,
            to_username=users.get(s.to_user_id, "Unknown"),
            amount=s.amount,
            created_at=s.created_at
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
    # 1️⃣ Create settlement record
    # -------------------------------
    settlement = Settlement(
        group_id=group_id,
        from_user_id=current.id,
        to_user_id=payload.to_user_id,
        amount=float(amount),
        created_at=datetime.utcnow()
    )

        # ✅ Add and commit before refresh
    session.add(settlement)
    await session.commit()
    await session.refresh(settlement)




    # Commit everything
    await session.commit()
    await session.refresh(settlement)
    await log_activity(session, user_id=current.id, action=f"settled up with {payload.to_user_id}", target_type="settlement", target_id=settlement.id)

    return SettlementOut(
        id=settlement.id,
        from_user_id=current.id,
        from_username=from_username, 
        to_user_id=payload.to_user_id,  
        to_username=to_username,
        amount=payload.amount,
        created_at=settlement.created_at
    )
