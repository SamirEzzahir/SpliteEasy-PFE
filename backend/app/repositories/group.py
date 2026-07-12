from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select, func
from sqlalchemy.orm import selectinload

from app.models import User, Group, Membership, Expense, Settlement, GroupMessage
from app.schemas import GroupCreate, GroupRead, MembershipRead, GroupMessageRead


async def create_group(session: AsyncSession, payload: GroupCreate, current_user: User) -> GroupRead:
    group = Group(
        title=payload.title,
        currency=payload.currency,
        type=payload.type,
        photo=payload.photo,
        owner_id=current_user.id,
    )
    session.add(group)
    await session.flush()

    members = set(payload.member_ids) | {current_user.id}
    existing_users = await session.execute(select(User.id).where(User.id.in_(members)))
    existing_user_ids = {u[0] for u in existing_users.fetchall()}

    invalid_ids = members - existing_user_ids
    if invalid_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid user IDs: {invalid_ids}")

    for uid in existing_user_ids:
        session.add(Membership(user_id=uid, group_id=group.id, is_admin=(uid == current_user.id)))

    await session.commit()
    from app.repositories.activity import log_activity
    await log_activity(session, user_id=current_user.id, action=f"created group '{group.title}'", target_type="group", target_id=group.id)
    await session.refresh(group)
    return GroupRead.model_validate(group)


async def get_group(session: AsyncSession, group_id: int) -> GroupRead:
    group = await session.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return GroupRead.model_validate(group)


async def get_groups(session: AsyncSession, currentuser: User) -> list[GroupRead]:
    from app.repositories.settlement import compute_group_balances

    result = await session.execute(
        select(Group)
        .join(Membership, Membership.group_id == Group.id)
        .where(Membership.user_id == currentuser.id)
        .options(
            selectinload(Group.memberships).selectinload(Membership.user),
            selectinload(Group.owner),
        )
    )
    groups = result.scalars().all()

    # Batch expense counts + totals in two queries instead of N queries
    group_ids = [g.id for g in groups]
    expense_stats_res = await session.execute(
        select(Expense.group_id, func.count(Expense.id), func.coalesce(func.sum(Expense.amount), 0))
        .where(Expense.group_id.in_(group_ids))
        .group_by(Expense.group_id)
    )
    expense_stats: dict[int, tuple[int, float]] = {
        gid: (cnt, float(total)) for gid, cnt, total in expense_stats_res.all()
    }

    output = []
    for group in groups:
        members_usernames = [m.user.username for m in group.memberships]
        owner_username = group.owner.username if group.owner else None
        expenses_count, total_amount = expense_stats.get(group.id, (0, 0.0))
        output.append(
            GroupRead.model_validate({
                **group.__dict__,
                "owner_username": owner_username,
                "members_usernames": members_usernames,
                "expenses_count": expenses_count,
                "total_amount": total_amount,
                "has_unsettled_balance": expenses_count > 0,
            })
        )
    return output


async def get_groups_for_user(session: AsyncSession, user_id: int) -> list[GroupRead]:
    result = await session.execute(
        select(Group).join(Membership, Membership.group_id == Group.id).where(Membership.user_id == user_id)
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


async def delete_group(session: AsyncSession, group_id: int, current: User):
    group = await session.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.owner_id != current.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if group.type == "Personal Expenses" and group.title == "Personal Expenses":
        raise HTTPException(status_code=400, detail="Cannot delete your default Personal Expenses group.")

    await session.delete(group)
    await session.commit()


async def can_leave_group(session: AsyncSession, user_id: int, group_id: int) -> bool:
    result = await session.execute(
        select(Settlement).where(
            ((Settlement.from_user_id == user_id) | (Settlement.to_user_id == user_id))
            & (Settlement.amount != 0)
            & (Settlement.group_id == group_id)
        )
    )
    return len(result.scalars().all()) == 0


async def leave_group(session: AsyncSession, user_id: int, group_id: int):
    if not await can_leave_group(session, user_id, group_id):
        raise HTTPException(status_code=400, detail="Cannot leave group with unsettled balances")

    await session.execute(
        delete(Membership).where(Membership.user_id == user_id, Membership.group_id == group_id)
    )
    await session.commit()
    return True


async def add_group_message(session: AsyncSession, group_id: int, user_id: int, content: str) -> GroupMessageRead:
    msg = GroupMessage(group_id=group_id, user_id=user_id, content=content)
    session.add(msg)
    await session.commit()
    await session.refresh(msg)
    await session.refresh(msg, ["user"])

    return GroupMessageRead(
        id=msg.id,
        group_id=msg.group_id,
        user_id=msg.user_id,
        content=msg.content,
        username=msg.user.username if msg.user else None,
        created_at=msg.created_at,
    )


async def get_group_messages(session: AsyncSession, group_id: int, limit: int = 50) -> list[GroupMessageRead]:
    result = await session.execute(
        select(GroupMessage)
        .where(GroupMessage.group_id == group_id)
        .options(selectinload(GroupMessage.user))
        .order_by(GroupMessage.created_at.desc())
        .limit(limit)
    )
    messages = result.scalars().all()

    output = [
        GroupMessageRead(
            id=msg.id,
            group_id=msg.group_id,
            user_id=msg.user_id,
            content=msg.content,
            username=msg.user.username if msg.user else None,
            created_at=msg.created_at,
        )
        for msg in messages
    ]
    return output[::-1]


async def get_group_members(session: AsyncSession, group_id: int) -> list[MembershipRead]:
    result = await session.execute(
        select(Membership).options(selectinload(Membership.user)).where(Membership.group_id == group_id)
    )
    memberships = result.scalars().all()

    def _full_name(u):
        if not u:
            return None
        parts = [p for p in [u.first_name, u.last_name] if p]
        return " ".join(parts) if parts else None

    return [
        MembershipRead.model_validate({
            "id": m.id,
            "user_id": m.user_id,
            "group_id": m.group_id,
            "is_admin": m.is_admin,
            "username": m.user.username if m.user else None,
            "email": m.user.email if m.user else None,
            "full_name": _full_name(m.user),
        })
        for m in memberships
    ]


async def add_members_to_group(session: AsyncSession, group_id: int, user_ids: list[int], is_admin: bool = False) -> list[Membership]:
    memberships = []
    for uid in user_ids:
        res = await session.execute(
            select(Membership).where(Membership.group_id == group_id, Membership.user_id == uid)
        )
        if res.scalar_one_or_none():
            continue
        m = Membership(user_id=uid, group_id=group_id, is_admin=is_admin)
        session.add(m)
        memberships.append(m)

    await session.commit()
    for m in memberships:
        await session.refresh(m)
    return memberships


async def update_membership(session: AsyncSession, group_id: int, member_id: int, is_admin: bool) -> Membership:
    res = await session.execute(
        select(Membership).where(Membership.group_id == group_id, Membership.user_id == member_id)
    )
    membership = res.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    group_res = await session.execute(select(Group).where(Group.id == group_id))
    group = group_res.scalar_one()

    if member_id == group.owner_id and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot remove admin rights from the group creator.")

    membership.is_admin = is_admin
    await session.commit()
    await session.refresh(membership)
    return membership


async def remove_member(session: AsyncSession, group_id: int, member_id: int):
    res = await session.execute(
        select(Membership).where(Membership.group_id == group_id, Membership.user_id == member_id)
    )
    membership = res.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    group_res = await session.execute(select(Group).where(Group.id == group_id))
    group = group_res.scalar_one()

    if membership.is_admin or member_id == group.owner_id:
        raise HTTPException(status_code=403, detail="You cannot remove an admin or the group creator from the group.")

    await session.delete(membership)
    await session.commit()


async def group_member_ids(session: AsyncSession, group_id: int) -> list[int]:
    result = await session.execute(select(Membership.user_id).where(Membership.group_id == group_id))
    return [uid for (uid,) in result.all() if uid is not None]


async def ensure_user_in_group(session: AsyncSession, user_id: int, group_id: int):
    result = await session.execute(
        select(Membership).where(Membership.group_id == group_id, Membership.user_id == user_id)
    )
    member = result.scalars().first()
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this group.")
    return member


async def ensure_user_is_admin(session: AsyncSession, user_id: int, group_id: int):
    result = await session.execute(
        select(Membership).where(Membership.group_id == group_id, Membership.user_id == user_id)
    )
    member = result.scalars().first()
    if not member or not member.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You must be an admin of this group.")
