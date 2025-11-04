# backend/app/crud.py
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select, func
from sqlalchemy.orm import selectinload

from .models import Income, IncomeType, Settlement, User, Group, Membership, Expense, Split, ActivityLog, Wallet
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
        
        output.append(
            GroupRead.model_validate({
                **group.__dict__,
                "owner_username": owner_username,
                "members_usernames": members_usernames
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
    return ExpenseRead(
        **expense_data.model_dump(exclude={"splits"}),
        id=exp.id,
        updated_at=exp.created_at,
        splits=split_reads,
        payer_username=payer_user.username if payer_user else "Unknown",
        added_by_username=added_by_user.username if added_by_user else "Unknown"
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
async def get_expenses_for_group(session: AsyncSession, group_id: int, current_user) -> list[ExpenseRead]:
    result = await session.execute(
        select(Expense)
        .where(Expense.group_id == group_id)
        .order_by(Expense.created_at.desc())  # <-- newest first
    )
    expenses = result.scalars().all()

    expenses_out = []

    for exp in expenses:
        # payer username
        payer_user = await session.get(User, exp.payer_id)
        payer_username = payer_user.username if payer_user else "Unknown"
        
        # added_by username
        added_by_user = await session.get(User, exp.added_by)
        added_by_username = added_by_user.username if added_by_user else "Unknown"

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
                added_by_username=added_by_username
            )
        )

    return expenses_out


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

async def compute_group_balances(session: AsyncSession, group_id: int) -> dict[int, float]:
    """Return net balance per user (positive = others owe them, negative = they owe others)."""

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

    # --- 3️⃣ Settlements: adjust recorded payments ---
    settlement_rows = await session.execute(
        select(Settlement.from_user_id, Settlement.to_user_id, func.sum(Settlement.amount))
        .where(Settlement.group_id == group_id)
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

    # --- Final rounding cleanup ---
    for uid, val in balances.items():
        val = round_amount(val)
        # avoid showing -0.00
        if val == Decimal("-0.00"):
            val = Decimal("0.00")
        balances[uid] = val

    # convert to float for JSON response
    return {uid: float(val) for uid, val in balances.items()}


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
