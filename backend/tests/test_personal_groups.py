"""Group regressions against disposable, in-memory SQLite databases only."""
import asyncio
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, delete, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.personal_group_migration import migrate_default_personal_groups
from app.models import Base, Friend, FriendStatus, Group, Membership, User
from app.repositories import group as repo
from app.routers.groups import join_group_info, join_group_via_link
from app.routers.settle import record_settlement
from app.schemas import GroupCreate, SettlementCreate


def run_with_database(check):
    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                owner = User(
                    username="owner", email="owner@example.com", password_hash="unused",
                    preferred_currency="MAD",
                )
                friend = User(username="friend", email="friend@example.com", password_hash="unused")
                session.add_all([owner, friend])
                await session.commit()
                await check(session, owner, friend)
        finally:
            await engine.dispose()
    asyncio.run(run())


def test_default_identity_survives_rename_and_repairs_missing_membership():
    async def check(session, owner, friend):
        group = await repo.ensure_default_personal_group(session, owner)
        assert group.currency == "MAD"
        first_id = group.id
        await repo.update_group(session, first_id, {
            "title": "My private spending", "type": "Other",
            "is_default_personal": False, "owner_id": friend.id,
        })
        await session.execute(delete(Membership).where(Membership.group_id == first_id))
        await session.commit()
        for _ in range(3):
            same = await repo.ensure_default_personal_group(session, owner)
            assert same.id == first_id
        assert same.owner_id == owner.id
        assert same.is_default_personal
        assert await session.scalar(select(func.count()).select_from(Group)) == 1
        membership = await session.scalar(select(Membership).where(Membership.group_id == first_id))
        assert membership.user_id == owner.id
        assert membership.is_admin
    run_with_database(check)


def test_database_rejects_second_default_but_allows_multiple_custom_personal_groups():
    async def check(session, owner, friend):
        await repo.ensure_default_personal_group(session, owner)
        for _ in range(2):
            custom = await repo.create_group(session, GroupCreate(
                title="Personal Expenses", type="Personal", currency="MAD"
            ), owner)
            assert not custom.is_default_personal
        session.add(Group(title="Duplicate", owner_id=owner.id, is_default_personal=True))
        with pytest.raises(IntegrityError):
            await session.flush()
        await session.rollback()
    run_with_database(check)


def test_default_blocks_delete_leave_member_changes_join_and_settlement():
    async def check(session, owner, friend):
        group = await repo.ensure_default_personal_group(session, owner)
        assert not await repo.can_leave_group(session, owner.id, group.id)
        operations = [
            lambda: repo.delete_group(session, group.id, owner),
            lambda: repo.leave_group(session, owner.id, group.id),
            lambda: repo.add_members_to_group(session, group.id, [friend.id]),
            lambda: repo.update_membership(session, group.id, owner.id, False),
            lambda: repo.remove_member(session, group.id, owner.id),
            lambda: join_group_info(group.id, session, friend),
            lambda: join_group_via_link(group.id, session, friend),
            lambda: record_settlement(group.id, SettlementCreate(
                to_user_id=friend.id, amount=1
            ), session, owner),
        ]
        for operation in operations:
            with pytest.raises(HTTPException) as error:
                await operation()
            assert error.value.status_code == 400
        assert await session.scalar(select(func.count()).select_from(Membership)) == 1
        assert await session.get(Group, group.id) is not None
    run_with_database(check)


def test_custom_personal_group_can_add_members_and_be_deleted():
    async def check(session, owner, friend):
        custom = await repo.create_group(session, GroupCreate(
            title="Personal Expenses", type="Personal Expenses", currency="MAD"
        ), owner)
        memberships = await repo.add_members_to_group(session, custom.id, [friend.id])
        assert memberships[0].user_id == friend.id
        assert await repo.can_leave_group(session, friend.id, custom.id)
        await repo.leave_group(session, friend.id, custom.id)
        await repo.delete_group(session, custom.id, owner)
        assert await session.get(Group, custom.id) is None
    run_with_database(check)


@pytest.mark.parametrize("reverse", [False, True])
def test_create_group_accepts_uuid_members_for_accepted_friends_in_both_directions(reverse):
    async def check(session, owner, friend):
        session.add(Friend(
            user_id=friend.id if reverse else owner.id,
            friend_id=owner.id if reverse else friend.id,
            status=FriendStatus.accepted,
        ))
        await session.commit()
        group = await repo.create_group(session, GroupCreate.model_validate({
            "title": "Trip", "member_ids": [str(friend.id), str(friend.id), str(owner.id)]
        }), owner)
        ids = set((await session.scalars(select(Membership.user_id).where(
            Membership.group_id == group.id
        ))).all())
        assert ids == {owner.id, friend.id}
    run_with_database(check)


@pytest.mark.parametrize("friend_status", [None, FriendStatus.pending, FriendStatus.rejected])
def test_create_group_rejects_nonfriends_before_creating_any_group(friend_status):
    async def check(session, owner, friend):
        if friend_status is not None:
            session.add(Friend(user_id=owner.id, friend_id=friend.id, status=friend_status))
            await session.commit()
        with pytest.raises(HTTPException) as error:
            await repo.create_group(session, GroupCreate(
                title="Not allowed", member_ids=[friend.id]
            ), owner)
        assert error.value.status_code == 400
        assert "accepted friends" in error.value.detail
        assert await session.scalar(select(func.count()).select_from(Group)) == 0
    run_with_database(check)


def test_legacy_migration_adopts_oldest_private_group_without_losing_duplicates_or_history():
    engine = create_engine("sqlite:///:memory:")
    try:
        with engine.begin() as connection:
            for statement in (
                "CREATE TABLE groups (id TEXT PRIMARY KEY, owner_id TEXT, title TEXT, type TEXT, created_at TIMESTAMP)",
                "CREATE TABLE memberships (group_id TEXT, user_id TEXT)",
                "CREATE TABLE expenses (id TEXT, group_id TEXT, payer_id TEXT, added_by TEXT, amount NUMERIC)",
                "CREATE TABLE splits (expense_id TEXT, user_id TEXT)",
                "CREATE TABLE settlements (group_id TEXT)",
                "CREATE TABLE group_messages (group_id TEXT, user_id TEXT)",
            ):
                connection.execute(text(statement))
            now = datetime.now()
            rows = [
                ("old", "owner", now - timedelta(hours=21)),
                ("duplicate", "owner", now - timedelta(hours=3)),
                ("shared", "other", now),
                ("historically_shared", "third", now),
            ]
            for group_id, owner_id, created_at in rows:
                connection.execute(text(
                    "INSERT INTO groups VALUES (:id, :owner, 'Personal Expenses', 'Personal', :created)"
                ), {"id": group_id, "owner": owner_id, "created": created_at})
                connection.execute(text("INSERT INTO memberships VALUES (:id, :owner)"), {
                    "id": group_id, "owner": owner_id,
                })
            connection.execute(text("INSERT INTO memberships VALUES ('shared', 'friend')"))
            connection.execute(text("INSERT INTO expenses VALUES ('spent', 'duplicate', 'owner', 'owner', 42.13)"))
            connection.execute(text("INSERT INTO expenses VALUES ('shared_spent', 'historically_shared', 'third', 'third', 5)"))
            connection.execute(text("INSERT INTO splits VALUES ('shared_spent', 'former_member')"))
            before_expenses = connection.execute(text("SELECT * FROM expenses")).all()
            for _ in range(2):
                migrate_default_personal_groups(connection)
            groups = dict(connection.execute(text("SELECT id, is_default_personal FROM groups")).all())
            assert groups == {"old": 1, "duplicate": 0, "shared": 0, "historically_shared": 0}
            assert connection.execute(text("SELECT * FROM expenses")).all() == before_expenses
            with pytest.raises(IntegrityError):
                connection.execute(text("UPDATE groups SET is_default_personal = TRUE WHERE id = 'duplicate'"))
    finally:
        engine.dispose()
