"""Add stable default-group identity without deleting or moving legacy history."""
from sqlalchemy import inspect, text


def migrate_default_personal_groups(connection):
    columns = {column["name"] for column in inspect(connection).get_columns("groups")}
    if "is_default_personal" not in columns:
        connection.execute(text(
            "ALTER TABLE groups ADD COLUMN is_default_personal BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        # The old schema did not distinguish auto-created groups from custom
        # groups. Adopt only the oldest eligible private group for each owner;
        # preserve other groups as ordinary groups, with every expense and log
        # intact. Never privatize a group with another person's history.
        connection.execute(text("""
            UPDATE groups SET is_default_personal = TRUE WHERE id IN (
                SELECT id FROM (
                    SELECT g.id, ROW_NUMBER() OVER (
                        PARTITION BY g.owner_id ORDER BY g.created_at, g.id
                    ) AS position
                    FROM groups g
                    WHERE g.title = 'Personal Expenses'
                      AND g.type IN ('Personal', 'Personal Expenses')
                      AND NOT EXISTS (
                        SELECT 1 FROM memberships m
                        WHERE m.group_id = g.id AND m.user_id <> g.owner_id
                      )
                      AND NOT EXISTS (
                        SELECT 1 FROM expenses e WHERE e.group_id = g.id
                          AND (e.payer_id <> g.owner_id OR e.added_by <> g.owner_id)
                      )
                      AND NOT EXISTS (
                        SELECT 1 FROM splits s JOIN expenses e ON e.id = s.expense_id
                        WHERE e.group_id = g.id AND s.user_id <> g.owner_id
                      )
                      AND NOT EXISTS (
                        SELECT 1 FROM settlements s WHERE s.group_id = g.id
                      )
                      AND NOT EXISTS (
                        SELECT 1 FROM group_messages m
                        WHERE m.group_id = g.id AND m.user_id <> g.owner_id
                      )
                ) candidates WHERE position = 1
            )
        """))
    connection.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_groups_default_personal_owner
        ON groups (owner_id) WHERE is_default_personal = TRUE
    """))
