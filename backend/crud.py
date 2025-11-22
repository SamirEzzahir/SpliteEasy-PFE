# backend/app/crud.py
from datetime import datetime
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select, func
from sqlalchemy.orm import selectinload

from .models import Income, IncomeType, Settlement, User, Group, Membership, Expense, Split, ActivityLog, Wallet, Friend, FriendStatus, GlobalSettlement
from .utils import hash_password
from .schemas import ExpenseUpdate, IncomeCreate, IncomeRead, IncomeUpdate, SplitRead, UserCreate, UserRead, GroupCreate, GroupRead, MembershipRead, ExpenseCreate, ExpenseRead
from decimal import Decimal, ROUND_HALF_UP

# ------------------------
# Users
# ------------------------
async def create_user(session: AsyncSession, user_data: UserCreate) -> UserRead:
    user = User(
        email=user_data.email,
        username=user_data.username,
        password_hash=hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        gender=user_data.gender,
        phone=user_data.phone,
        profile_photo=user_data.profile_photo,
        is_active=user_data.is_active,
        is_admin=user_data.is_admin
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user, from_attributes=True)



async def get_user_by_id(session: AsyncSession, user_id: int) -> UserRead:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserRead.model_validate(user)


async def get_users(session: AsyncSession) -> list[UserRead]:
    result = await session.execute(select(User))
    users = result.scalars().all()
    return [UserRead.model_validate(u, from_attributes=True) for u in users]



async def update_user(session: AsyncSession, user_id: int, data: dict) -> UserRead:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    for key, value in data.items():
        if hasattr(user, key) and value is not None:
            setattr(user, key, value)

    await session.commit()
    await session.refresh(user)

    # Return a single validated Pydantic model, not a list
    return UserRead.model_validate(user, from_attributes=True)

"""
async def delete_user(session: AsyncSession, user_id: int):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await session.delete(user)
    await session.commit()
"""
async def delete_user(session: AsyncSession, user_id: int):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = False
    await session.commit()
    



async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    return (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()

async def get_user_by_username(session: AsyncSession, username: str) -> User | None:
    return (await session.execute(select(User).where(User.username == username))).scalar_one_or_none()
 


# ------------------------
# Groups
# ------------------------
async def create_group(
    session: AsyncSession,
    payload: GroupCreate,
    current_user: User
) -> GroupRead:
    # 1️⃣ Create the group
    group = Group(
        title=payload.title,    
        currency=payload.currency,
        type=payload.type,
        photo=payload.photo,
        owner_id=current_user.id  # set owner automatically
    )
    session.add(group)
    await session.flush()  # ensures group.id is available

    # 2️⃣ Validate member IDs exist in DB
    members = set(payload.member_ids) | {current_user.id}  # include owner
    existing_users = await session.execute(select(User.id).where(User.id.in_(members)))
    existing_user_ids = {u[0] for u in existing_users.fetchall()}

    # Optional: raise error if some IDs are invalid
    invalid_ids = members - existing_user_ids
    if invalid_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user IDs: {invalid_ids}"
        )

    # 3️⃣ Add memberships
    for uid in existing_user_ids:
        session.add(Membership(
            user_id=uid,
            group_id=group.id,
            is_admin=(uid == current_user.id)
        ))

    # 4️⃣ Commit and refresh
    await session.commit()
    await log_activity(session, user_id=current_user.id, action=f"created group '{group.title}'", target_type="group", target_id=group.id)
    await session.refresh(group)
    return GroupRead.model_validate(group)


async def get_group(session: AsyncSession, group_id: int) -> GroupRead:
    group = await session.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return GroupRead.model_validate(group)

# Get all groups
async def get_groups(session: AsyncSession, currentuser: User) -> list[GroupRead]:
    from .models import Expense, Settlement, SettlementStatus
    from sqlalchemy import func
    
    # Fetch all groups where currentuser is a member
    result = await session.execute(
        select(Group)
        .join(Membership, Membership.group_id == Group.id)
        .where(Membership.user_id == currentuser.id)
        .options(
            selectinload(Group.memberships).selectinload(Membership.user),  # preload members
            selectinload(Group.owner)  # preload owner
        )
    )

    groups = result.scalars().all()

    output = []
    for group in groups:
        members_usernames = [m.user.username for m in group.memberships]
        owner_username = group.owner.username if group.owner else None
        
        # Count expenses in this group
        expense_count_result = await session.execute(
            select(func.count(Expense.id))
            .where(Expense.group_id == group.id)
        )
        expenses_count = expense_count_result.scalar() or 0
        
        # Check if group has unsettled balances
        # A group is unsettled if it has expenses and non-zero balances
        has_unsettled = False
        if expenses_count > 0:
            # Calculate balances for this group to check if any are non-zero
            # This is the most accurate way to determine if a group is settled
            try:
                balances = await compute_group_balances(session, group.id)
                # Check if any balance is non-zero (absolute value >= 0.01)
                has_unsettled = any(abs(balance) >= 0.01 for balance in balances.values())
            except Exception as e:
                # If balance calculation fails, assume unsettled if there are expenses
                print(f"⚠️ Warning: Could not calculate balances for group {group.id}: {e}")
                has_unsettled = True  # Conservative: if we can't calculate, assume unsettled
        
        output.append(
            GroupRead.model_validate({
                **group.__dict__,
                "owner_username": owner_username,
                "members_usernames": members_usernames,
                "expenses_count": expenses_count,
                "has_unsettled_balance": has_unsettled
            })
        )
    return output

async def get_groups_for_user(session: AsyncSession, user_id: int) -> list[GroupRead]:
    result = await session.execute(
        select(Group)
        .join(Membership, Membership.group_id == Group.id)
        .where(Membership.user_id == user_id)
    )
    groups = result.scalars().all()
    return [GroupRead.model_validate(g) for g in groups]


async def update_group(session, group_id: int, data: dict) -> GroupRead:
    group = await session.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    for key, value in data.items():
        if hasattr(group, key) and value is not None:
            setattr(group, key, value)

    await session.commit()
    await session.refresh(group)
    return GroupRead.model_validate(group)


async def delete_group(session: AsyncSession, group_id: int, current: int):
    group = await session.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.owner_id != current.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    
    await session.delete(group)
    await session.commit()


# ✅ Check if user can leave the group
async def can_leave_group(session: AsyncSession, user_id: int, group_id: int) -> bool:
    result = await session.execute(
        select(Settlement)
        .where(
            ((Settlement.from_user_id == user_id) | (Settlement.to_user_id == user_id)) &
            (Settlement.amount != 0) &
            (Settlement.group_id == group_id)
        )
    )
    unsettled = result.scalars().all()
    return len(unsettled) == 0



# ✅ Leave group
async def leave_group(session: AsyncSession, user_id: int, group_id: int):
    can_leave = await can_leave_group(session, user_id, group_id)
    if not can_leave:
        raise HTTPException(status_code=400, detail="Cannot leave group with unsettled balances")

    # Remove membership
    await session.execute(
        delete(Membership).where(
            Membership.user_id == user_id,
            Membership.group_id == group_id
        )
    )
    await session.commit()
    return True

# ------------------------
# Expennse
# ------------------------

def round_amount(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

async def update_wallet_balance(session: AsyncSession, wallet_id: int, amount_change: Decimal, user_id: int):
    """Update wallet balance and verify ownership"""
    wallet = await session.get(Wallet, wallet_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    if wallet.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this wallet")
    
    new_balance = wallet.balance + amount_change
    if new_balance < 0:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
    
    wallet.balance = new_balance
    await session.commit()
    return wallet

async def add_expense(session, expense_data: ExpenseCreate, splits: list[tuple[int, float]], current_user_id: int) -> ExpenseRead:
    total_amount = round_amount(expense_data.amount)
    
    # Get group currency
    group = await session.get(Group, expense_data.group_id)
    group_currency = group.currency if group else "USD"

    exp = Expense(
        group_id=expense_data.group_id,
        payer_id=expense_data.payer_id or None,
        added_by=expense_data.added_by or current_user_id,
        description=expense_data.description,
        amount=float(total_amount),  # keep float for DB column (Numeric)
        currency=group_currency,  # Use group's currency instead of expense_data.currency
        category=expense_data.category,
        wallet_id=expense_data.wallet_id,
        split_type=expense_data.split_type,
        note=expense_data.note,
        photo=expense_data.photo,
        created_at=expense_data.created_at,
        updated_at=expense_data.created_at,
    )
    session.add(exp)
    await session.flush()

    total = Decimal("0.00")
    split_objs = []
    for uid, share in splits:
        rounded_share = round_amount(share)
        total += rounded_share
        split_obj = Split(
            expense_id=exp.id,
            user_id=uid,
            share_amount=float(rounded_share)
        )
        session.add(split_obj)
        split_objs.append(split_obj)

    # Adjust rounding diff
    diff = total_amount - total
    if diff != Decimal("0.00") and split_objs:
        first = split_objs[0]
        first.share_amount = float(round_amount(Decimal(first.share_amount) + diff))
        total += diff

    # Validate
    if total != total_amount:
        raise ValueError(f"Sum of splits ({total}) must equal total amount ({total_amount})")

    # Handle wallet deduction for the TOTAL expense amount (not just payer's share)
    if expense_data.wallet_id and expense_data.payer_id == current_user_id:
        # Deduct the total expense amount from the wallet (already calculated above as total_amount)
        await update_wallet_balance(session, expense_data.wallet_id, -total_amount, current_user_id)

    await session.commit()
    await session.flush()
    await session.refresh(exp, ['group']) 
    # Find the split amount for the payer
    payer_split = next((s for s in split_objs if s.user_id == expense_data.payer_id), None)
    payer_amount = float(round_amount(payer_split.share_amount)) if payer_split else 0

    await log_activity(
        session,
        user_id=expense_data.payer_id,
        action=f"added '{exp.description}' in '{exp.group.title}'. You owe {payer_amount}{exp.group.currency}",
        target_type="expense",
        target_id=exp.id
    )

    split_reads = []
    for split_obj in split_objs:
        user = await session.get(User, split_obj.user_id)
        split_reads.append(SplitRead(
            id=split_obj.id,
            expense_id=split_obj.expense_id,
            user_id=split_obj.user_id,
            share_amount=float(round_amount(split_obj.share_amount)),
            username=user.username if user else f"User {split_obj.user_id}"
        ))

    payer_user = await session.get(User, exp.payer_id)
    added_by_user = await session.get(User, exp.added_by)
    
    # Get wallet name
    wallet_name = None
    if exp.wallet_id:
        wallet = await session.get(Wallet, exp.wallet_id)
        wallet_name = wallet.name if wallet else None
    
    return ExpenseRead(
        **expense_data.model_dump(exclude={"splits"}),
        id=exp.id,
        updated_at=exp.created_at,
        splits=split_reads,
        payer_username=payer_user.username if payer_user else "Unknown",
        added_by_username=added_by_user.username if added_by_user else "Unknown",
        wallet_name=wallet_name
    )







async def get_expense_ById(session: AsyncSession, expense_id: int, current_user: User) -> ExpenseRead:
    # fetch expense with its splits and the split users eagerly
    stmt = (
        select(Expense)
        .options(
            selectinload(Expense.splits).selectinload(Split.user)  # load splits and their user relationship
        )
        .where(Expense.id == expense_id)
    )
    result = await session.execute(stmt)
    exp = result.scalars().first()

    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")

    # Optional: enforce membership/permission check here if needed
    # await ensure_user_in_group(session, current_user.id, exp.group_id)

    # build splits list with usernames
    split_reads = []
    for split in exp.splits:
        username = None
        # if your Split.user relationship is configured, try that (should be loaded)
        if getattr(split, "user", None):
            username = split.user.username
        else:
            u = await session.get(User, split.user_id)  # fallback (should not be necessary if eager loaded)
            username = u.username if u else f"User {split.user_id}"

        split_reads.append(
            SplitRead(
                id=split.id,
                expense_id=split.expense_id,
                user_id=split.user_id,
                share_amount=float(round_amount(split.share_amount)),
                username=username,
            )
        )

    payer_user = None
    if exp.payer_id:
        payer_user = await session.get(User, exp.payer_id)
    
    added_by_user = None
    if exp.added_by:
        added_by_user = await session.get(User, exp.added_by)

    # Get wallet name
    wallet_name = None
    if exp.wallet_id:
        wallet = await session.get(Wallet, exp.wallet_id)
        wallet_name = wallet.name if wallet else None

    return ExpenseRead(
        id=exp.id,
        group_id=exp.group_id,
        payer_id=exp.payer_id,
        added_by=exp.added_by,
        description=exp.description,
        amount=exp.amount,
        currency=exp.currency,
        category=exp.category,
        wallet_id=exp.wallet_id,
        split_type=exp.split_type,
        note=exp.note,
        photo=exp.photo,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
        splits=split_reads,
        payer_username=payer_user.username if payer_user else "Unknown",
        added_by_username=added_by_user.username if added_by_user else "Unknown",
        wallet_name=wallet_name
    )


 


# 🔹 Update existing expense
async def update_expense(session: AsyncSession, expense_id: int, payload: ExpenseUpdate, current: User):
    result = await session.execute(
        select(Expense)
        .options(
            selectinload(Expense.splits).selectinload(Split.user),  # preload user for username
            selectinload(Expense.group)  # Load group to check owner
        )
        .where(Expense.id == expense_id)
    )
    expense = result.scalars().first()

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Check if user is the payer OR the group owner (admin)
    is_payer = expense.payer_id == current.id
    is_group_owner = expense.group and expense.group.owner_id == current.id
    
    if not is_payer and not is_group_owner:
        raise HTTPException(status_code=403, detail="Not allowed to edit. Only the payer or group owner can edit expenses.")

    # Store original values for wallet balance calculation
    original_amount = round_amount(Decimal(str(expense.amount)))  # Total expense amount
    original_wallet_id = expense.wallet_id

    # Update fields
    for field, value in payload.dict(exclude={"splits"}, exclude_unset=True).items():
        setattr(expense, field, value)

    # Handle wallet balance adjustments using TOTAL amounts (not payer's share)
    # Only adjust wallet if the current user is the payer (group owner editing doesn't affect wallet)
    if expense.payer_id == current.id:
        # Get new total amount
        new_amount_decimal = round_amount(Decimal(str(payload.amount))) if payload.amount is not None else original_amount
        new_wallet_id = payload.wallet_id if payload.wallet_id is not None else original_wallet_id

        # Adjust wallet balances using TOTAL expense amounts
        if original_wallet_id and original_amount > 0:
            # Refund original TOTAL amount to original wallet
            await update_wallet_balance(session, original_wallet_id, original_amount, current.id)
        
        if new_wallet_id and new_amount_decimal > 0:
            # Deduct new TOTAL amount from new wallet
            await update_wallet_balance(session, new_wallet_id, -new_amount_decimal, current.id)

    # --- Update splits safely (for both payer and group owner) ---
    if payload.splits is not None:
        await session.execute(delete(Split).where(Split.expense_id == expense_id))
        await session.flush()

        new_splits = [
            Split(expense_id=expense_id, user_id=s.user_id, share_amount=s.share_amount)
            for s in payload.splits
        ]
        session.add_all(new_splits)

    await session.commit()
        
    # ✅ Reload expense with user relationship loaded
    result = await session.execute(
        select(Expense)
        .options(selectinload(Expense.splits).selectinload(Split.user))
        .where(Expense.id == expense_id)
    )
    expense = result.scalars().first()

    # ✅ Safely fill username
    for split in expense.splits:
        split.username = split.user.username if split.user else None

    return ExpenseRead.model_validate(expense, from_attributes=True)



# Get expenses for a group, newest first
async def get_expenses_for_group(session: AsyncSession, group_id: int, current_user, limit: int = None, offset: int = 0) -> tuple[list[ExpenseRead], int]:
    """
    Get expenses for a group with optional pagination.
    Returns: (expenses_list, total_count)
    """
    from sqlalchemy import func
    
    # Get total count
    count_result = await session.execute(
        select(func.count(Expense.id))
        .where(Expense.group_id == group_id)
    )
    total_count = count_result.scalar() or 0
    
    # Build query with pagination
    query = (
        select(Expense)
        .where(Expense.group_id == group_id)
        .order_by(Expense.created_at.desc())  # <-- newest first
    )
    
    # Apply pagination if limit is provided
    if limit is not None:
        query = query.limit(limit).offset(offset)
    
    result = await session.execute(query)
    expenses = result.scalars().all()

    expenses_out = []

    for exp in expenses:
        # payer username
        payer_user = await session.get(User, exp.payer_id)
        payer_username = payer_user.username if payer_user else "Unknown"
        
        # added_by username
        added_by_user = await session.get(User, exp.added_by)
        added_by_username = added_by_user.username if added_by_user else "Unknown"

        # wallet name
        wallet_name = None
        if exp.wallet_id:
            wallet = await session.get(Wallet, exp.wallet_id)
            wallet_name = wallet.name if wallet else None

        # splits
        split_result = await session.execute(
            select(Split, User.username)
            .join(User, User.id == Split.user_id)
            .where(Split.expense_id == exp.id)
        )

        split_reads = [
            SplitRead(
                id=split.id,
                expense_id=split.expense_id,
                user_id=split.user_id,
                share_amount=split.share_amount,
                username=username
            )
            for split, username in split_result.all()
        ]

        # Build ExpenseRead directly
        expenses_out.append(
            ExpenseRead(
                id=exp.id,
                group_id=exp.group_id,
                payer_id=exp.payer_id,
                added_by=exp.added_by,
                description=exp.description,
                amount=exp.amount,
                currency=exp.currency,
                category=exp.category,
                wallet_id=exp.wallet_id,
                split_type=exp.split_type,
                note=exp.note,
                photo=exp.photo,
                created_at=exp.created_at,
                updated_at=exp.updated_at,
                splits=split_reads,
                payer_username=payer_username,
                added_by_username=added_by_username,
                wallet_name=wallet_name
            )
        )

    return expenses_out, total_count


# ------------------------
# Membership actions
# ------------------------


async def get_group_members(session: AsyncSession, group_id: int)->list[MembershipRead]:
    
     # Load Memberships with related User
    result = await session.execute(select(Membership).options(selectinload(Membership.user))  # eager load User
        .where(Membership.group_id == group_id)
    )
    memberships = result.scalars().all()

    # Build response with username
    out = []
    for m in memberships:
        out.append(MembershipRead.model_validate({
            "id": m.id,
            "user_id": m.user_id,
            "group_id": m.group_id,
            "is_admin": m.is_admin,
            "username": m.user.username if m.user else None
        }))
    return out

# -------------------
# Add members
# -------------------
async def add_members_to_group(
    session: AsyncSession, group_id: int, user_ids: list[int], is_admin: bool = False
) -> list[Membership]:
    memberships = []

    for uid in user_ids:
        stmt = select(Membership).where(
            Membership.group_id == group_id, Membership.user_id == uid
        )
        res = await session.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            continue

        m = Membership(user_id=uid, group_id=group_id, is_admin=is_admin)
        session.add(m)
        memberships.append(m)

    await session.commit()
    for m in memberships:
        await session.refresh(m)

    return memberships


# -------------------
# Update membership
# -------------------
async def update_membership(
    session: AsyncSession, group_id: int, member_id: int, is_admin: bool
) -> Membership:
    stmt = select(Membership).where(
        Membership.group_id == group_id, Membership.user_id == member_id
    )
    res = await session.execute(stmt)
    membership = res.scalar_one_or_none()

    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    
    # Fetch the group to check who the owner is
    group_res = await session.execute(select(Group).where(Group.id == group_id))
    group = group_res.scalar_one()

    # 🚫 Prevent removing admin from the group owner
    if member_id == group.owner_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot remove admin rights from the group creator."
        )



    membership.is_admin = is_admin
    await session.commit()
    await session.refresh(membership)
    return membership


# -------------------
# Remove member
# -------------------
async def remove_member(session: AsyncSession, group_id: int, member_id: int):
    stmt = select(Membership).where(
        Membership.group_id == group_id, Membership.user_id == member_id
    )
    res = await session.execute(stmt)
    membership = res.scalar_one_or_none()

    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

     # Fetch the group to know the owner
    group_res = await session.execute(select(Group).where(Group.id == group_id))
    group = group_res.scalar_one()

    # 🚫 Prevent deleting the group creator or any admin
    if membership.is_admin or member_id == group.owner_id:
        raise HTTPException(
            status_code=403,
            detail="You cannot remove an admin or the group creator from the group."
        )

    await session.delete(membership)
    await session.commit()
    return


async def group_member_ids(session: AsyncSession, group_id: int) -> list[int]:
    """Return all user IDs in a group."""
    result = await session.execute(
        select(Membership.user_id).where(Membership.group_id == group_id)
    )
    return [uid for (uid,) in result.all() if uid is not None]


# ------------------------
# balence calculer
# ------------------------

def round_amount(value) -> Decimal:
    """Round to 2 decimal places safely using Decimal."""
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

async def compute_global_settlement_adjustment_for_group(
    session: AsyncSession,
    group_id: int,
    user_id: int,
    friend_id: int
) -> Decimal:
    """
    Calculate how much a global settlement between two users should adjust their balance in a specific group.
    Returns the adjustment amount (positive = reduces debt, negative = increases debt).
    """
    from .models import SettlementStatus, GlobalSettlement
    
    # Get the pairwise debt in this group (before global settlements)
    user_paid_friend_owes = await session.execute(
        select(func.sum(Split.share_amount))
        .join(Expense, Expense.id == Split.expense_id)
        .where(
            (Expense.group_id == group_id) &
            (Expense.payer_id == user_id) &
            (Split.user_id == friend_id)
        )
    )
    user_paid_amount = round_amount(user_paid_friend_owes.scalar() or 0)
    
    friend_paid_user_owes = await session.execute(
        select(func.sum(Split.share_amount))
        .join(Expense, Expense.id == Split.expense_id)
        .where(
            (Expense.group_id == group_id) &
            (Expense.payer_id == friend_id) &
            (Split.user_id == user_id)
        )
    )
    friend_paid_amount = round_amount(friend_paid_user_owes.scalar() or 0)
    
    # Net debt in this group (positive = friend owes user, negative = user owes friend)
    net_debt_in_group = round_amount(user_paid_amount - friend_paid_amount)
    
    # Apply group settlements
    group_settlement_rows = await session.execute(
        select(Settlement.from_user_id, Settlement.to_user_id, func.sum(Settlement.amount))
        .where(
            (Settlement.group_id == group_id) &
            (
                ((Settlement.from_user_id == user_id) & (Settlement.to_user_id == friend_id)) |
                ((Settlement.from_user_id == friend_id) & (Settlement.to_user_id == user_id))
            ) &
            (Settlement.status == SettlementStatus.accepted)
        )
        .group_by(Settlement.from_user_id, Settlement.to_user_id)
    )
    
    for from_id, to_id, amount in group_settlement_rows.all():
        amount_dec = round_amount(amount)
        if from_id == user_id:
            net_debt_in_group += amount_dec
        else:
            net_debt_in_group -= amount_dec
    
    # Get all shared groups to calculate total debt
    shared_groups = await get_shared_groups(session, user_id, friend_id)
    total_debt = Decimal("0.00")
    
    for gid in shared_groups:
        # Calculate debt in each shared group (similar logic)
        g_user_paid = await session.execute(
            select(func.sum(Split.share_amount))
            .join(Expense, Expense.id == Split.expense_id)
            .where(
                (Expense.group_id == gid) &
                (Expense.payer_id == user_id) &
                (Split.user_id == friend_id)
            )
        )
        g_friend_paid = await session.execute(
            select(func.sum(Split.share_amount))
            .join(Expense, Expense.id == Split.expense_id)
            .where(
                (Expense.group_id == gid) &
                (Expense.payer_id == friend_id) &
                (Split.user_id == user_id)
            )
        )
        g_net = round_amount((g_user_paid.scalar() or 0) - (g_friend_paid.scalar() or 0))
        
        # Apply group settlements
        g_settlements = await session.execute(
            select(Settlement.from_user_id, Settlement.to_user_id, func.sum(Settlement.amount))
            .where(
                (Settlement.group_id == gid) &
                (
                    ((Settlement.from_user_id == user_id) & (Settlement.to_user_id == friend_id)) |
                    ((Settlement.from_user_id == friend_id) & (Settlement.to_user_id == user_id))
                ) &
                (Settlement.status == SettlementStatus.accepted)
            )
            .group_by(Settlement.from_user_id, Settlement.to_user_id)
        )
        for from_id, to_id, amount in g_settlements.all():
            if from_id == user_id:
                g_net += round_amount(amount)
            else:
                g_net -= round_amount(amount)
        
        total_debt += abs(g_net)  # Use absolute for proportion calculation
    
    if total_debt == Decimal("0.00"):
        return Decimal("0.00")
    
    # Get total global settlements between these users
    global_settlement_rows = await session.execute(
        select(GlobalSettlement.from_user_id, GlobalSettlement.to_user_id, func.sum(GlobalSettlement.amount))
        .where(
            (
                ((GlobalSettlement.from_user_id == user_id) & (GlobalSettlement.to_user_id == friend_id)) |
                ((GlobalSettlement.from_user_id == friend_id) & (GlobalSettlement.to_user_id == user_id))
            ) &
            (GlobalSettlement.status == SettlementStatus.accepted)
        )
        .group_by(GlobalSettlement.from_user_id, GlobalSettlement.to_user_id)
    )
    
    total_global_settlement = Decimal("0.00")
    settlement_details = []
    for from_id, to_id, amount in global_settlement_rows.all():
        amount_dec = round_amount(amount)
        total_global_settlement += amount_dec
        settlement_details.append(f"  {from_id}->{to_id}: {amount_dec}")
    
    print(f"🔍 compute_global_settlement_adjustment_for_group:")
    print(f"   Group {group_id}, User {user_id}, Friend {friend_id}")
    print(f"   net_debt_in_group: {net_debt_in_group}")
    print(f"   total_debt (across all groups): {total_debt}")
    print(f"   Global settlements found: {len(settlement_details)}")
    for detail in settlement_details:
        print(detail)
    print(f"   total_global_settlement: {total_global_settlement}")
    
    # Calculate proportional adjustment for this group
    # Example: If user owes friend 10,000 in group A and 15,000 in group B (total 25,000)
    # And user pays friend 5,000 globally:
    # - Group A gets: (10,000 / 25,000) * 5,000 = 2,000 reduction
    # - Group B gets: (15,000 / 25,000) * 5,000 = 3,000 reduction
    # - User's balance in group A: -10,000 + 2,000 = -8,000 (adjustment is +2,000)
    
    if total_debt == Decimal("0.00") or abs(net_debt_in_group) == Decimal("0.00"):
        return Decimal("0.00")
    
    # Calculate what proportion of total debt is in this group
    group_proportion = abs(net_debt_in_group) / total_debt if total_debt > 0 else Decimal("0.00")
    
    print(f"   group_proportion: {group_proportion}")
    
    # Check net global settlement direction from user's perspective
    # Positive = user paid friend (reduces debt if user owes friend)
    # Negative = friend paid user (reduces what friend owes if friend owes user)
    net_global_settlement = Decimal("0.00")
    # Re-execute to get the rows again (they were consumed in the previous loop)
    global_settlement_rows = await session.execute(
        select(GlobalSettlement.from_user_id, GlobalSettlement.to_user_id, func.sum(GlobalSettlement.amount))
        .where(
            (
                ((GlobalSettlement.from_user_id == user_id) & (GlobalSettlement.to_user_id == friend_id)) |
                ((GlobalSettlement.from_user_id == friend_id) & (GlobalSettlement.to_user_id == user_id))
            ) &
            (GlobalSettlement.status == SettlementStatus.accepted)
        )
        .group_by(GlobalSettlement.from_user_id, GlobalSettlement.to_user_id)
    )
    
    for from_id, to_id, amount in global_settlement_rows.all():
        amount_dec = round_amount(amount)
        if from_id == user_id:  # User paid friend
            net_global_settlement += amount_dec  # Positive = user paid friend
        else:  # Friend paid user
            net_global_settlement -= amount_dec  # Negative = friend paid user
    
    print(f"   net_global_settlement: {net_global_settlement}")
    
    # Calculate the adjustment amount proportionally
    # The adjustment should reduce the debt in the direction of the global settlement
    # Example: If user owes friend 7698 in this group (only group), and user pays friend 7698 globally:
    #   - net_debt_in_group = -7698 (user owes friend)
    #   - net_global_settlement = +7698 (user paid friend)
    #   - group_proportion = 7698 / 7698 = 1.0
    #   - adjustment = +7698 * 1.0 = +7698
    #   - New balance = -7698 + 7698 = 0 ✓
    
    # The adjustment should move the balance towards zero
    # If user owes friend (negative balance) and user paid friend (positive net_global_settlement):
    #   - Add positive adjustment to reduce the negative debt: -7698 + 7698 = 0
    # If friend owes user (positive balance) and friend paid user (negative net_global_settlement):
    #   - Subtract from positive balance to reduce what friend owes: +7698 - 7698 = 0
    # 
    # The key: adjustment sign should be opposite to net_debt_in_group sign when net_global_settlement
    # is in the direction that reduces the debt
    
    # Calculate base adjustment amount (always positive, proportional)
    base_adjustment = round_amount(abs(net_global_settlement) * group_proportion)
    
    print(f"   base_adjustment: {base_adjustment}")
    
    # Determine direction: if net_debt and net_global_settlement have opposite signs,
    # the settlement reduces the debt, so adjustment should move balance towards zero
    if (net_debt_in_group < 0 and net_global_settlement > 0) or \
       (net_debt_in_group > 0 and net_global_settlement < 0):
        # Settlement reduces the debt: adjustment moves balance towards zero
        # If user owes friend (-7698) and user paid friend (+7698): adjustment = +7698
        # If friend owes user (+7698) and friend paid user (-7698): adjustment = -7698
        if net_debt_in_group < 0:
            adjustment = base_adjustment  # Positive adjustment reduces negative debt
        else:
            adjustment = -base_adjustment  # Negative adjustment reduces positive balance
        print(f"   Final adjustment (reduces debt): {adjustment}")
        return adjustment
    else:
        # Settlement increases the debt (shouldn't happen in normal flow, but handle it)
        if net_debt_in_group < 0:
            adjustment = -base_adjustment  # Negative adjustment increases negative debt
        else:
            adjustment = base_adjustment  # Positive adjustment increases positive balance
        print(f"   Final adjustment (increases debt): {adjustment}")
        return adjustment


async def compute_group_balances_with_adjustments(
    session: AsyncSession,
    group_id: int,
    current_user_id: Optional[int] = None,
    mode: Optional[str] = None
) -> tuple[dict[int, float], dict[int, float], dict[int, float]]:
    """
    Calculate group balances with global settlement adjustments.
    
    Returns: (original_balances, adjusted_balances, adjustments)
    - original_balances: balances without global settlement adjustments
    - adjusted_balances: balances with global settlement adjustments (if mode allows)
    - adjustments: amount adjusted per user (for hybrid mode display)
    """
    # Calculate original balances (standard group balance calculation)
    # --- 1️⃣ Credits: total each user paid ---
    payer_rows = await session.execute(
        select(Expense.payer_id, func.sum(Expense.amount))
        .where(Expense.group_id == group_id)
        .group_by(Expense.payer_id)
    )
    credits: dict[int, Decimal] = {
        uid: round_amount(total)
        for uid, total in payer_rows.all() if uid
    }

    # --- 2️⃣ Debits: total each user owes (splits) ---
    split_rows = await session.execute(
        select(Split.user_id, func.sum(Split.share_amount))
        .join(Expense, Expense.id == Split.expense_id)
        .where(Expense.group_id == group_id)
        .group_by(Split.user_id)
    )
    debits: dict[int, Decimal] = {
        uid: round_amount(total)
        for uid, total in split_rows.all() if uid
    }

    # --- 3️⃣ Settlements: adjust recorded payments (only accepted) ---
    from .models import SettlementStatus
    settlement_rows = await session.execute(
        select(Settlement.from_user_id, Settlement.to_user_id, func.sum(Settlement.amount))
        .where(
            (Settlement.group_id == group_id) &
            (Settlement.status == SettlementStatus.accepted)
        )
        .group_by(Settlement.from_user_id, Settlement.to_user_id)
    )

    # --- Build initial balances ---
    balances: dict[int, Decimal] = {}
    users = set(await group_member_ids(session, group_id)) | set(credits.keys()) | set(debits.keys())
    for uid in users:
        balances[uid] = round_amount(credits.get(uid, Decimal("0.00")) - debits.get(uid, Decimal("0.00")))

    # --- Apply group settlements (Decimal precise) ---
    for from_id, to_id, amount in settlement_rows.all():
        amount_dec = round_amount(amount)
        if from_id in balances:
            balances[from_id] += amount_dec
        if to_id in balances:
            balances[to_id] -= amount_dec

    # --- Store original balances ---
    original_balances = {uid: round_amount(val) for uid, val in balances.items()}
    adjusted_balances = original_balances.copy()
    adjustments: dict[int, Decimal] = {uid: Decimal("0.00") for uid in users}
    
    # --- Apply global settlements if mode is 'auto_adjust' or 'hybrid' ---
    print(f"🔍 compute_group_balances_with_adjustments: mode={mode}, current_user_id={current_user_id}")
    if mode in ['auto_adjust', 'hybrid'] and current_user_id:
        from .models import GlobalSettlement
        
        print(f"🔍 Applying global settlement adjustments (mode: {mode})")
        
        # Get all friends of current user
        friends = await get_accepted_friends(session, current_user_id)
        print(f"🔍 Found {len(friends)} friends for user {current_user_id}")
        
        for friend in friends:
            friend_id = friend.friend_id if friend.user_id == current_user_id else friend.user_id
            
            # Check if both users are in this group
            if current_user_id in users and friend_id in users:
                print(f"🔍 Processing friend {friend_id} in group {group_id}")
                # Calculate global settlement adjustment for this group
                adjustment = await compute_global_settlement_adjustment_for_group(
                    session, group_id, current_user_id, friend_id
                )
                
                # Debug logging
                print(f"🔍 Group {group_id}: Adjustment for user {current_user_id} and friend {friend_id} = {adjustment}")
                print(f"   Original balance for user {current_user_id}: {original_balances.get(current_user_id, 0)}")
                print(f"   Original balance for friend {friend_id}: {original_balances.get(friend_id, 0)}")
                
                # Apply adjustment
                if current_user_id in adjusted_balances:
                    old_balance = adjusted_balances[current_user_id]
                    adjusted_balances[current_user_id] = round_amount(adjusted_balances[current_user_id] + adjustment)
                    adjustments[current_user_id] = round_amount(adjustments[current_user_id] + adjustment)
                    print(f"   User {current_user_id}: {old_balance} + {adjustment} = {adjusted_balances[current_user_id]}")
                if friend_id in adjusted_balances:
                    old_balance = adjusted_balances[friend_id]
                    adjusted_balances[friend_id] = round_amount(adjusted_balances[friend_id] - adjustment)
                    adjustments[friend_id] = round_amount(adjustments[friend_id] - adjustment)
                    print(f"   Friend {friend_id}: {old_balance} - {adjustment} = {adjusted_balances[friend_id]}")
    else:
        print(f"🔍 Skipping global settlement adjustments (mode: {mode}, current_user_id: {current_user_id})")
    
    # --- Final rounding cleanup ---
    for uid in users:
        original_balances[uid] = round_amount(original_balances[uid])
        adjusted_balances[uid] = round_amount(adjusted_balances[uid])
        adjustments[uid] = round_amount(adjustments[uid])
        # avoid showing -0.00
        if abs(original_balances[uid]) < Decimal("0.01"):
            original_balances[uid] = Decimal("0.00")
        if abs(adjusted_balances[uid]) < Decimal("0.01"):
            adjusted_balances[uid] = Decimal("0.00")
        if abs(adjustments[uid]) < Decimal("0.01"):
            adjustments[uid] = Decimal("0.00")
    
    # Convert to float
    orig = {uid: float(val) for uid, val in original_balances.items()}
    adj = {uid: float(val) for uid, val in adjusted_balances.items()}
    adj_amounts = {uid: float(val) for uid, val in adjustments.items()}
    
    return orig, adj, adj_amounts


async def compute_group_balances(
    session: AsyncSession, 
    group_id: int,
    current_user_id: Optional[int] = None,
    mode: Optional[str] = None
) -> dict[int, float]:
    """
    Return net balance per user (positive = others owe them, negative = they owe others).
    
    If mode is 'auto_adjust' or 'hybrid', applies global settlements proportionally.
    If mode is 'separate' or None, returns original balances (no global adjustment).
    """
    original, adjusted, _ = await compute_group_balances_with_adjustments(
        session, group_id, current_user_id, mode
    )
    
    # Return adjusted if mode is auto_adjust or hybrid, original otherwise
    if mode in ['auto_adjust', 'hybrid']:
        return adjusted
    else:
        return original

    # --- 1️⃣ Credits: total each user paid ---
    payer_rows = await session.execute(
        select(Expense.payer_id, func.sum(Expense.amount))
        .where(Expense.group_id == group_id)
        .group_by(Expense.payer_id)
    )
    credits: dict[int, Decimal] = {
        uid: round_amount(total)
        for uid, total in payer_rows.all() if uid
    }

    # --- 2️⃣ Debits: total each user owes (splits) ---
    split_rows = await session.execute(
        select(Split.user_id, func.sum(Split.share_amount))
        .join(Expense, Expense.id == Split.expense_id)
        .where(Expense.group_id == group_id)
        .group_by(Split.user_id)
    )
    debits: dict[int, Decimal] = {
        uid: round_amount(total)
        for uid, total in split_rows.all() if uid
    }

    # --- 3️⃣ Settlements: adjust recorded payments (only accepted) ---
    from .models import SettlementStatus
    settlement_rows = await session.execute(
        select(Settlement.from_user_id, Settlement.to_user_id, func.sum(Settlement.amount))
        .where(
            (Settlement.group_id == group_id) &
            (Settlement.status == SettlementStatus.accepted)
        )
        .group_by(Settlement.from_user_id, Settlement.to_user_id)
    )

    # --- Build initial balances ---
    balances: dict[int, Decimal] = {}
    users = set(await group_member_ids(session, group_id)) | set(credits.keys()) | set(debits.keys())
    for uid in users:
        balances[uid] = round_amount(credits.get(uid, Decimal("0.00")) - debits.get(uid, Decimal("0.00")))

    # --- Apply settlements (Decimal precise) ---
    for from_id, to_id, amount in settlement_rows.all():
        amount_dec = round_amount(amount)
        if from_id in balances:
            balances[from_id] += amount_dec
        if to_id in balances:
            balances[to_id] -= amount_dec

    # --- Store original balances (before global settlement adjustments) ---
    original_balances = balances.copy()
    
    # --- Apply global settlements if mode is 'auto_adjust' or 'hybrid' ---
    if mode in ['auto_adjust', 'hybrid'] and current_user_id:
        from .models import GlobalSettlement, SettlementStatus
        
        # Get all friends of current user
        friends = await get_accepted_friends(session, current_user_id)
        
        for friend in friends:
            friend_id = friend.friend_id if friend.user_id == current_user_id else friend.user_id
            
            # Check if both users are in this group
            user_in_group = current_user_id in users
            friend_in_group = friend_id in users
            
            if user_in_group and friend_in_group:
                # Calculate global settlement adjustment for this group
                adjustment = await compute_global_settlement_adjustment_for_group(
                    session, group_id, current_user_id, friend_id
                )
                
                # Apply adjustment to balances
                if current_user_id in balances:
                    balances[current_user_id] = round_amount(balances[current_user_id] + adjustment)
                if friend_id in balances:
                    balances[friend_id] = round_amount(balances[friend_id] - adjustment)

    # --- Final rounding cleanup ---
    for uid, val in balances.items():
        val = round_amount(val)
        # avoid showing -0.00
        if abs(val) < Decimal("0.01"):  # Treat values less than 0.01 as zero
            val = Decimal("0.00")
        balances[uid] = val

    # For hybrid mode, we need to return additional info
    # But since this function returns dict[int, float], we'll handle hybrid mode in the API layer
    # For now, return adjusted balances if mode is auto_adjust or hybrid, original if separate
    if mode == 'separate' or not mode:
        # Return original balances (no global settlement adjustment)
        return {uid: float(round_amount(val)) for uid, val in original_balances.items()}
    else:
        # Return adjusted balances (with global settlement adjustment)
        return {uid: float(round_amount(val)) for uid, val in balances.items()}


# ------------------------
# Global Settlement Helpers
# ------------------------

async def get_accepted_friends(session: AsyncSession, user_id: int) -> list[Friend]:
    """Get all accepted friends for a user."""
    result = await session.execute(
        select(Friend).where(
            ((Friend.user_id == user_id) | (Friend.friend_id == user_id)) &
            (Friend.status == FriendStatus.accepted)
        )
    )
    return result.scalars().all()


async def get_shared_groups(session: AsyncSession, user1_id: int, user2_id: int) -> list[int]:
    """Get all group IDs where both users are members."""
    # Get groups where user1 is a member
    user1_groups = await session.execute(
        select(Membership.group_id).where(Membership.user_id == user1_id)
    )
    user1_group_ids = {row[0] for row in user1_groups.all()}
    
    # Get groups where user2 is a member
    user2_groups = await session.execute(
        select(Membership.group_id).where(Membership.user_id == user2_id)
    )
    user2_group_ids = {row[0] for row in user2_groups.all()}
    
    # Return intersection (groups where both are members)
    return list(user1_group_ids & user2_group_ids)


async def ensure_friendship(session: AsyncSession, user1_id: int, user2_id: int):
    """Verify that two users are friends (accepted status)."""
    result = await session.execute(
        select(Friend).where(
            ((Friend.user_id == user1_id) & (Friend.friend_id == user2_id)) |
            ((Friend.user_id == user2_id) & (Friend.friend_id == user1_id))
        )
    )
    friendship = result.scalars().first()
    
    if not friendship or friendship.status != FriendStatus.accepted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only settle with accepted friends."
        )
    return friendship


async def compute_global_balances(session: AsyncSession, user_id: int) -> dict[int, float]:
    """
    Calculate net balance with each friend across ALL shared groups.
    
    Returns: {friend_id: net_balance}
    - Positive = friend owes you
    - Negative = you owe friend
    """
    from .models import SettlementStatus
    
    # Get all accepted friends
    friends = await get_accepted_friends(session, user_id)
    global_balances: dict[int, Decimal] = {}
    
    for friend in friends:
        # Determine friend_id (could be user_id or friend_id depending on direction)
        friend_id = friend.friend_id if friend.user_id == user_id else friend.user_id
        
        # Get all groups where both users are members
        shared_groups = await get_shared_groups(session, user_id, friend_id)
        
        if not shared_groups:
            continue  # No shared groups, skip this friend
        
        # Aggregate balances from all shared groups
        # Calculate actual pairwise debt by looking at expenses directly
        total_balance = Decimal("0.00")
        
        for group_id in shared_groups:
            # Calculate pairwise debt: what user owes friend (or vice versa)
            # Method: Look at expenses where one paid and the other was in the split
            
            # 1. Expenses where user paid and friend was in split
            user_paid_friend_owes = await session.execute(
                select(func.sum(Split.share_amount))
                .join(Expense, Expense.id == Split.expense_id)
                .where(
                    (Expense.group_id == group_id) &
                    (Expense.payer_id == user_id) &
                    (Split.user_id == friend_id)
                )
            )
            user_paid_amount = round_amount(user_paid_friend_owes.scalar() or 0)
            
            # 2. Expenses where friend paid and user was in split
            friend_paid_user_owes = await session.execute(
                select(func.sum(Split.share_amount))
                .join(Expense, Expense.id == Split.expense_id)
                .where(
                    (Expense.group_id == group_id) &
                    (Expense.payer_id == friend_id) &
                    (Split.user_id == user_id)
                )
            )
            friend_paid_amount = round_amount(friend_paid_user_owes.scalar() or 0)
            
            # Net: positive means friend owes user, negative means user owes friend
            net_in_group = round_amount(user_paid_amount - friend_paid_amount)
            
            # Debug logging
            print(f"  📊 Group {group_id}: user_paid={user_paid_amount}, friend_paid={friend_paid_amount}, net={net_in_group}")
            
            # 3. Apply group settlements (only accepted ones)
            group_settlement_rows = await session.execute(
                select(Settlement.from_user_id, Settlement.to_user_id, func.sum(Settlement.amount))
                .where(
                    (Settlement.group_id == group_id) &
                    (
                        ((Settlement.from_user_id == user_id) & (Settlement.to_user_id == friend_id)) |
                        ((Settlement.from_user_id == friend_id) & (Settlement.to_user_id == user_id))
                    ) &
                    (Settlement.status == SettlementStatus.accepted)
                )
                .group_by(Settlement.from_user_id, Settlement.to_user_id)
            )
            
            for from_id, to_id, amount in group_settlement_rows.all():
                amount_dec = round_amount(amount)
                if from_id == user_id:
                    # User paid friend, so friend owes less (or user owes more)
                    net_in_group += amount_dec
                else:
                    # Friend paid user, so friend owes more (or user owes less)
                    net_in_group -= amount_dec
            
            total_balance += net_in_group
        
        # Apply global settlements (only accepted ones)
        global_settlement_rows = await session.execute(
            select(GlobalSettlement.from_user_id, GlobalSettlement.to_user_id, func.sum(GlobalSettlement.amount))
            .where(
                (
                    ((GlobalSettlement.from_user_id == user_id) & (GlobalSettlement.to_user_id == friend_id)) |
                    ((GlobalSettlement.from_user_id == friend_id) & (GlobalSettlement.to_user_id == user_id))
                ) &
                (GlobalSettlement.status == SettlementStatus.accepted)
            )
            .group_by(GlobalSettlement.from_user_id, GlobalSettlement.to_user_id)
        )
        
        for from_id, to_id, amount in global_settlement_rows.all():
            amount_dec = round_amount(amount)
            if from_id == user_id:
                # You paid them, so you're owed less (or owe more)
                total_balance += amount_dec
            else:
                # They paid you, so you're owed more (or owe less)
                total_balance -= amount_dec
        
        # Round final balance
        global_balances[friend_id] = round_amount(total_balance)
        
        # Debug logging
        print(f"🔍 Global balance with friend {friend_id}: {total_balance} (shared groups: {shared_groups})")
    
    # Convert to float for JSON response
    # Don't filter out small balances - let the frontend decide what to show
    # Filter only truly zero balances (less than 0.01)
    result = {fid: float(bal) for fid, bal in global_balances.items() if abs(bal) >= Decimal("0.01")}
    print(f"🔍 Final global balances (after filtering): {result}")
    print(f"🔍 All global balances before filtering: {[(fid, float(bal)) for fid, bal in global_balances.items()]}")
    return result


# ------------------------
# checking members
# ------------------------

async def ensure_user_in_group(session, user_id: int, group_id: int):
    result = await session.execute(
        select(Membership).where(
            Membership.group_id == group_id,
            Membership.user_id == user_id
        )
    )
    member = result.scalars().first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group."
        )
    return member

async def ensure_user_is_admin(session, user_id: int, group_id: int):
    result = await session.execute(
        select(Membership).where(
            Membership.group_id == group_id,
            Membership.user_id == user_id
        )
    )
    member = result.scalars().first()
    if not member or not member.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin of this group."
        )


# ------------------------
# activité
# ------------------------


async def log_activity(session: AsyncSession, user_id: int, action: str, target_type: str = None, target_id: int = None):
    log = ActivityLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
    )
    session.add(log)
    await session.commit()



# =========================================================
# Add Income (and update wallet balance)
# =========================================================
async def add_income(session: AsyncSession, user_id: int, data: IncomeCreate) -> IncomeRead:
    # 1️⃣ Verify wallet
    wallet = await session.get(Wallet, data.wallet_id)
    if not wallet or wallet.user_id != user_id:
        raise HTTPException(status_code=404, detail="Wallet not found")

    # 2️⃣ Verify income type
    income_type = await session.get(IncomeType, data.income_type_id)
    if not income_type or (income_type.user_id not in (None, user_id)):
        raise HTTPException(status_code=404, detail="Income type not found")

    # 3️⃣ Validate amount
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    # 4️⃣ Create income
    new_income = Income(
        user_id=user_id,
        wallet_id=data.wallet_id,
        income_type_id=data.income_type_id,
        amount=data.amount,
        source_type=data.source_type,
        note=data.note,
        date=data.date if data.date else datetime.utcnow(),
    )

    # 5️⃣ Update wallet balance
    wallet.balance += Decimal(data.amount)

    session.add(new_income)
    await session.commit()
    await session.refresh(new_income)
    return new_income


# =========================================================
# Get all incomes for user
# =========================================================
async def get_user_incomes(session: AsyncSession, user_id: int, from_date=None, to_date=None):
    query = select(Income).where(Income.user_id == user_id)

    if from_date:
        query = query.where(Income.date >= from_date)
    if to_date:
        query = query.where(Income.date <= to_date)

    # Eager load wallet and income_type
    query = query.options(
        selectinload(Income.wallet),
        selectinload(Income.income_type)
    ).order_by(Income.date.desc())

    result = await session.execute(query)
    incomes = result.scalars().all()

    # Serialize with names
    return [
    {
        "id": i.id,
        "user_id": i.user_id,
        "amount": float(i.amount),
        "date": i.date,
        "note": i.note,
        "wallet_id": i.wallet_id,
        "wallet_name": i.wallet.name if i.wallet else "",
        "income_type_id": i.income_type_id,
        "category_name": i.income_type.name if i.income_type else "",
        "created_at": i.created_at,
        "updated_at": i.updated_at,
    }
    for i in incomes
]



# =========================================================
# Get balance summary
# =========================================================
async def get_balance_summary(session: AsyncSession, user_id: int):
    result = await session.execute(
        select(Wallet.category, func.sum(Wallet.balance))
        .where(Wallet.user_id == user_id)
        .group_by(Wallet.category)
    )
    balances = {row[0]: row[1] for row in result.all()}
    total = sum(balances.values())
    
    # Bank Balance = Bank + Credit Card wallets
    bank_balance = balances.get("Bank", 0) + balances.get("Credit Card", 0)
    
    # Cash Balance = Cash wallets only
    cash_balance = balances.get("Cash", 0)
    
    return {
        "bank": bank_balance,
        "cash": cash_balance,
        "total": total,
    }


# =========================================================
# Update Income (adjust wallet balance if amount or wallet changed)
# =========================================================
async def update_income(session: AsyncSession, income_id: int, user_id: int, data: IncomeUpdate):
    result = await session.execute(
        select(Income).where(Income.id == income_id, Income.user_id == user_id)
    )
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=404, detail="Income not found")

    # store old wallet & amount
    old_wallet = await session.get(Wallet, income.wallet_id)
    old_amount = income.amount

    # update fields
    for field, value in data.dict(exclude_unset=True).items():
        setattr(income, field, value)

    # Validate amount if provided
    if data.amount is not None and data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    
    # if wallet changed
    if data.wallet_id and data.wallet_id != old_wallet.id:
        new_wallet = await session.get(Wallet, data.wallet_id)
        if not new_wallet or new_wallet.user_id != user_id:
            raise HTTPException(status_code=404, detail="New wallet not found")

        # move balance between wallets
        old_wallet.balance -= old_amount
        # Validate old wallet won't go negative
        if old_wallet.balance < 0:
            raise HTTPException(status_code=400, detail=f"Insufficient balance in source wallet. Available: {old_wallet.balance + old_amount:.2f}")
        
        new_amount = data.amount if data.amount is not None else income.amount
        new_wallet.balance += new_amount
    else:
        # same wallet → adjust balance difference
        new_amount = data.amount if data.amount is not None else income.amount
        diff = new_amount - old_amount
        new_balance = old_wallet.balance + diff
        # Validate wallet won't go negative
        if new_balance < 0:
            raise HTTPException(status_code=400, detail=f"Insufficient balance. Available: {old_wallet.balance:.2f}, Required: {abs(diff):.2f}")
        old_wallet.balance = new_balance

    await session.commit()
    await session.refresh(income)
    return income


# =========================================================
# Delete Income (subtract from wallet)
# =========================================================
async def delete_income(session: AsyncSession, income_id: int, user_id: int):
    result = await session.execute(
        select(Income).where(Income.id == income_id, Income.user_id == user_id)
    )
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=404, detail="Income not found")

    # adjust wallet
    wallet = await session.get(Wallet, income.wallet_id)
    if wallet and wallet.user_id == user_id:
        new_balance = wallet.balance - income.amount
        # Validate wallet won't go negative
        if new_balance < 0:
            raise HTTPException(status_code=400, detail=f"Cannot delete income. Wallet balance would become negative. Current balance: {wallet.balance:.2f}, Income amount: {income.amount:.2f}")
        wallet.balance = new_balance

    await session.delete(income)
    await session.commit()
    return {"message": "Income deleted"}
