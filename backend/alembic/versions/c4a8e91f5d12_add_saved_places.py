"""add saved_places

Revision ID: c4a8e91f5d12
Revises: b2f9c41dd7a3
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4a8e91f5d12'
down_revision: Union[str, Sequence[str], None] = 'b2f9c41dd7a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'saved_places',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('collection_name', sa.String(length=120), server_default='My Gallery', nullable=False),
        sa.Column('place_name', sa.String(length=255), nullable=False),
        sa.Column('formatted_address', sa.String(length=500), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column('image_filename', sa.String(length=255), nullable=True),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_saved_places_user_id'), 'saved_places', ['user_id'], unique=False)
    op.create_index(op.f('ix_saved_places_collection_name'), 'saved_places', ['collection_name'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_saved_places_collection_name'), table_name='saved_places')
    op.drop_index(op.f('ix_saved_places_user_id'), table_name='saved_places')
    op.drop_table('saved_places')
