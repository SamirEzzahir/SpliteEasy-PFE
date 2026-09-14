"""Give each owner's default personal group a stable, unique identity.

Revision ID: 0002_default_personal_group
Revises: 0001_baseline
"""
from alembic import op

from app.core.personal_group_migration import migrate_default_personal_groups

revision = "0002_default_personal_group"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade():
    # Also used by startup; safe when runtime migration ran before Alembic.
    migrate_default_personal_groups(op.get_bind())


def downgrade():
    # Removing identity could recreate duplicates on the next login. Preserve
    # the additive column/index and existing data when rolling application code back.
    pass
