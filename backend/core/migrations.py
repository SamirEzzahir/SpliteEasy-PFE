import json
import os
from sqlalchemy import text
from backend.core.db import engine


async def _exec(sql: str, label: str = ""):
    """Run a single DDL/DML statement in its own transaction.

    Isolating each statement means a failure (e.g. a column that already
    exists in an unexpected shape) cannot poison a shared transaction and
    abort every following statement.
    """
    try:
        async with engine.begin() as conn:
            await conn.execute(text(sql))
        if label:
            print(f"✅ {label}")
    except Exception as e:
        print(f"⚠️  Skipped ({label or sql[:40]}): {e}")


async def _exec_params(sql: str, params: dict, label: str = ""):
    """Like _exec but with bound parameters (safe for user-supplied values)."""
    try:
        async with engine.begin() as conn:
            await conn.execute(text(sql), params)
        if label:
            print(f"✅ {label}")
    except Exception as e:
        print(f"⚠️  Skipped ({label or sql[:40]}): {e}")


async def _convert_enum_to_varchar(table: str, column: str, length: int, default: str | None = None):
    """Convert a native Postgres ENUM column to VARCHAR.

    After a MySQL -> Postgres port the enum columns came across as native
    Postgres enum types (e.g. ``friends_status``) whose names don't match the
    types SQLAlchemy expects, so ``col = $1::friendstatus`` has no operator.
    Storing them as plain VARCHAR (with ``native_enum=False`` on the models)
    removes that whole class of failure. ``USING col::text`` preserves the
    existing label values exactly.
    """
    # Drop any enum-typed default first, otherwise the type change is blocked.
    await _exec(f"ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT")
    await _exec(
        f"ALTER TABLE {table} ALTER COLUMN {column} TYPE VARCHAR({length}) USING {column}::text",
        f"{table}.{column} -> varchar({length})",
    )
    if default is not None:
        await _exec(f"ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT '{default}'")


async def migrate_enum_columns_to_varchar():
    print("🔄 Converting native enum columns to VARCHAR (Postgres compatibility)...")
    await _convert_enum_to_varchar("friends", "status", 20, "pending")
    await _convert_enum_to_varchar("settlements", "status", 20, "pending")
    await _convert_enum_to_varchar("global_settlements", "status", 20, "pending")
    await _convert_enum_to_varchar("users", "gender", 10)
    await _convert_enum_to_varchar("users", "global_settlement_mode", 20, "separate")
    await _convert_enum_to_varchar("reclamations", "status", 20, "pending")
    await _convert_enum_to_varchar("transactions", "transaction_type", 20, "transfer")
    await _convert_enum_to_varchar("debts", "status", 20, "active")
    await _convert_enum_to_varchar("loans", "status", 20, "active")
    print("✅ Enum-to-VARCHAR conversion completed!")


async def migrate_settlements_table():
    print("🔄 Checking settlements table migration...")
    await _exec(
        "ALTER TABLE settlements ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'",
        "settlements.status",
    )
    # Backfill pre-existing rows that predate the status column.
    await _exec("UPDATE settlements SET status = 'accepted' WHERE status IS NULL OR status = ''")
    await _exec("ALTER TABLE settlements ADD COLUMN IF NOT EXISTS message VARCHAR(500)", "settlements.message")
    await _exec("ALTER TABLE settlements ADD COLUMN IF NOT EXISTS proof_photo VARCHAR(255)", "settlements.proof_photo")
    await _exec("ALTER TABLE settlements ADD COLUMN IF NOT EXISTS rejected_reason VARCHAR(500)", "settlements.rejected_reason")
    await _exec("ALTER TABLE settlements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP", "settlements.updated_at")
    await _exec("UPDATE settlements SET updated_at = created_at WHERE updated_at IS NULL")
    print("✅ Settlements table migration check completed!")


async def migrate_global_settlement_mode():
    print("🔄 Checking global_settlement_mode migration...")
    await _exec(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS global_settlement_mode VARCHAR(20) DEFAULT 'separate'",
        "users.global_settlement_mode",
    )
    print("✅ Global settlement mode migration check completed!")


async def migrate_transactions_to_wallet_id():
    print("🔄 Checking transactions table for to_wallet_id migration...")
    await _exec(
        "ALTER TABLE transactions ALTER COLUMN to_wallet_id DROP NOT NULL",
        "transactions.to_wallet_id nullable",
    )
    print("✅ Transactions table to_wallet_id migration check completed!")


async def migrate_transactions_transaction_type():
    print("🔄 Checking transactions table for transaction_type migration...")
    await _exec(
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(20) DEFAULT 'transfer'",
        "transactions.transaction_type",
    )
    await _exec("UPDATE transactions SET transaction_type = 'debt' WHERE to_wallet_id IS NULL AND transaction_type IS NULL")
    await _exec(
        "UPDATE transactions SET transaction_type = 'transfer' "
        "WHERE transaction_type IS NULL OR transaction_type = '' "
        "OR transaction_type NOT IN ('transfer', 'debt', 'credit')"
    )
    print("✅ Transactions table transaction_type migration check completed!")


async def migrate_debts_loans_tables():
    # Tables are created via SQLAlchemy metadata; nothing to alter here on
    # Postgres. Kept as a no-op so run_migrations() stays stable.
    print("✅ Debts & Loans tables migration completed!")


async def migrate_expenses_jar_columns():
    print("🔄 Checking expenses table for jar-related columns...")
    await _exec("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS jar_type VARCHAR(10)", "expenses.jar_type")
    await _exec("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_from_jar BOOLEAN DEFAULT FALSE", "expenses.is_from_jar")
    print("✅ Expenses jar tracking migration check completed!")


async def migrate_group_messages_table():
    print("🔄 Checking group_messages table migration...")
    await _exec(
        """
        CREATE TABLE IF NOT EXISTS group_messages (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content VARCHAR(2000) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "group_messages table",
    )
    await _exec("CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON group_messages (group_id)")
    print("✅ Group messages table migration check completed!")


async def migrate_preferred_currency():
    print("🔄 Checking preferred_currency migration...")
    await _exec(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) DEFAULT 'MAD'",
        "users.preferred_currency",
    )
    print("✅ Preferred currency migration check completed!")


async def migrate_onboarding_completed():
    print("🔄 Checking onboarding_completed migration...")
    await _exec(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE",
        "users.onboarding_completed",
    )
    print("✅ Onboarding completed migration check completed!")


# ---------------------------------------------------------------------------
# Admin panel
# ---------------------------------------------------------------------------

# Canonical permission catalog. Keep in sync with the frontend permission matrix
# and backend/README.md. "*" (wildcard) is reserved for Super Admin.
ADMIN_PERMISSIONS = [
    "view_dashboard",
    "view_users", "manage_users",
    "view_groups", "manage_groups",
    "view_expenses", "manage_expenses",
    "view_settlements", "manage_settlements",
    "view_support", "manage_support",
    "view_roles", "manage_roles",
    "view_audit_logs",
    # Phase 2 — platform administration
    "view_settings", "manage_settings",
    "view_moderation", "manage_moderation",
    "view_announcements", "manage_announcements",
    "view_analytics",
    "view_system",
]

# Seeded roles. Permissions are stored as a JSON string array on roles.permissions.
SEED_ROLES = {
    "Super Admin": ["*"],
    "Admin": list(ADMIN_PERMISSIONS),
    "Moderator": [
        "view_dashboard", "view_users",
        "view_groups", "manage_groups",
        "view_expenses", "manage_expenses",
        "view_settlements", "manage_settlements",
        "view_support", "manage_support",
        "view_moderation", "manage_moderation",
        "view_announcements",
        "view_analytics",
        "view_audit_logs",
    ],
    "Support Agent": ["view_dashboard", "view_users", "view_support", "manage_support"],
    "Viewer": [
        "view_dashboard", "view_users", "view_groups",
        "view_expenses", "view_settlements", "view_support", "view_audit_logs",
        "view_settings", "view_moderation", "view_announcements", "view_analytics", "view_system",
    ],
}


async def migrate_admin_user_columns():
    print("🔄 Checking admin user columns migration...")
    await _exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'", "users.status")
    # Backfill: disabled accounts become 'banned', everyone else 'active'.
    await _exec("UPDATE users SET status = 'active' WHERE status IS NULL AND is_active = TRUE")
    await _exec("UPDATE users SET status = 'banned' WHERE status IS NULL AND is_active = FALSE")
    await _exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS status_reason VARCHAR(500)", "users.status_reason")
    await _exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE", "users.email_verified")
    await _exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP", "users.last_login_at")
    await _exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0", "users.token_version")
    await _exec("UPDATE users SET token_version = 0 WHERE token_version IS NULL")
    print("✅ Admin user columns migration check completed!")


async def migrate_admin_audit_logs_table():
    print("🔄 Checking admin_audit_logs table migration...")
    await _exec(
        """
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
            id SERIAL PRIMARY KEY,
            admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(100) NOT NULL,
            target_type VARCHAR(50),
            target_id INTEGER,
            details TEXT,
            ip VARCHAR(64),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "admin_audit_logs table",
    )
    await _exec("CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON admin_audit_logs (admin_id)")
    await _exec("CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs (action)")
    await _exec("CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit_logs (created_at)")
    print("✅ Admin audit logs table migration check completed!")


async def seed_admin_roles():
    print("🔄 Seeding admin roles...")
    for name, perms in SEED_ROLES.items():
        await _exec_params(
            "INSERT INTO roles (name, permissions) VALUES (:name, :perms) ON CONFLICT (name) DO NOTHING",
            {"name": name, "perms": json.dumps(perms)},
            f"role '{name}'",
        )
    print("✅ Admin roles seeded!")


async def sync_seeded_role_permissions():
    """Re-apply the canonical permission set to the 5 seeded roles every startup.

    seed_admin_roles only INSERTs (ON CONFLICT DO NOTHING), so an existing role
    never gains permissions added in a later release. This idempotent UPDATE keeps
    Admin/Moderator/Support Agent/Viewer in sync with SEED_ROLES as new modules add
    permissions. Custom (non-seeded) roles are left untouched.
    """
    print("🔄 Syncing seeded role permissions...")
    for name, perms in SEED_ROLES.items():
        await _exec_params(
            "UPDATE roles SET permissions = :perms WHERE name = :name",
            {"name": name, "perms": json.dumps(perms)},
            f"sync role '{name}'",
        )
    print("✅ Seeded role permissions synced!")


async def bootstrap_super_admin():
    """Grant Super Admin to the user named in ADMIN_USERNAME (if set & present)."""
    admin_username = os.getenv("ADMIN_USERNAME")
    if not admin_username:
        return
    await _exec_params(
        "UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'Super Admin') "
        "WHERE username = :username",
        {"username": admin_username},
        f"bootstrap Super Admin -> '{admin_username}'",
    )


async def migrate_support_tickets():
    print("🔄 Checking support ticket (reclamations) migration...")
    await _exec("ALTER TABLE reclamations ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'other'", "reclamations.category")
    await _exec("ALTER TABLE reclamations ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium'", "reclamations.priority")
    await _exec("ALTER TABLE reclamations ADD COLUMN IF NOT EXISTS assigned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL", "reclamations.assigned_to_id")
    # Remap legacy statuses to the new lifecycle.
    await _exec("UPDATE reclamations SET status = 'open' WHERE status = 'pending'")
    await _exec("UPDATE reclamations SET status = 'closed' WHERE status = 'rejected'")
    await _exec(
        """
        CREATE TABLE IF NOT EXISTS ticket_replies (
            id SERIAL PRIMARY KEY,
            reclamation_id INTEGER NOT NULL REFERENCES reclamations(id) ON DELETE CASCADE,
            author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            body TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "ticket_replies table",
    )
    await _exec("CREATE INDEX IF NOT EXISTS idx_ticket_replies_reclamation_id ON ticket_replies (reclamation_id)")
    print("✅ Support ticket migration check completed!")


async def migrate_app_settings_table():
    print("🔄 Checking app_settings table migration...")
    await _exec(
        """
        CREATE TABLE IF NOT EXISTS app_settings (
            key VARCHAR(64) PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "app_settings table",
    )
    print("✅ App settings table migration check completed!")


async def migrate_moderation_reports_table():
    print("🔄 Checking moderation_reports table migration...")
    await _exec(
        """
        CREATE TABLE IF NOT EXISTS moderation_reports (
            id SERIAL PRIMARY KEY,
            reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            target_type VARCHAR(20) NOT NULL,
            target_id INTEGER NOT NULL,
            reason VARCHAR(20) NOT NULL,
            description VARCHAR(2000),
            status VARCHAR(20) DEFAULT 'open',
            notes TEXT,
            handled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "moderation_reports table",
    )
    await _exec("CREATE INDEX IF NOT EXISTS idx_modreports_status ON moderation_reports (status)")
    print("✅ Moderation reports table migration check completed!")


async def migrate_announcements_table():
    print("🔄 Checking announcements table migration...")
    await _exec(
        """
        CREATE TABLE IF NOT EXISTS announcements (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            body TEXT NOT NULL,
            type VARCHAR(20) DEFAULT 'feature',
            visibility VARCHAR(20) DEFAULT 'everyone',
            delivery VARCHAR(20) DEFAULT 'banner',
            publish_at TIMESTAMP,
            expires_at TIMESTAMP,
            is_published BOOLEAN DEFAULT FALSE,
            notified BOOLEAN DEFAULT FALSE,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "announcements table",
    )
    print("✅ Announcements table migration check completed!")


async def migrate_legacy_users_is_admin():
    """Neutralize a legacy NOT-NULL `users.is_admin` column.

    Older schemas had an `is_admin` flag on `users` that the current model no
    longer maps (admin rights now come from roles; per-group admin lives on
    `memberships.is_admin`). If the column lingers as NOT NULL without a default,
    every INSERT that omits it (i.e. registration) fails. Give it a default and
    drop the NOT NULL so inserts succeed. No-op if the column doesn't exist.
    """
    print("🔄 Checking legacy users.is_admin column...")
    await _exec("ALTER TABLE users ALTER COLUMN is_admin SET DEFAULT FALSE", "users.is_admin default")
    await _exec("ALTER TABLE users ALTER COLUMN is_admin DROP NOT NULL", "users.is_admin drop not null")
    await _exec("UPDATE users SET is_admin = FALSE WHERE is_admin IS NULL")
    print("✅ Legacy users.is_admin check completed!")


async def run_migrations():
    await migrate_enum_columns_to_varchar()
    await migrate_settlements_table()
    await migrate_global_settlement_mode()
    await migrate_transactions_to_wallet_id()
    await migrate_transactions_transaction_type()
    await migrate_debts_loans_tables()
    await migrate_expenses_jar_columns()
    await migrate_group_messages_table()
    await migrate_preferred_currency()
    await migrate_onboarding_completed()
    await migrate_legacy_users_is_admin()
    # Admin panel: columns, audit log, role seeding, first-admin bootstrap.
    await migrate_admin_user_columns()
    await migrate_admin_audit_logs_table()
    await seed_admin_roles()
    await sync_seeded_role_permissions()
    await bootstrap_super_admin()
    # Support tickets: categories, priority, assignment, status remap, reply thread.
    await migrate_support_tickets()
    # Phase 2 — platform settings.
    await migrate_app_settings_table()
    # Phase 2 — moderation + announcements.
    await migrate_moderation_reports_table()
    await migrate_announcements_table()
