"""baseline — adopt existing schema

Revision ID: 0001_baseline
Revises:
Create Date: 2026-07-12

This is an intentional no-op baseline. At the time Alembic was adopted, the
schema was already created by the app's startup routine (``Base.metadata.create_all``
plus the idempotent statements in ``app/core/migrations.py``).

- Existing databases: run ``alembic stamp head`` once to mark them at this
  revision without running anything.
- From here on, create real migrations with ``alembic revision --autogenerate``;
  autogenerate diffs the models against the live DB, so only genuine changes
  are emitted.
"""
from typing import Sequence, Union

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
