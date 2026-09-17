"""Verify split methods and shares survive database saves and reads."""
from datetime import datetime
from unittest.mock import AsyncMock

import pytest

from app.models import Group, Membership
from app.repositories.expense import add_expense, get_expense_ById, get_expenses_for_group, update_expense
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from test_personal_groups import run_with_database


@pytest.mark.parametrize("method,shares", [("percentage", (70, 30)), ("share", (80, 20)), ("share", (0, 100))])
def test_saved_split_roundtrip(method, shares, monkeypatch):
    # SQLite has no PostgreSQL advisory locks; these tests exercise persistence.
    monkeypatch.setattr("app.services.money.lock_owner", AsyncMock())
    async def check(session, owner, friend):
        group = Group(title="Split test", currency="MAD", owner_id=owner.id)
        session.add(group)
        await session.flush()
        session.add_all([Membership(group_id=group.id, user_id=person.id) for person in (owner, friend)])
        await session.commit()
        rows = [(owner.id, shares[0]), (friend.id, shares[1])]
        payload = ExpenseCreate(group_id=group.id, payer_id=owner.id, description="Dinner", amount=100,
            split_type=method, created_at=datetime(2026, 9, 17, 10),
            splits=[{"user_id": uid, "share_amount": amount} for uid, amount in rows])
        created = await add_expense(session, payload, rows, owner.id)
        session.expire_all()
        await session.refresh(owner)
        detail = await get_expense_ById(session, created.id, owner)
        listed, count = await get_expenses_for_group(session, created.group_id, owner)
        assert count == 1
        for expense in (created, detail, listed[0]):
            assert expense.split_type == method
            assert {split.user_id: split.share_amount for split in expense.splits} == dict(rows)
        edited = await update_expense(session, created.id, ExpenseUpdate(description="Edited dinner"), owner)
        assert edited.split_type == method
        assert {split.user_id: split.share_amount for split in edited.splits} == dict(rows)
    run_with_database(check)
