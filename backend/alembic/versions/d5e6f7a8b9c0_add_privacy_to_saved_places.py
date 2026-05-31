"""add privacy column to saved_places

Revision ID: d5e6f7a8b9c0
Revises: c7d4f2e8b1a9
Create Date: 2026-06-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "c7d4f2e8b1a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "saved_places",
        sa.Column("privacy", sa.String(length=20), nullable=False, server_default="private"),
    )


def downgrade() -> None:
    op.drop_column("saved_places", "privacy")
