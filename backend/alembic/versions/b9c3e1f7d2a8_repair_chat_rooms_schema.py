"""repair chat_rooms and fix chat_messages schema

Revision ID: b9c3e1f7d2a8
Revises: f8a2c7d1e9b3
Create Date: 2026-06-01

chat_rooms table was never created because the e7b1c2d3a4f5 migration was
edited after it had already been applied to existing databases.
This migration rebuilds chat_messages with the correct schema and creates chat_rooms.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b9c3e1f7d2a8"
down_revision: Union[str, Sequence[str], None] = "f8a2c7d1e9b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CHAT_ROOMS = [
    ("beach",     "Beach & Coast",          "🏖", "Beach, coast, islands, ocean, and seaside trips.",                          "nature"),
    ("mountain",  "Mountain & Hike",         "🏔", "Mountains, hiking trails, highlands, and trekking photos.",                 "nature"),
    ("nature",    "Nature & Wildlife",       "🌲", "Forests, lakes, wildlife, parks, and natural scenery.",                    "nature"),
    ("desert",    "Desert & Plains",         "🏜", "Deserts, plains, grasslands, and wide open landscapes.",                   "nature"),
    ("urban",     "Urban & Street",          "🌆", "City streets, skylines, neighborhoods, and street views.",                 "urban"),
    ("historical","Historical & Heritage",   "🏛", "Historic places, palaces, temples, castles, and heritage sites.",          "urban"),
    ("nightlife", "Nightlife & Lights",      "🌃", "Night views, neon signs, evening streets, and city lights.",               "urban"),
    ("food",      "Food & Cafe",             "🍜", "Meals, cafes, restaurants, bakeries, and local food photos.",              "culture"),
    ("museum",    "Museum & Art",            "🎨", "Museums, art galleries, exhibitions, murals, and creative spaces.",        "culture"),
    ("market",    "Market & Shopping",       "🛍", "Markets, shopping streets, stores, malls, and souvenirs.",                 "culture"),
    ("transport", "Transport & Journey",     "🚆", "Trains, bridges, airports, roads, stations, and transit moments.",         "experience"),
    ("sunset",    "Sunset & Sunrise",        "🌅", "Sunrise, sunset, golden hour, dusk, and dawn scenes.",                    "experience"),
    ("snow",      "Snow & Winter",           "☃️", "Snow, winter travel, ski trips, ice, and cold landscapes.",                "experience"),
]


def upgrade() -> None:
    # Drop old chat_messages (wrong schema: string room_id, no FK to chat_rooms)
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_room_created")
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_image_id")
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_sender_user_id")
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_room_id")
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_id")
    op.drop_table("chat_messages")

    # Create chat_rooms
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

    # Seed 13 lounges
    chat_rooms_t = sa.table(
        "chat_rooms",
        sa.column("tag_key", sa.String),
        sa.column("display_name", sa.String),
        sa.column("emoji", sa.String),
        sa.column("description", sa.Text),
        sa.column("category", sa.String),
    )
    op.bulk_insert(
        chat_rooms_t,
        [
            {"tag_key": k, "display_name": n, "emoji": e, "description": d, "category": c}
            for k, n, e, d, c in CHAT_ROOMS
        ],
    )

    # Recreate chat_messages with correct schema
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("sender_user_id", sa.Integer(), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("image_id", sa.BigInteger(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
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


def downgrade() -> None:
    pass
