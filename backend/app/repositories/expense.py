from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.models import User, Group, Expense, Split, Wallet, JarTransaction
from app.schemas import ExpenseCreate, ExpenseRead, ExpenseUpdate, SplitRead


def round_amount(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def to_naive_utc(dt: datetime | None) -> datetime:
    """Coerce a client-supplied datetime to naive UTC.

    Our timestamp columns are TIMESTAMP WITHOUT TIME ZONE (naive), but clients
    send tz-aware ISO strings. Storing an aware datetime raises a DataError in
    asyncpg, so normalize to UTC and drop the tzinfo here.
    """
    if dt is None:
        return datetime.utcnow()
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


async def update_wallet_balance(session: AsyncSession, wallet_id: int, amount_change: Decimal, user_id: int):
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


async def add_expense(session: AsyncSession, expense_data: ExpenseCreate, splits: list[tuple[int, float]], current_user_id: int) -> ExpenseRead:
    from app.repositories.activity import log_activity

    total_amount = round_amount(expense_data.amount)
    created_ts = to_naive_utc(expense_data.created_at)

    group = await session.get(Group, expense_data.group_id)
    group_currency = group.currency if group else "USD"

    exp = Expense(
        group_id=expense_data.group_id,
        payer_id=expense_data.payer_id or None,
        added_by=expense_data.added_by or current_user_id,
        description=expense_data.description,
        amount=float(total_amount),
        currency=group_currency,
        category=expense_data.category,
        wallet_id=expense_data.wallet_id,
        split_type=expense_data.split_type,
        jar_type=expense_data.jar_type,
        is_from_jar=expense_data.is_from_jar,
        note=expense_data.note,
        photo=expense_data.photo,
        created_at=created_ts,
        updated_at=created_ts,
    )
    session.add(exp)
    await session.flush()

    if expense_data.jar_type and expense_data.is_from_jar:
        session.add(JarTransaction(
            user_id=expense_data.payer_id or current_user_id,
            jar_type=expense_data.jar_type,
            amount=-float(total_amount),
            description=f"Group Expense: {expense_data.description}",
            date=created_ts,
        ))

    total = Decimal("0.00")
    split_objs = []
    for uid, share in splits:
        rounded_share = round_amount(share)
        total += rounded_share
        split_obj = Split(expense_id=exp.id, user_id=uid, share_amount=float(rounded_share))
        session.add(split_obj)
        split_objs.append(split_obj)

    diff = total_amount - total
    if diff != Decimal("0.00") and split_objs:
        first = split_objs[0]
        first.share_amount = float(round_amount(Decimal(first.share_amount) + diff))
        total += diff

    if total != total_amount:
        raise ValueError(f"Sum of splits ({total}) must equal total amount ({total_amount})")

    if expense_data.wallet_id and expense_data.payer_id == current_user_id:
        await update_wallet_balance(session, expense_data.wallet_id, -total_amount, current_user_id)

    await session.commit()
    await session.flush()
    await session.refresh(exp, ["group"])

    payer_split = next((s for s in split_objs if s.user_id == expense_data.payer_id), None)
    payer_amount = float(round_amount(payer_split.share_amount)) if payer_split else 0

    await log_activity(
        session,
        user_id=expense_data.payer_id,
        action=f"added '{exp.description}' in '{exp.group.title}'. You owe {payer_amount}{exp.group.currency}",
        target_type="expense",
        target_id=exp.id,
    )

    split_reads = []
    for split_obj in split_objs:
        user = await session.get(User, split_obj.user_id)
        split_reads.append(SplitRead(
            id=split_obj.id,
            expense_id=split_obj.expense_id,
            user_id=split_obj.user_id,
            share_amount=float(round_amount(split_obj.share_amount)),
            username=user.username if user else f"User {split_obj.user_id}",
        ))

    payer_user = await session.get(User, exp.payer_id)
    added_by_user = await session.get(User, exp.added_by)

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
        wallet_name=wallet_name,
    )


async def get_expense_ById(session: AsyncSession, expense_id: int, current_user: User) -> ExpenseRead:
    stmt = (
        select(Expense)
        .options(selectinload(Expense.splits).selectinload(Split.user))
        .where(Expense.id == expense_id)
    )
    result = await session.execute(stmt)
    exp = result.scalars().first()

    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")

    split_reads = []
    for split in exp.splits:
        username = split.user.username if getattr(split, "user", None) else f"User {split.user_id}"
        split_reads.append(SplitRead(
            id=split.id,
            expense_id=split.expense_id,
            user_id=split.user_id,
            share_amount=float(round_amount(split.share_amount)),
            username=username,
        ))

    payer_user = await session.get(User, exp.payer_id) if exp.payer_id else None
    added_by_user = await session.get(User, exp.added_by) if exp.added_by else None

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
        wallet_name=wallet_name,
    )


async def update_expense(session: AsyncSession, expense_id: int, payload: ExpenseUpdate, current: User) -> ExpenseRead:
    result = await session.execute(
        select(Expense)
        .options(selectinload(Expense.splits).selectinload(Split.user), selectinload(Expense.group))
        .where(Expense.id == expense_id)
    )
    expense = result.scalars().first()

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    is_payer = expense.payer_id == current.id
    is_group_owner = expense.group and expense.group.owner_id == current.id

    if not is_payer and not is_group_owner:
        raise HTTPException(status_code=403, detail="Not allowed to edit. Only the payer or group owner can edit expenses.")

    original_amount = round_amount(Decimal(str(expense.amount)))
    original_wallet_id = expense.wallet_id

    for field, value in payload.dict(exclude={"splits"}, exclude_unset=True).items():
        setattr(expense, field, value)

    if expense.payer_id == current.id:
        new_amount_decimal = round_amount(Decimal(str(payload.amount))) if payload.amount is not None else original_amount
        new_wallet_id = payload.wallet_id if payload.wallet_id is not None else original_wallet_id

        if original_wallet_id and original_amount > 0:
            await update_wallet_balance(session, original_wallet_id, original_amount, current.id)
        if new_wallet_id and new_amount_decimal > 0:
            await update_wallet_balance(session, new_wallet_id, -new_amount_decimal, current.id)

    if payload.splits is not None:
        await session.execute(delete(Split).where(Split.expense_id == expense_id))
        await session.flush()
        session.add_all([
            Split(expense_id=expense_id, user_id=s.user_id, share_amount=s.share_amount)
            for s in payload.splits
        ])

    await session.commit()

    result = await session.execute(
        select(Expense).options(selectinload(Expense.splits).selectinload(Split.user)).where(Expense.id == expense_id)
    )
    expense = result.scalars().first()

    for split in expense.splits:
        split.username = split.user.username if split.user else None

    return ExpenseRead.model_validate(expense, from_attributes=True)


async def get_expenses_for_group(session: AsyncSession, group_id: int, current_user: User, limit: int = None, offset: int = 0) -> tuple[list[ExpenseRead], int]:
    from sqlalchemy import func

    count_result = await session.execute(select(func.count(Expense.id)).where(Expense.group_id == group_id))
    total_count = count_result.scalar() or 0

    query = (
        select(Expense)
        .where(Expense.group_id == group_id)
        .options(selectinload(Expense.splits).selectinload(Split.user))
        .order_by(Expense.created_at.desc())
    )
    if limit is not None:
        query = query.limit(limit).offset(offset)

    result = await session.execute(query)
    expenses = result.scalars().all()

    # Batch-load all users and wallets referenced by this page of expenses
    user_ids = set()
    wallet_ids = set()
    for exp in expenses:
        if exp.payer_id:
            user_ids.add(exp.payer_id)
        if exp.added_by:
            user_ids.add(exp.added_by)
        if exp.wallet_id:
            wallet_ids.add(exp.wallet_id)

    users_map: dict[int, str] = {}
    if user_ids:
        users_res = await session.execute(select(User.id, User.username).where(User.id.in_(user_ids)))
        users_map = dict(users_res.all())

    wallets_map: dict[int, str] = {}
    if wallet_ids:
        from app.models import Wallet as WalletModel
        wallets_res = await session.execute(
            select(WalletModel.id, WalletModel.name).where(WalletModel.id.in_(wallet_ids))
        )
        wallets_map = dict(wallets_res.all())

    expenses_out = []
    for exp in expenses:
        split_reads = [
            SplitRead(
                id=s.id, expense_id=s.expense_id, user_id=s.user_id,
                share_amount=float(round_amount(s.share_amount)),
                username=s.user.username if s.user else f"User {s.user_id}",
            )
            for s in exp.splits
        ]
        wallet_name = wallets_map.get(exp.wallet_id) if exp.wallet_id else None
        expenses_out.append(ExpenseRead(
            id=exp.id, group_id=exp.group_id, payer_id=exp.payer_id, added_by=exp.added_by,
            description=exp.description, amount=exp.amount, currency=exp.currency,
            category=exp.category, wallet_id=exp.wallet_id, split_type=exp.split_type,
            note=exp.note, photo=exp.photo, created_at=exp.created_at, updated_at=exp.updated_at,
            splits=split_reads,
            payer_username=users_map.get(exp.payer_id, "Unknown") if exp.payer_id else "Unknown",
            added_by_username=users_map.get(exp.added_by, "Unknown") if exp.added_by else "Unknown",
            wallet_name=wallet_name,
        ))

    return expenses_out, total_count
