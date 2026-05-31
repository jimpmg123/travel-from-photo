"""add social b track tables and tag lounges

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

CHAT_ROOMS = [
    ("beach", "Beach & Coast", "🏖", "Beach, coast, islands, ocean, and seaside trips.", "nature"),
    ("mountain", "Mountain & Hike", "🏔", "Mountains, hiking trails, highlands, and trekking photos.", "nature"),
    ("nature", "Nature & Wildlife", "🌲", "Forests, lakes, wildlife, parks, and natural scenery.", "nature"),
    ("desert", "Desert & Plains", "🏜", "Deserts, plains, grasslands, and wide open landscapes.", "nature"),
    ("urban", "Urban & Street", "🌆", "City streets, skylines, neighborhoods, and street views.", "urban"),
    ("historical", "Historical & Heritage", "🏛", "Historic places, palaces, temples, castles, and heritage sites.", "urban"),
    ("nightlife", "Nightlife & Lights", "🌃", "Night views, neon signs, evening streets, and city lights.", "urban"),
    ("food", "Food & Cafe", "🍜", "Meals, cafes, restaurants, bakeries, and local food photos.", "culture"),
    ("museum", "Museum & Art", "🎨", "Museums, art galleries, exhibitions, murals, and creative spaces.", "culture"),
    ("market", "Market & Shopping", "🛍", "Markets, shopping streets, stores, malls, and souvenirs.", "culture"),
    ("transport", "Transport & Journey", "🚆", "Trains, bridges, airports, roads, stations, and transit moments.", "experience"),
    ("sunset", "Sunset & Sunrise", "🌅", "Sunrise, sunset, golden hour, dusk, and dawn scenes.", "experience"),
    ("snow", "Snow & Winter", "☃️", "Snow, winter travel, ski trips, ice, and cold landscapes.", "experience"),
]


def upgrade() -> None:
    op.add_column("image_metadata", sa.Column("tags", sa.JSON(), nullable=True))

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
        "chat_rooms",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tag_key", sa.String(length=80), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("emoji", sa.String(length=16), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tag_key", name="uq_chat_rooms_tag_key"),
    )
    op.create_index(op.f("ix_chat_rooms_id"), "chat_rooms", ["id"], unique=False)
    op.create_index(op.f("ix_chat_rooms_tag_key"), "chat_rooms", ["tag_key"], unique=False)

    chat_rooms_table = sa.table(
        "chat_rooms",
        sa.column("tag_key", sa.String),
        sa.column("display_name", sa.String),
        sa.column("emoji", sa.String),
        sa.column("description", sa.Text),
        sa.column("category", sa.String),
    )
    op.bulk_insert(
        chat_rooms_table,
        [
            {"tag_key": key, "display_name": name, "emoji": emoji, "description": desc, "category": category}
            for key, name, emoji, desc, category in CHAT_ROOMS
        ],
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("sender_user_id", sa.Integer(), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("image_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["room_id"], ["chat_rooms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["image_id"], ["image_metadata.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_messages_id"), "chat_messages", ["id"], unique=False)
    op.create_index(op.f("ix_chat_messages_room_id"), "chat_messages", ["room_id"], unique=False)
    op.create_index(op.f("ix_chat_messages_sender_user_id"), "chat_messages", ["sender_user_id"], unique=False)
    op.create_index(op.f("ix_chat_messages_image_id"), "chat_messages", ["image_id"], unique=False)
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
    op.drop_index(op.f("ix_chat_messages_image_id"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_sender_user_id"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_room_id"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_id"), table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index(op.f("ix_chat_rooms_tag_key"), table_name="chat_rooms")
    op.drop_index(op.f("ix_chat_rooms_id"), table_name="chat_rooms")
    op.drop_table("chat_rooms")

    op.drop_index(op.f("ix_user_settings_user_id"), table_name="user_settings")
    op.drop_index(op.f("ix_user_settings_id"), table_name="user_settings")
    op.drop_table("user_settings")

    op.drop_column("image_metadata", "tags")
