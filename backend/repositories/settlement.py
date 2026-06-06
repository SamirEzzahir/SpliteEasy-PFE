from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from backend.models import (
    User, Expense, Split, Membership, Settlement, GlobalSettlement,
    Friend, FriendStatus, SettlementStatus,
)


def round_amount(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def get_accepted_friends(session: AsyncSession, user_id: int) -> list[Friend]:
    result = await session.execute(
        select(Friend).where(
            ((Friend.user_id == user_id) | (Friend.friend_id == user_id))
            & (Friend.status == FriendStatus.accepted)
        )
    )
    return result.scalars().all()


async def get_shared_groups(session: AsyncSession, user1_id: int, user2_id: int) -> list[int]:
    user1_groups = await session.execute(select(Membership.group_id).where(Membership.user_id == user1_id))
    user1_group_ids = {row[0] for row in user1_groups.all()}

    user2_groups = await session.execute(select(Membership.group_id).where(Membership.user_id == user2_id))
    user2_group_ids = {row[0] for row in user2_groups.all()}

    return list(user1_group_ids & user2_group_ids)


async def ensure_friendship(session: AsyncSession, user1_id: int, user2_id: int):
    result = await session.execute(
        select(Friend).where(
            ((Friend.user_id == user1_id) & (Friend.friend_id == user2_id))
            | ((Friend.user_id == user2_id) & (Friend.friend_id == user1_id))
        )
    )
    friendship = result.scalars().first()
    if not friendship or friendship.status != FriendStatus.accepted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only settle with accepted friends.")
    return friendship


async def group_member_ids(session: AsyncSession, group_id: int) -> list[int]:
    result = await session.execute(select(Membership.user_id).where(Membership.group_id == group_id))
    return [uid for (uid,) in result.all() if uid is not None]


async def compute_global_settlement_adjustment_for_group(
    session: AsyncSession, group_id: int, user_id: int, friend_id: int
) -> Decimal:
    user_paid_friend_owes = await session.execute(
        select(func.sum(Split.share_amount))
        .join(Expense, Expense.id == Split.expense_id)
        .where((Expense.group_id == group_id) & (Expense.payer_id == user_id) & (Split.user_id == friend_id))
    )
    user_paid_amount = round_amount(user_paid_friend_owes.scalar() or 0)

    friend_paid_user_owes = await session.execute(
        select(func.sum(Split.share_amount))
        .join(Expense, Expense.id == Split.expense_id)
        .where((Expense.group_id == group_id) & (Expense.payer_id == friend_id) & (Split.user_id == user_id))
    )
    friend_paid_amount = round_amount(friend_paid_user_owes.scalar() or 0)

    net_debt_in_group = round_amount(user_paid_amount - friend_paid_amount)

    group_settlement_rows = await session.execute(
        select(Settlement.from_user_id, Settlement.to_user_id, func.sum(Settlement.amount))
        .where(
            (Settlement.group_id == group_id)
            & (
                ((Settlement.from_user_id == user_id) & (Settlement.to_user_id == friend_id))
                | ((Settlement.from_user_id == friend_id) & (Settlement.to_user_id == user_id))
            )
            & (Settlement.status == SettlementStatus.accepted)
        )
        .group_by(Settlement.from_user_id, Settlement.to_user_id)
    )
    for from_id, to_id, amount in group_settlement_rows.all():
        amount_dec = round_amount(amount)
        if from_id == user_id:
            net_debt_in_group += amount_dec
        else:
            net_debt_in_group -= amount_dec

    shared_groups = await get_shared_groups(session, user_id, friend_id)
    total_debt = Decimal("0.00")

    for gid in shared_groups:
        g_user_paid = await session.execute(
            select(func.sum(Split.share_amount))
            .join(Expense, Expense.id == Split.expense_id)
            .where((Expense.group_id == gid) & (Expense.payer_id == user_id) & (Split.user_id == friend_id))
        )
        g_friend_paid = await session.execute(
            select(func.sum(Split.share_amount))
            .join(Expense, Expense.id == Split.expense_id)
            .where((Expense.group_id == gid) & (Expense.payer_id == friend_id) & (Split.user_id == user_id))
        )
        g_net = round_amount((g_user_paid.scalar() or 0) - (g_friend_paid.scalar() or 0))

        g_settlements = await session.execute(
            select(Settlement.from_user_id, Settlement.to_user_id, func.sum(Settlement.amount))
            .where(
                (Settlement.group_id == gid)
                & (
                    ((Settlement.from_user_id == user_id) & (Settlement.to_user_id == friend_id))
                    | ((Settlement.from_user_id == friend_id) & (Settlement.to_user_id == user_id))
                )
                & (Settlement.status == SettlementStatus.accepted)
            )
            .group_by(Settlement.from_user_id, Settlement.to_user_id)
        )
        for from_id, to_id, amount in g_settlements.all():
            if from_id == user_id:
                g_net += round_amount(amount)
            else:
                g_net -= round_amount(amount)

        total_debt += abs(g_net)

    if total_debt == Decimal("0.00"):
        return Decimal("0.00")

    global_settlement_rows = await session.execute(
        select(GlobalSettlement.from_user_id, GlobalSettlement.to_user_id, func.sum(GlobalSettlement.amount))
        .where(
            (
                ((GlobalSettlement.from_user_id == user_id) & (GlobalSettlement.to_user_id == friend_id))
                | ((GlobalSettlement.from_user_id == friend_id) & (GlobalSettlement.to_user_id == user_id))
            )
            & (GlobalSettlement.status == SettlementStatus.accepted)
        )
        .group_by(GlobalSettlement.from_user_id, GlobalSettlement.to_user_id)
    )
    total_global_settlement = sum(round_amount(a) for _, _, a in global_settlement_rows.all())

    if total_debt == Decimal("0.00") or abs(net_debt_in_group) == Decimal("0.00"):
        return Decimal("0.00")

    group_proportion = abs(net_debt_in_group) / total_debt if total_debt > 0 else Decimal("0.00")

    global_settlement_rows = await session.execute(
        select(GlobalSettlement.from_user_id, GlobalSettlement.to_user_id, func.sum(GlobalSettlement.amount))
        .where(
            (
                ((GlobalSettlement.from_user_id == user_id) & (GlobalSettlement.to_user_id == friend_id))
                | ((GlobalSettlement.from_user_id == friend_id) & (GlobalSettlement.to_user_id == user_id))
            )
            & (GlobalSettlement.status == SettlementStatus.accepted)
        )
        .group_by(GlobalSettlement.from_user_id, GlobalSettlement.to_user_id)
    )
    net_global_settlement = Decimal("0.00")
    for from_id, to_id, amount in global_settlement_rows.all():
        amount_dec = round_amount(amount)
        if from_id == user_id:
            net_global_settlement += amount_dec
        else:
            net_global_settlement -= amount_dec

    base_adjustment = round_amount(abs(net_global_settlement) * group_proportion)

    if (net_debt_in_group < 0 and net_global_settlement > 0) or (net_debt_in_group > 0 and net_global_settlement < 0):
        return base_adjustment if net_debt_in_group < 0 else -base_adjustment
    else:
        return -base_adjustment if net_debt_in_group < 0 else base_adjustment


async def compute_group_balances_with_adjustments(
    session: AsyncSession,
    group_id: int,
    current_user_id: Optional[int] = None,
    mode: Optional[str] = None,
) -> tuple[dict[int, float], dict[int, float], dict[int, float]]:
    payer_rows = await session.execute(
        select(Expense.payer_id, func.sum(Expense.amount)).where(Expense.group_id == group_id).group_by(Expense.payer_id)
    )
    credits: dict[int, Decimal] = {uid: round_amount(total) for uid, total in payer_rows.all() if uid}

    split_rows = await session.execute(
        select(Split.user_id, func.sum(Split.share_amount))
        .join(Expense, Expense.id == Split.expense_id)
        .where(Expense.group_id == group_id)
        .group_by(Split.user_id)
    )
    debits: dict[int, Decimal] = {uid: round_amount(total) for uid, total in split_rows.all() if uid}

    settlement_rows = await session.execute(
        select(Settlement.from_user_id, Settlement.to_user_id, func.sum(Settlement.amount))
        .where((Settlement.group_id == group_id) & (Settlement.status == SettlementStatus.accepted))
        .group_by(Settlement.from_user_id, Settlement.to_user_id)
    )

    users = set(await group_member_ids(session, group_id)) | set(credits.keys()) | set(debits.keys())
    balances: dict[int, Decimal] = {
        uid: round_amount(credits.get(uid, Decimal("0.00")) - debits.get(uid, Decimal("0.00"))) for uid in users
    }

    for from_id, to_id, amount in settlement_rows.all():
        amount_dec = round_amount(amount)
        if from_id in balances:
            balances[from_id] += amount_dec
        if to_id in balances:
            balances[to_id] -= amount_dec

    original_balances = {uid: round_amount(val) for uid, val in balances.items()}
    adjusted_balances = original_balances.copy()
    adjustments: dict[int, Decimal] = {uid: Decimal("0.00") for uid in users}

    if mode in ["auto_adjust", "hybrid"] and current_user_id:
        friends = await get_accepted_friends(session, current_user_id)
        for friend in friends:
            friend_id = friend.friend_id if friend.user_id == current_user_id else friend.user_id
            if current_user_id in users and friend_id in users:
                adjustment = await compute_global_settlement_adjustment_for_group(session, group_id, current_user_id, friend_id)
                if current_user_id in adjusted_balances:
                    adjusted_balances[current_user_id] = round_amount(adjusted_balances[current_user_id] + adjustment)
                    adjustments[current_user_id] = round_amount(adjustments[current_user_id] + adjustment)
                if friend_id in adjusted_balances:
                    adjusted_balances[friend_id] = round_amount(adjusted_balances[friend_id] - adjustment)
                    adjustments[friend_id] = round_amount(adjustments[friend_id] - adjustment)

    for uid in users:
        for d in (original_balances, adjusted_balances, adjustments):
            d[uid] = round_amount(d[uid])
            if abs(d[uid]) < Decimal("0.01"):
                d[uid] = Decimal("0.00")

    return (
        {uid: float(val) for uid, val in original_balances.items()},
        {uid: float(val) for uid, val in adjusted_balances.items()},
        {uid: float(val) for uid, val in adjustments.items()},
    )


async def compute_group_balances(
    session: AsyncSession,
    group_id: int,
    current_user_id: Optional[int] = None,
    mode: Optional[str] = None,
) -> dict[int, float]:
    original, adjusted, _ = await compute_group_balances_with_adjustments(session, group_id, current_user_id, mode)
    return adjusted if mode in ["auto_adjust", "hybrid"] else original


async def compute_global_balances(session: AsyncSession, user_id: int) -> dict[int, float]:
    friends = await get_accepted_friends(session, user_id)
    global_balances: dict[int, Decimal] = {}

    for friend in friends:
        friend_id = friend.friend_id if friend.user_id == user_id else friend.user_id
        shared_groups = await get_shared_groups(session, user_id, friend_id)
        if not shared_groups:
            continue

        total_balance = Decimal("0.00")

        for group_id in shared_groups:
            user_paid = await session.execute(
                select(func.sum(Split.share_amount))
                .join(Expense, Expense.id == Split.expense_id)
                .where((Expense.group_id == group_id) & (Expense.payer_id == user_id) & (Split.user_id == friend_id))
            )
            friend_paid = await session.execute(
                select(func.sum(Split.share_amount))
                .join(Expense, Expense.id == Split.expense_id)
                .where((Expense.group_id == group_id) & (Expense.payer_id == friend_id) & (Split.user_id == user_id))
            )
            net_in_group = round_amount((user_paid.scalar() or 0) - (friend_paid.scalar() or 0))

            group_settlements = await session.execute(
                select(Settlement.from_user_id, Settlement.to_user_id, func.sum(Settlement.amount))
                .where(
                    (Settlement.group_id == group_id)
                    & (
                        ((Settlement.from_user_id == user_id) & (Settlement.to_user_id == friend_id))
                        | ((Settlement.from_user_id == friend_id) & (Settlement.to_user_id == user_id))
                    )
                    & (Settlement.status == SettlementStatus.accepted)
                )
                .group_by(Settlement.from_user_id, Settlement.to_user_id)
            )
            for from_id, to_id, amount in group_settlements.all():
                amount_dec = round_amount(amount)
                net_in_group += amount_dec if from_id == user_id else -amount_dec

            total_balance += net_in_group

        global_settlement_rows = await session.execute(
            select(GlobalSettlement.from_user_id, GlobalSettlement.to_user_id, func.sum(GlobalSettlement.amount))
            .where(
                (
                    ((GlobalSettlement.from_user_id == user_id) & (GlobalSettlement.to_user_id == friend_id))
                    | ((GlobalSettlement.from_user_id == friend_id) & (GlobalSettlement.to_user_id == user_id))
                )
                & (GlobalSettlement.status == SettlementStatus.accepted)
            )
            .group_by(GlobalSettlement.from_user_id, GlobalSettlement.to_user_id)
        )
        for from_id, to_id, amount in global_settlement_rows.all():
            amount_dec = round_amount(amount)
            total_balance += amount_dec if from_id == user_id else -amount_dec

        global_balances[friend_id] = round_amount(total_balance)

    return {fid: float(bal) for fid, bal in global_balances.items() if abs(bal) >= Decimal("0.01")}
