"""add tags column to image_metadata

Revision ID: c7d4f2e8b1a9
Revises: b9c3e1f7d2a8
Create Date: 2026-06-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c7d4f2e8b1a9"
down_revision: Union[str, Sequence[str], None] = "b9c3e1f7d2a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("image_metadata", sa.Column("tags", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("image_metadata", "tags")
