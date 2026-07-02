"""Demo dataset seeder for SplitEasy.

Creates a realistic, fully-populated demo account so anyone can log in with
``demo`` / ``demo`` and immediately explore every feature — friends, groups,
expenses (all split types), settlements, balances, notifications and activity —
as if a group of Moroccan friends had been using the app for months.

Run manually:

    python -m backend.seed_demo          # seed (no-op if already seeded)
    python -m backend.seed_demo --force  # wipe demo data and reseed

Or enable at backend startup with the env var ``SEED_DEMO=1`` (see main.py).

Idempotent: re-running without ``--force`` does nothing once the ``demo`` user
exists. ``--force`` deletes all demo users first; every dependent row (groups,
memberships, expenses, splits, settlements, friends, notifications, activity)
is removed via ON DELETE CASCADE, then everything is regenerated.

Kept out of production unless explicitly enabled — never wired into the normal
migration path.
"""

from __future__ import annotations

import argparse
import asyncio
import random
from datetime import datetime, timedelta

from sqlalchemy import select, delete

from backend.core.db import async_session
from backend.core.security import hash_password
from backend.models import (
    User, Role, Group, Membership, Expense, Split,
    Settlement, SettlementStatus, Friend, FriendStatus,
    Notification, ActivityLog, GroupMessage,
)

# Deterministic output so repeated --force runs produce the same demo.
RNG = random.Random(42)

CURRENCY = "MAD"

# Timeline: the "past 6 months" relative to the app's demo clock.
NOW = datetime(2026, 6, 30, 20, 0, 0)
START = datetime(2026, 1, 5, 9, 0, 0)


def rand_dt(after: datetime = START, before: datetime = NOW) -> datetime:
    """A random timestamp in [after, before] with a plausible hour."""
    span = int((before - after).total_seconds())
    base = after + timedelta(seconds=RNG.randint(0, max(span, 1)))
    return base.replace(hour=RNG.randint(8, 22), minute=RNG.choice([0, 5, 15, 30, 45]))


# ── people ──────────────────────────────────────────────────────────────────
# (username, full name, gender). The first entry (demo) is "you".
PEOPLE = [
    ("Samir",    "Samir El Amrani",  "male"),
    ("yassine", "Yassine Benali",   "male"),
    ("ayoub",   "Ayoub El Idrissi", "male"),
    ("zakaria", "Zakaria Chraibi",  "male"),
    ("othmane", "Othmane Bennis",   "male"),
    ("hamza",   "Hamza El Fassi",   "male"),
    ("imane",   "Imane El Alaoui",  "female"),
    ("sara",    "Sara Bennani",     "female"),
    ("salma",   "Salma Idrissi",    "female"),
    ("yasmine", "Yasmine Chouki",   "female"),
]
DEMO_USERNAMES = [p[0] for p in PEOPLE]

# ── groups ──────────────────────────────────────────────────────────────────
GROUPS = [
    {
        "title": "Weekend Trip to Chefchaouen", "type": "Trip",
        "desc": "Blue city getaway 💙", "members": ["demo", "yassine", "ayoub", "imane"],
        "count": 16,
        "templates": [
            ("Riad booking", "Accommodation", 900, 1600),
            ("Dinner at the medina", "Food", 180, 420),
            ("Breakfast", "Food", 90, 180),
            ("Grand taxi", "Transport", 200, 400),
            ("Fuel", "Transport", 300, 640),
            ("Souvenirs", "Shopping", 120, 380),
            ("Mint tea & coffee", "Coffee", 40, 120),
            ("Guided hike", "Entertainment", 150, 350),
            ("Lunch", "Food", 140, 300),
            ("Parking", "Transport", 30, 80),
        ],
    },
    {
        "title": "Apartment", "type": "Home",
        "desc": "Shared flat in Casablanca 🏠", "members": ["demo", "hamza", "salma"],
        "count": 18,
        "templates": [
            ("Monthly rent", "Housing", 4500, 4500),
            ("Internet bill", "Utilities", 299, 299),
            ("Electricity", "Utilities", 180, 420),
            ("Water", "Utilities", 90, 200),
            ("Groceries", "Shopping", 250, 650),
            ("Cleaning supplies", "Shopping", 60, 180),
            ("Gas bottle", "Utilities", 40, 120),
        ],
    },
    {
        "title": "Football Team", "type": "Sports",
        "desc": "Sunday 5-a-side ⚽", "members": ["demo", "ayoub", "zakaria", "hamza", "othmane"],
        "count": 14,
        "templates": [
            ("Football pitch rental", "Sports", 300, 500),
            ("Drinks after match", "Food", 80, 200),
            ("Pizza after match", "Food", 220, 420),
            ("New ball & bibs", "Sports", 150, 350),
            ("Goalkeeper gloves", "Sports", 90, 180),
            ("Water bottles", "Food", 30, 70),
        ],
    },
    {
        "title": "Family", "type": "Family",
        "desc": "Family expenses 👨‍👩‍👧", "members": ["demo", "sara", "salma"],
        "count": 10,
        "templates": [
            ("Family dinner", "Food", 240, 560),
            ("Shopping", "Shopping", 300, 900),
            ("Taxi", "Transport", 40, 120),
            ("Pharmacy", "Health", 80, 260),
            ("Gift", "Gifts", 150, 500),
        ],
    },
    {
        "title": "Road Trip to Marrakech", "type": "Trip",
        "desc": "3 days in the red city 🌴", "members": ["demo", "imane", "yassine", "othmane", "hamza"],
        "count": 20,
        "templates": [
            ("Fuel", "Transport", 400, 700),
            ("Hotel", "Accommodation", 1400, 2600),
            ("Breakfast", "Food", 120, 260),
            ("Lunch", "Food", 180, 420),
            ("Museum tickets", "Entertainment", 100, 260),
            ("Parking", "Transport", 30, 90),
            ("Coffee", "Coffee", 40, 110),
            ("Souvenirs", "Shopping", 150, 500),
            ("Jemaa el-Fna dinner", "Food", 200, 480),
            ("Airport taxi", "Transport", 120, 260),
        ],
    },
]

SPLIT_WEIGHTS = (["equal"] * 6) + (["percentage"] * 2) + (["share"] * 2)


def round2(x: float) -> float:
    return float(round(x + 1e-9, 2))


def make_shares(amount: float, participant_ids: list[int], split_type: str) -> list[tuple[int, float]]:
    """Return [(user_id, share_amount)] that sum exactly to ``amount``."""
    n = len(participant_ids)
    if split_type == "percentage":
        # Random-ish weights turned into percentages.
        weights = [RNG.uniform(0.6, 1.6) for _ in range(n)]
    elif split_type == "share":
        weights = [float(RNG.randint(1, 4)) for _ in range(n)]
    else:  # equal
        weights = [1.0] * n
    total_w = sum(weights)
    shares = [round2(amount * w / total_w) for w in weights]
    # Fix rounding drift so the split sums exactly to the expense amount.
    drift = round2(amount - sum(shares))
    shares[0] = round2(shares[0] + drift)
    return list(zip(participant_ids, shares))


async def _get_or_create_role(session) -> Role:
    """The default 'User' role. On a fresh DB the migrations only seed the admin
    roles, so create 'User' here if it's missing."""
    role = (await session.execute(select(Role).where(Role.name == "User"))).scalar_one_or_none()
    if role is None:
        role = Role(name="User", permissions="[]")
        session.add(role)
        await session.flush()
    return role


async def seed_demo(force: bool = False) -> None:
    async with async_session() as session:
        existing = (await session.execute(
            select(User).where(User.username == "demo")
        )).scalar_one_or_none()

        if existing and not force:
            print("ℹ️  Demo already seeded (user 'demo' exists). Use --force to reseed.")
            return

        if force:
            print("🧹 Removing existing demo data...")
            await session.execute(delete(User).where(User.username.in_(DEMO_USERNAMES)))
            await session.commit()

        role = await _get_or_create_role(session)

        # ── users ────────────────────────────────────────────────────────────
        users: dict[str, User] = {}
        for i, (username, full_name, gender) in enumerate(PEOPLE):
            first, _, last = full_name.partition(" ")
            joined = START + timedelta(days=RNG.randint(0, 20) + i * 3)
            u = User(
                username=username,
                email=f"{username}@spliteasy.com",
                password_hash=hash_password("demo" if username == "demo" else username),
                first_name=first,
                last_name=last,
                phone=f"+2126{RNG.randint(10000000, 99999999)}",
                profile_photo=f"https://i.pravatar.cc/150?u={username}",
                gender=gender,
                is_active=True,
                status="active",
                email_verified=True,
                preferred_currency=CURRENCY,
                onboarding_completed=True,
                role_id=role.id if role else None,
                created_at=joined,
                updated_at=joined,
            )
            session.add(u)
            users[username] = u
        await session.flush()  # assign ids
        demo = users["demo"]
        print(f"✅ Created {len(users)} demo users.")

        # ── friendships (every state) ────────────────────────────────────────
        def add_friend(a: str, b: str, status: FriendStatus, when: datetime):
            session.add(Friend(user_id=users[a].id, friend_id=users[b].id,
                               status=status, created_at=when))

        for name in ["yassine", "ayoub", "imane", "sara", "hamza", "salma"]:
            add_friend("demo", name, FriendStatus.accepted, rand_dt(START, NOW - timedelta(days=30)))
        add_friend("demo", "zakaria", FriendStatus.pending, rand_dt(NOW - timedelta(days=6)))   # sent, pending
        add_friend("yasmine", "demo", FriendStatus.pending, rand_dt(NOW - timedelta(days=3)))   # received
        add_friend("othmane", "demo", FriendStatus.rejected, rand_dt(NOW - timedelta(days=40))) # rejected
        # A few friendships between the others so the graph feels real.
        add_friend("hamza", "ayoub", FriendStatus.accepted, rand_dt())
        add_friend("imane", "yassine", FriendStatus.accepted, rand_dt())
        add_friend("sara", "salma", FriendStatus.accepted, rand_dt())
        print("✅ Created friendships (accepted / pending sent / received / rejected).")

        # ── groups + memberships ─────────────────────────────────────────────
        group_objs: list[tuple[Group, list[str], list[dict]]] = []
        for cfg in GROUPS:
            created = rand_dt(START, NOW - timedelta(days=45))
            g = Group(
                title=cfg["title"], description=cfg["desc"], type=cfg["type"],
                currency=CURRENCY, owner_id=demo.id,
                photo=None, created_at=created, updated_at=created,
            )
            session.add(g)
            await session.flush()
            for uname in cfg["members"]:
                session.add(Membership(user_id=users[uname].id, group_id=g.id,
                                       is_admin=(uname == "demo"), updated_at=created))
            group_objs.append((g, cfg["members"], cfg["templates"]))
            # A couple of chat messages per group.
            for _ in range(RNG.randint(2, 4)):
                speaker = RNG.choice(cfg["members"])
                session.add(GroupMessage(
                    group_id=g.id, user_id=users[speaker].id,
                    content=RNG.choice([
                        "Guys don't forget to settle up 😄",
                        "I added the receipt.",
                        "Who's paying next time?",
                        "Thanks for organizing!",
                        "Let's do this again soon.",
                        "Balances updated ✅",
                    ]),
                    created_at=rand_dt(created, NOW),
                ))
        print(f"✅ Created {len(group_objs)} groups with memberships and chat.")

        # ── expenses + splits ────────────────────────────────────────────────
        total_expenses = 0
        activity_rows: list[tuple[int, str, str, int, datetime]] = []
        for g, members, templates, in [(g, m, t) for (g, m, t) in group_objs]:
            cfg_count = next(c["count"] for c in GROUPS if c["title"] == g.title)
            member_ids = [users[m].id for m in members]
            for _ in range(cfg_count):
                desc, category, low, high = RNG.choice(templates)
                amount = round2(RNG.uniform(low, high)) if low != high else float(low)
                payer_uname = RNG.choice(members)
                payer = users[payer_uname]
                # Usually everyone splits; sometimes a subset (min 2).
                if len(member_ids) > 2 and RNG.random() < 0.25:
                    k = RNG.randint(2, len(member_ids))
                    participants = RNG.sample(member_ids, k)
                    if payer.id not in participants:
                        participants[0] = payer.id
                else:
                    participants = list(member_ids)
                split_type = RNG.choice(SPLIT_WEIGHTS)
                when = rand_dt(g.created_at, NOW)
                exp = Expense(
                    group_id=g.id, payer_id=payer.id, added_by=payer.id,
                    description=desc, amount=amount, currency=CURRENCY,
                    category=category, split_type=split_type,
                    note=None, created_at=when, updated_at=when,
                )
                session.add(exp)
                await session.flush()
                for uid, share in make_shares(amount, participants, split_type):
                    session.add(Split(expense_id=exp.id, user_id=uid, share_amount=share, updated_at=when))
                total_expenses += 1
                if payer.id == demo.id or demo.id in participants:
                    activity_rows.append((
                        demo.id,
                        f"added '{desc}' in '{g.title}'",
                        "expense", exp.id, when,
                    ))
        print(f"✅ Created {total_expenses} expenses with splits (equal / percentage / share).")

        # ── settlements (mixed statuses) ─────────────────────────────────────
        settle_specs = [
            # (group_title, from, to, amount, status, days_ago)
            ("Weekend Trip to Chefchaouen", "demo", "yassine", 250, SettlementStatus.accepted, 25),
            ("Apartment",                    "hamza", "demo",    120, SettlementStatus.accepted, 18),
            ("Family",                       "sara",  "salma",    90, SettlementStatus.accepted, 12),
            ("Football Team",                "zakaria", "demo",  140, SettlementStatus.pending, 4),
            ("Road Trip to Marrakech",       "demo", "imane",     55, SettlementStatus.pending, 3),
            ("Road Trip to Marrakech",       "othmane", "demo",  180, SettlementStatus.accepted, 9),
            ("Apartment",                    "demo", "salma",    130, SettlementStatus.pending, 2),
            ("Football Team",                "ayoub", "demo",    420, SettlementStatus.accepted, 15),
        ]
        title_to_group = {g.title: g for (g, _, _) in group_objs}
        settle_count = 0
        for title, frm, to, amt, status, days_ago in settle_specs:
            g = title_to_group[title]
            when = NOW - timedelta(days=days_ago)
            session.add(Settlement(
                group_id=g.id, from_user_id=users[frm].id, to_user_id=users[to].id,
                amount=float(amt), status=status,
                message="Settled up 👍" if status == SettlementStatus.accepted else "Please confirm",
                created_at=when, updated_at=when,
            ))
            settle_count += 1
            if demo.id in (users[frm].id, users[to].id):
                other = to if frm == "demo" else frm
                verb = "settled" if status == SettlementStatus.accepted else "requested settlement of"
                activity_rows.append((demo.id, f"{verb} {amt}{CURRENCY} with {users[other].first_name}",
                                      "settlement", g.id, when))
        print(f"✅ Created {settle_count} settlements (accepted + pending).")

        # ── notifications for demo ───────────────────────────────────────────
        notifs = [
            ("Ayoub added a new expense in Football Team", "expense", 2),
            ("Hamza accepted your friend request", "friend", 20),
            ("Yassine settled 120 MAD with you", "settlement", 5),
            ("Sara created a new group 'Family'", "group", 30),
            ("Imane invited you to 'Road Trip to Marrakech'", "group", 28),
            ("Zakaria requested a settlement of 140 MAD", "settlement", 4),
            ("Salma added 'Groceries' in Apartment", "expense", 6),
            ("Yasmine sent you a friend request", "friend", 3),
            ("Othmane settled 180 MAD with you", "settlement", 9),
            ("New expense 'Hotel' added in Road Trip to Marrakech", "expense", 11),
        ]
        for msg, ntype, days_ago in notifs:
            session.add(Notification(
                user_id=demo.id, message=msg, type=ntype,
                is_read=(days_ago > 7), link=None,
                created_at=NOW - timedelta(days=days_ago, hours=RNG.randint(0, 12)),
            ))
        print(f"✅ Created {len(notifs)} notifications.")

        # ── activity timeline for demo ───────────────────────────────────────
        for (g, _, _) in group_objs:
            activity_rows.append((demo.id, f"created group '{g.title}'", "group", g.id, g.created_at))
        activity_rows.append((demo.id, "accepted friend request from Hamza", "friend",
                              users["hamza"].id, rand_dt(START, NOW - timedelta(days=20))))
        activity_rows.append((demo.id, "added Sara as a friend", "friend",
                              users["sara"].id, rand_dt(START, NOW - timedelta(days=25))))
        activity_rows.append((demo.id, "updated your profile", "user", demo.id,
                              rand_dt(NOW - timedelta(days=10))))
        # Keep the timeline chronological and trimmed.
        activity_rows.sort(key=lambda r: r[4])
        for uid, action, ttype, tid, when in activity_rows[-40:]:
            session.add(ActivityLog(user_id=uid, action=action, target_type=ttype,
                                    target_id=tid, created_at=when))
        print(f"✅ Created activity timeline ({min(len(activity_rows), 40)} entries).")

        await session.commit()
        print("\n🎉 Demo environment ready! Log in with  demo / demo")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the SplitEasy demo dataset.")
    parser.add_argument("--force", action="store_true",
                        help="Delete existing demo data and regenerate it.")
    args = parser.parse_args()
    asyncio.run(seed_demo(force=args.force))


if __name__ == "__main__":
    main()
