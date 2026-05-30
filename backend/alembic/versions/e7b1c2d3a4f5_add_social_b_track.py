"""add social b track tables

Revision ID: e7b1c2d3a4f5
Revises: d92a1b3e7c45
Create Date: 2026-05-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7b1c2d3a4f5"
down_revision: Union[str, Sequence[str], None] = "d92a1b3e7c45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("default_privacy", sa.String(length=20), nullable=False, server_default="private"),
        sa.Column("theme", sa.String(length=20), nullable=False, server_default="system"),
        sa.Column("email_notifications", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_user_settings_id"), "user_settings", ["id"], unique=False)
    op.create_index(op.f("ix_user_settings_user_id"), "user_settings", ["user_id"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sender_user_id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.String(length=80), nullable=False, server_default="support"),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_messages_id"), "chat_messages", ["id"], unique=False)
    op.create_index(op.f("ix_chat_messages_sender_user_id"), "chat_messages", ["sender_user_id"], unique=False)
    op.create_index("ix_chat_messages_room_created", "chat_messages", ["room_id", "created_at"], unique=False)

    op.create_table(
        "moderation_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("item_type", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("reporter_name", sa.String(length=120), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_moderation_items_id"), "moderation_items", ["id"], unique=False)
    op.create_index("ix_moderation_items_status", "moderation_items", ["status"], unique=False)
    op.create_index("ix_moderation_items_created_at", "moderation_items", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_moderation_items_created_at", table_name="moderation_items")
    op.drop_index("ix_moderation_items_status", table_name="moderation_items")
    op.drop_index(op.f("ix_moderation_items_id"), table_name="moderation_items")
    op.drop_table("moderation_items")

    op.drop_index("ix_chat_messages_room_created", table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_sender_user_id"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_id"), table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index(op.f("ix_user_settings_user_id"), table_name="user_settings")
    op.drop_index(op.f("ix_user_settings_id"), table_name="user_settings")
    op.drop_table("user_settings")
