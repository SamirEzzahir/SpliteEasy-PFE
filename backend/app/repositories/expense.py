from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload
from app.models import User, Group, Membership, Expense, Split, Wallet, ActivityLog
from app.schemas import ExpenseRead, SplitRead
from app.services import money


def round_amount(value):
    return money.amount(value or 0)


def to_naive_utc(dt):
    return money.utc(dt)


async def update_wallet_balance(session, wallet_id, amount_change, user_id):
    """Compatibility helper: journaled, locked, and never independently committed."""
    await money.lock_owner(session, user_id)
    wallet = await money.get_wallet(session, user_id, wallet_id)
    await money.post_event(session, user_id, "adjustment", "Wallet correction", wallet.currency,
                           [(wallet_id, amount_change)])
    return wallet


async def validate_members(session, group_id, current_id, payer_id, splits, total):
    group = await session.scalar(select(Group).where(Group.id == group_id).with_for_update()) if group_id else None
    if not group:
        raise HTTPException(404, "Group not found. Use My Money for personal spending.")
    members = set((await session.scalars(select(Membership.user_id).where(Membership.group_id == group_id))).all())
    if current_id not in members and current_id != group.owner_id:
        raise HTTPException(403, "You are not a member of this group")
    if payer_id not in members:
        raise HTTPException(422, "The payer must belong to the group")
    ids = [uid for uid, _ in splits]
    if not ids or len(ids) != len(set(ids)) or not set(ids).issubset(members):
        raise HTTPException(422, "Choose distinct participants from this group")
    rows = [(uid, round_amount(value)) for uid, value in splits]
    if total <= 0 or any(value < 0 for _, value in rows):
        raise HTTPException(422, "Enter a positive total and nonnegative shares")
    diff = total - sum((value for _, value in rows), money.ZERO)
    if abs(diff) > Decimal("0.01") * len(rows):
        raise HTTPException(422, "The expense shares must match the total")
    rows[0] = (rows[0][0], rows[0][1] + diff)
    if rows[0][1] < 0:
        raise HTTPException(422, "The expense shares must match the total")
    return group, rows


async def record_expense_money(session, expense, rows, actor, *, key=None, request=None):
    if expense.wallet_id and expense.payer_id != actor:
        raise HTTPException(403, "Only the payer can choose their private payment wallet")
    if expense.is_from_jar and expense.payer_id != actor:
        raise HTTPException(403, "Only the payer can choose their private budget")
    if expense.wallet_id or expense.is_from_jar:
        share = next((value for uid, value in rows if uid == actor), money.ZERO)
        event = await money.post_event(session, actor, "shared_expense", expense.description, expense.currency,
            [(expense.wallet_id, -round_amount(expense.amount))] if expense.wallet_id else [],
            event_amount=expense.amount, personal_share=share, occurred_at=expense.created_at,
            source_type="expense", source_id=expense.id, key=key, request=request)
        if expense.is_from_jar and expense.jar_type:
            await money.add_budget_entry(session, event, expense.jar_type, -share, "spending")


async def add_expense(session, expense_data, splits, current_user_id):
    await money.lock_owner(session, current_user_id)
    existing = await money.retry_event(session, current_user_id, expense_data.idempotency_key, expense_data)
    if existing:
        return await get_expense_ById(session, existing.source_id, await session.get(User, current_user_id))
    total = round_amount(expense_data.amount)
    payer_id = expense_data.payer_id or current_user_id
    group, rows = await validate_members(session, expense_data.group_id, current_user_id, payer_id, splits, total)
    created = to_naive_utc(expense_data.created_at)
    expense = Expense(group_id=group.id, payer_id=payer_id, added_by=current_user_id,
        description=expense_data.description.strip(), amount=total, currency=group.currency or "MAD",
        category=expense_data.category, wallet_id=expense_data.wallet_id, split_type=expense_data.split_type,
        jar_type=expense_data.jar_type, is_from_jar=expense_data.is_from_jar, note=expense_data.note,
        photo=expense_data.photo, created_at=created, updated_at=created)
    session.add(expense)
    await session.flush()
    session.add_all([Split(expense_id=expense.id, user_id=uid, share_amount=value) for uid, value in rows])
    await record_expense_money(session, expense, rows, current_user_id, key=expense_data.idempotency_key, request=expense_data)
    session.add(ActivityLog(user_id=current_user_id, action=f"added expense '{expense.description[:150]}'", target_type="expense", target_id=expense.id))
    await session.commit()
    user = await session.get(User, current_user_id)
    return await get_expense_ById(session, expense.id, user)


def expense_read(expense, current_id):
    own = expense.payer_id == current_id
    return ExpenseRead(id=expense.id, group_id=expense.group_id, payer_id=expense.payer_id,
        added_by=expense.added_by, description=expense.description, amount=expense.amount,
        currency=expense.currency, category=expense.category, wallet_id=expense.wallet_id if own else None,
        wallet_name=expense.wallet.name if own and expense.wallet else None,
        jar_type=expense.jar_type if own else None, is_from_jar=expense.is_from_jar if own else False,
        split_type=expense.split_type, note=expense.note, photo=expense.photo,
        created_at=expense.created_at, updated_at=expense.updated_at, group_name=expense.group.title,
        payer_username=expense.payer.username if expense.payer else "Unknown",
        payer_name=expense.payer.username if expense.payer else "Unknown",
        added_by_username=expense.added_by_user.username if expense.added_by_user else "Unknown",
        splits=[SplitRead(id=row.id, expense_id=expense.id, user_id=row.user_id,
                         share_amount=row.share_amount, username=row.user.username if row.user else "Unknown")
                for row in expense.splits])


def expense_query():
    return select(Expense).options(selectinload(Expense.splits).selectinload(Split.user), selectinload(Expense.group),
        selectinload(Expense.payer), selectinload(Expense.added_by_user), selectinload(Expense.wallet))


async def get_expense_ById(session, expense_id, current_user):
    expense = await session.scalar(expense_query().where(Expense.id == expense_id).execution_options(populate_existing=True))
    if not expense:
        raise HTTPException(404, "Expense not found")
    member = await session.scalar(select(Membership.id).where(Membership.group_id == expense.group_id, Membership.user_id == current_user.id))
    if not member and expense.group.owner_id != current_user.id:
        raise HTTPException(403, "You are not a member of this group")
    return expense_read(expense, current_user.id)


async def update_expense(session, expense_id, payload, current):
    await money.lock_owner(session, current.id)
    expense = await session.scalar(expense_query().where(Expense.id == expense_id).with_for_update())
    if not expense:
        raise HTTPException(404, "Expense not found")
    if current.id not in (expense.payer_id, expense.added_by, expense.group.owner_id):
        raise HTTPException(403, "Only the creator, payer, or group owner can edit this expense")
    fields = payload.model_dump(exclude_unset=True)
    if any(key in fields and fields[key] is None for key in ("description", "created_at", "currency", "payer_id")):
        raise HTTPException(422, "Description, date, currency and payer cannot be empty")
    old_rows = [(row.user_id, round_amount(row.share_amount)) for row in expense.splits]
    rows = [(s.user_id, s.share_amount) for s in payload.splits] if payload.splits is not None else old_rows
    total = round_amount(payload.amount if payload.amount is not None else expense.amount)
    payer = payload.payer_id if payload.payer_id is not None else expense.payer_id
    _, rows = await validate_members(session, expense.group_id, current.id, payer, rows, total)
    private_fields = ("currency", "payer_id", "wallet_id", "jar_type", "is_from_jar")
    changed_money = total != round_amount(expense.amount) or any(key in fields and fields[key] != getattr(expense, key) for key in private_fields) or dict(rows) != dict(old_rows)
    linked = expense.wallet_id or expense.is_from_jar
    if linked and expense.payer_id != current.id and changed_money:
        raise HTTPException(409, "wallet_confirmation_required: The payer must update this wallet-linked expense.")
    if fields.get("currency") and fields["currency"] != expense.currency:
        raise HTTPException(422, "Use the group's currency")
    if changed_money and linked:
        event = await money.active_source_event(session, expense.payer_id, "expense", expense.id)
        if event:
            await money.reverse_event(session, expense.payer_id, event.id, internal=True)
        elif expense.wallet_id:  # Old linked expense predating the journal cutover.
            await money.post_event(session, expense.payer_id, "reversal", "Previous expense payment refunded",
                expense.currency, [(expense.wallet_id, round_amount(expense.amount))],
                source_type="expense", source_id=expense.id, allow_archived=True)
    for field, value in fields.items():
        if field == "splits":
            continue
        if field == "created_at":
            value = to_naive_utc(value)
        setattr(expense, field, value)
    expense.amount, expense.payer_id = total, payer
    expense.updated_at = datetime.utcnow()
    if changed_money:
        # Clearing wallet_id is an explicit unlink and reverses the old payment.
        await record_expense_money(session, expense, rows, current.id)
    if payload.splits is not None:
        await session.execute(delete(Split).where(Split.expense_id == expense_id))
        session.add_all([Split(expense_id=expense_id, user_id=uid, share_amount=value) for uid, value in rows])
    await session.commit()
    return await get_expense_ById(session, expense_id, current)


async def delete_expense_record(session, expense_id, current):
    await money.lock_owner(session, current.id)
    expense = await session.scalar(expense_query().where(Expense.id == expense_id).with_for_update())
    if not expense:
        raise HTTPException(404, "Expense not found")
    if current.id not in (expense.payer_id, expense.group.owner_id):
        raise HTTPException(403, "Only the payer or group owner can delete this expense")
    if (expense.wallet_id or expense.is_from_jar) and expense.payer_id != current.id:
        raise HTTPException(409, "wallet_confirmation_required: The payer must remove this wallet-linked expense.")
    event = await money.active_source_event(session, expense.payer_id, "expense", expense.id)
    if event:
        await money.reverse_event(session, expense.payer_id, event.id, internal=True)
    elif expense.wallet_id:
        await money.post_event(session, expense.payer_id, "reversal", "Previous expense payment refunded",
            expense.currency, [(expense.wallet_id, round_amount(expense.amount))],
            source_type="expense", source_id=expense.id, allow_archived=True)
    session.add(ActivityLog(user_id=current.id, action=f"deleted expense '{expense.description[:150]}'", target_type="expense", target_id=expense.id))
    await session.delete(expense)
    await session.commit()


async def get_expenses_for_group(session, group_id, current_user, limit=None, offset=0):
    total = await session.scalar(select(func.count(Expense.id)).where(Expense.group_id == group_id))
    query = expense_query().where(Expense.group_id == group_id).order_by(Expense.created_at.desc())
    if limit is not None:
        query = query.limit(limit).offset(offset)
    return [expense_read(expense, current_user.id) for expense in (await session.scalars(query)).all()], total
