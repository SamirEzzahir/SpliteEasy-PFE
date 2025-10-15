# backend/app/crud.py
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select, func
from sqlalchemy.orm import selectinload

from .models import Settlement, User, Group, Membership, Expense, Split, ActivityLog
from .utils import hash_password
from .schemas import ExpenseUpdate, SplitRead, UserCreate, UserRead, GroupCreate, GroupRead, MembershipRead, ExpenseCreate, ExpenseRead
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
    await log_activity(session, user_id=current_user.id, action=f"created group '{group.name}'", target_type="group", target_id=group.id)
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


async def update_group(session: AsyncSession, group_id: int, data: dict) -> GroupRead:
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

async def add_expense(session, expense_data: ExpenseCreate, splits: list[tuple[int, float]]) -> ExpenseRead:
    total_amount = round_amount(expense_data.amount)

    exp = Expense(
        group_id=expense_data.group_id,
        payer_id=expense_data.payer_id or None,
        description=expense_data.description,
        amount=float(total_amount),  # keep float for DB column (Numeric)
        currency=expense_data.currency,
        category=expense_data.category,
        split_type=expense_data.split_type,
        note=expense_data.note,
        photo=expense_data.photo,
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
    return ExpenseRead(
        **expense_data.model_dump(exclude={"splits"}),
        id=exp.id,
        created_at=exp.created_at,
        updated_at=datetime.utcnow(),
        splits=split_reads,
        payer_username=payer_user.username if payer_user else "Unknown"
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

    return ExpenseRead(
        id=exp.id,
        group_id=exp.group_id,
        payer_id=exp.payer_id,
        description=exp.description,
        amount=exp.amount,
        currency=exp.currency,
        category=exp.category,
        split_type=exp.split_type,
        note=exp.note,
        photo=exp.photo,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
        splits=split_reads,
        payer_username=payer_user.username if payer_user else "Unknown",
    )


 


# 🔹 Update existing expense
async def update_expense(session: AsyncSession, expense_id: int, payload: ExpenseUpdate, current: User):
    result = await session.execute(
        select(Expense)
        .options(selectinload(Expense.splits).selectinload(Split.user))  # preload user for username
        .where(Expense.id == expense_id)
    )
    expense = result.scalars().first()

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    # Update fields
    for field, value in payload.dict(exclude={"splits"}, exclude_unset=True).items():
        setattr(expense, field, value)

    # Update splits
    if payload.splits is not None:
        await session.execute(delete(Split).where(Split.expense_id == expense_id))
        for s in payload.splits:
            session.add(Split(expense_id=expense_id, user_id=s.user_id, share_amount=s.share_amount))

    await session.commit()
    await session.refresh(expense)

    # Fill username manually for Pydantic
    for split in expense.splits:
        split.username = split.user.username if split.user else None

    return ExpenseRead.model_validate(expense, from_attributes=True)


# Get expenses for a group
async def get_expenses_for_group(session: AsyncSession, group_id: int, current_user) -> list[ExpenseRead]:
    result = await session.execute(select(Expense).where(Expense.group_id == group_id))
    expenses = result.scalars().all()

    expenses_out = []

    for exp in expenses:
        # payer username
        payer_user = await session.get(User, exp.payer_id)
        payer_username = payer_user.username if payer_user else "Unknown"

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
                description=exp.description,
                amount=exp.amount,
                currency=exp.currency,
                category=exp.category,
                split_type=exp.split_type,
                note=exp.note,
                photo=exp.photo,
                created_at=exp.created_at,
                updated_at=exp.updated_at,
                splits=split_reads,
                payer_username=payer_username
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


async def log_activity(
    session: AsyncSession,
    user_id: int,
    action: str,
    target_type: str,
    target_id: int,
    affected_users: list[int] | None = None,
):
    """
    Universal activity logger.

    - user_id: actor who did the action
    - action: human-readable description
    - target_type: e.g., "expense", "group", "membership"
    - target_id: the id of the target object
    - affected_users: list of users affected by this action (optional)
    """
    log = ActivityLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        created_at=datetime.utcnow(),
        affected_users=affected_users or [],
    )
    session.add(log)
    await session.commit()
