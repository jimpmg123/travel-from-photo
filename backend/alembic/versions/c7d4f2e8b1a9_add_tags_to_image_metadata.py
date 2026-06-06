"""add tags to image_metadata

Revision ID: c7d4f2e8b1a9
Revises: b9c3e1f7d2a8
Create Date: 2026-06-01

This migration safely adds the tags column to image_metadata.
It is defensive because some local/dev databases may already have this column.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7d4f2e8b1a9"
down_revision: Union[str, Sequence[str], None] = "b9c3e1f7d2a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _column_exists("image_metadata", "tags"):
        op.add_column("image_metadata", sa.Column("tags", sa.JSON(), nullable=True))


def downgrade() -> None:
    if _column_exists("image_metadata", "tags"):
        op.drop_column("image_metadata", "tags")
