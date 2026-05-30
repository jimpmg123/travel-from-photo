"""add image_metadata_id to saved_places

Revision ID: d92a1b3e7c45
Revises: c4a8e91f5d12
Create Date: 2026-05-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd92a1b3e7c45'
down_revision: Union[str, Sequence[str], None] = 'c4a8e91f5d12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'saved_places',
        sa.Column('image_metadata_id', sa.BigInteger(), nullable=True),
    )
    op.create_index(
        op.f('ix_saved_places_image_metadata_id'),
        'saved_places',
        ['image_metadata_id'],
        unique=False,
    )
    op.create_foreign_key(
        'fk_saved_places_image_metadata_id',
        'saved_places',
        'image_metadata',
        ['image_metadata_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_saved_places_image_metadata_id', 'saved_places', type_='foreignkey')
    op.drop_index(op.f('ix_saved_places_image_metadata_id'), table_name='saved_places')
    op.drop_column('saved_places', 'image_metadata_id')
