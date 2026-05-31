"""add image_url to chat_messages for gallery photo attachments

Revision ID: f8a2c7d1e9b3
Revises: e7b1c2d3a4f5
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f8a2c7d1e9b3"
down_revision: Union[str, Sequence[str], None] = "e7b1c2d3a4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chat_messages", sa.Column("image_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_messages", "image_url")
