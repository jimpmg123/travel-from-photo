"""repair chat_rooms and fix chat_messages schema

Revision ID: b9c3e1f7d2a8
Revises: f8a2c7d1e9b3
Create Date: 2026-06-01

This migration repairs the Live Chat schema.

It safely creates:
- chat_rooms
- chat_messages

It also seeds the 13 fixed tag-based chat lounges.

This migration is written defensively because earlier local/dev databases may
already contain chat_rooms or chat_messages from previous testing.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b9c3e1f7d2a8"
down_revision: Union[str, Sequence[str], None] = "f8a2c7d1e9b3"
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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    # Drop old or partially-created chat_messages table safely.
    # Some earlier versions used the wrong schema, so we rebuild it.
    if "chat_messages" in existing_tables:
        op.execute("DROP TABLE IF EXISTS chat_messages CASCADE")

    # Create chat_rooms only if it does not already exist.
    if "chat_rooms" not in existing_tables:
        op.create_table(
            "chat_rooms",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tag_key", sa.String(length=80), nullable=False),
            sa.Column("display_name", sa.String(length=120), nullable=False),
            sa.Column("emoji", sa.String(length=16), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("category", sa.String(length=40), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("tag_key", name="uq_chat_rooms_tag_key"),
        )

    # Create indexes safely.
    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_rooms_id ON chat_rooms (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_rooms_tag_key ON chat_rooms (tag_key)")

    # Seed 13 fixed lounges safely. If a room already exists, update its display fields.
    for tag_key, display_name, emoji, description, category in CHAT_ROOMS:
        op.execute(
            sa.text(
                """
                INSERT INTO chat_rooms (tag_key, display_name, emoji, description, category)
                VALUES (:tag_key, :display_name, :emoji, :description, :category)
                ON CONFLICT (tag_key)
                DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    emoji = EXCLUDED.emoji,
                    description = EXCLUDED.description,
                    category = EXCLUDED.category
                """
            ).bindparams(
                tag_key=tag_key,
                display_name=display_name,
                emoji=emoji,
                description=description,
                category=category,
            )
        )

    # Recreate chat_messages with the correct schema.
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("sender_user_id", sa.Integer(), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("image_id", sa.BigInteger(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["room_id"], ["chat_rooms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["image_id"], ["image_metadata.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_messages_id ON chat_messages (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_messages_room_id ON chat_messages (room_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_messages_sender_user_id ON chat_messages (sender_user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_messages_image_id ON chat_messages (image_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_chat_messages_room_created ON chat_messages (room_id, created_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS chat_messages CASCADE")
    op.execute("DROP INDEX IF EXISTS ix_chat_rooms_tag_key")
    op.execute("DROP INDEX IF EXISTS ix_chat_rooms_id")
    op.execute("DROP TABLE IF EXISTS chat_rooms CASCADE")
