"""add journal schema and image owner

Revision ID: b2f9c41dd7a3
Revises: 5170ad3cfe71
Create Date: 2026-05-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b2f9c41dd7a3'
down_revision: Union[str, Sequence[str], None] = '5170ad3cfe71'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # 1) Add user_id FK to image_metadata so journal ownership can be enforced.
    op.add_column(
        'image_metadata',
        sa.Column('user_id', sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f('ix_image_metadata_user_id'),
        'image_metadata',
        ['user_id'],
        unique=False,
    )
    op.create_foreign_key(
        'fk_image_metadata_user_id_users',
        'image_metadata',
        'users',
        ['user_id'],
        ['id'],
        ondelete='CASCADE',
    )

    # 2) journals table — one row per generation job / saved journal.
    op.create_table(
        'journals',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('visibility', sa.String(length=20), nullable=False, server_default='private'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('error_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_journals_user_id'), 'journals', ['user_id'], unique=False)
    op.create_index(op.f('ix_journals_status'), 'journals', ['status'], unique=False)

    # 3) journal_entries — one row per image inside a journal.
    op.create_table(
        'journal_entries',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('journal_id', sa.BigInteger(), nullable=False),
        sa.Column('image_id', sa.BigInteger(), nullable=False),
        sa.Column('place_name', sa.String(length=255), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column('captured_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('place_type', sa.String(length=50), nullable=True),
        sa.Column('themes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('entry_order', sa.Integer(), nullable=False),
        sa.Column('generated_by', sa.String(length=20), nullable=False),
        sa.Column('model_version', sa.String(length=100), nullable=True),
        sa.Column('vocab_version', sa.String(length=20), nullable=True),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['journal_id'], ['journals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['image_id'], ['image_metadata.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('journal_id', 'image_id', name='uq_journal_entry_journal_image'),
    )
    op.create_index(op.f('ix_journal_entries_journal_id'), 'journal_entries', ['journal_id'], unique=False)
    op.create_index(op.f('ix_journal_entries_image_id'), 'journal_entries', ['image_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_index(op.f('ix_journal_entries_image_id'), table_name='journal_entries')
    op.drop_index(op.f('ix_journal_entries_journal_id'), table_name='journal_entries')
    op.drop_table('journal_entries')

    op.drop_index(op.f('ix_journals_status'), table_name='journals')
    op.drop_index(op.f('ix_journals_user_id'), table_name='journals')
    op.drop_table('journals')

    op.drop_constraint('fk_image_metadata_user_id_users', 'image_metadata', type_='foreignkey')
    op.drop_index(op.f('ix_image_metadata_user_id'), table_name='image_metadata')
    op.drop_column('image_metadata', 'user_id')
