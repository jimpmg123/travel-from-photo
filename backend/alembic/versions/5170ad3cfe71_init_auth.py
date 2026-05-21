"""init auth

Revision ID: 5170ad3cfe71
Revises:
Create Date: 2026-05-19 10:19:51.193525

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5170ad3cfe71'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_user_id'), 'users', ['user_id'], unique=True)

    op.create_table(
        'otps',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=6), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_otps_email'), 'otps', ['email'], unique=False)
    op.create_index(op.f('ix_otps_id'), 'otps', ['id'], unique=False)

    op.create_table(
        'search_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('hint_country', sa.String(length=100), nullable=True),
        sa.Column('hint_city', sa.String(length=100), nullable=True),
        sa.Column('hint_region', sa.String(length=100), nullable=True),
        sa.Column('user_hint_text', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_search_sessions_user_id'), 'search_sessions', ['user_id'], unique=False)

    op.create_table(
        'uploaded_images',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('search_session_id', sa.Integer(), nullable=True),
        sa.Column('original_file_name', sa.String(length=255), nullable=False),
        sa.Column('stored_file_path', sa.String(length=500), nullable=True),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('image_format', sa.String(length=50), nullable=True),
        sa.Column('image_mode', sa.String(length=50), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('has_gps', sa.Boolean(), nullable=False),
        sa.Column('metadata_case', sa.String(length=20), nullable=False),
        sa.Column('raw_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['search_session_id'], ['search_sessions.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_uploaded_images_user_id'), 'uploaded_images', ['user_id'], unique=False)
    op.create_index(
        op.f('ix_uploaded_images_search_session_id'), 'uploaded_images', ['search_session_id'], unique=False
    )

    op.create_table(
        'image_exif_metadata',
        sa.Column('image_id', sa.BigInteger(), nullable=False),
        sa.Column('captured_at', sa.String(length=100), nullable=True),
        sa.Column('camera_make', sa.String(length=100), nullable=True),
        sa.Column('camera_model', sa.String(length=100), nullable=True),
        sa.Column('lens_model', sa.String(length=150), nullable=True),
        sa.Column('gps_latitude', sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column('gps_longitude', sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column('has_exif_datetime', sa.Boolean(), nullable=False),
        sa.Column('has_exif_gps', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['image_id'], ['uploaded_images.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('image_id'),
    )

    op.create_table(
        'image_analysis_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('image_id', sa.BigInteger(), nullable=False),
        sa.Column('search_session_id', sa.Integer(), nullable=True),
        sa.Column('hint_round', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('verdict', sa.String(length=20), nullable=True),
        sa.Column('resolved_source', sa.String(length=40), nullable=True),
        sa.Column('coordinate_type', sa.String(length=20), nullable=False),
        sa.Column('has_resolved_location', sa.Boolean(), nullable=False),
        sa.Column('resolved_place_name', sa.String(length=255), nullable=True),
        sa.Column('resolved_formatted_address', sa.Text(), nullable=True),
        sa.Column('resolved_country', sa.String(length=100), nullable=True),
        sa.Column('resolved_city', sa.String(length=100), nullable=True),
        sa.Column('resolved_latitude', sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column('resolved_longitude', sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column('clip_gate', sa.JSON(), nullable=True),
        sa.Column('clip_summary', sa.Text(), nullable=True),
        sa.Column('failure_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['image_id'], ['uploaded_images.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['search_session_id'], ['search_sessions.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_image_analysis_runs_image_id'), 'image_analysis_runs', ['image_id'], unique=False)
    op.create_index(
        op.f('ix_image_analysis_runs_search_session_id'),
        'image_analysis_runs',
        ['search_session_id'],
        unique=False,
    )

    op.create_table(
        'analysis_signals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('run_id', sa.Integer(), nullable=False),
        sa.Column('source', sa.String(length=40), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('raw_response', sa.JSON(), nullable=True),
        sa.Column('parsed_place_name', sa.String(length=255), nullable=True),
        sa.Column('parsed_country', sa.String(length=100), nullable=True),
        sa.Column('parsed_city', sa.String(length=100), nullable=True),
        sa.Column('parsed_latitude', sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column('parsed_longitude', sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column('signal_score', sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column('failure_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['run_id'], ['image_analysis_runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_analysis_signals_run_id'), 'analysis_signals', ['run_id'], unique=False)

    op.create_table(
        'location_candidates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('run_id', sa.Integer(), nullable=False),
        sa.Column('rank', sa.Integer(), nullable=False),
        sa.Column('place_name', sa.String(length=255), nullable=True),
        sa.Column('formatted_address', sa.Text(), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('latitude', sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column('longitude', sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column('google_place_id', sa.String(length=255), nullable=True),
        sa.Column('aggregated_score', sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column('contributing_sources', sa.JSON(), nullable=True),
        sa.Column('reasoning', sa.Text(), nullable=True),
        sa.Column('is_selected', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['run_id'], ['image_analysis_runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_location_candidates_run_id'), 'location_candidates', ['run_id'], unique=False)

    op.create_table(
        'search_selections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('image_id', sa.BigInteger(), nullable=False),
        sa.Column('run_id', sa.Integer(), nullable=True),
        sa.Column('candidate_id', sa.Integer(), nullable=True),
        sa.Column('source_type', sa.String(length=20), nullable=False),
        sa.Column('place_name', sa.String(length=255), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('latitude', sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column('longitude', sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['image_id'], ['uploaded_images.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['run_id'], ['image_analysis_runs.id']),
        sa.ForeignKeyConstraint(['candidate_id'], ['location_candidates.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_search_selections_image_id'), 'search_selections', ['image_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_search_selections_image_id'), table_name='search_selections')
    op.drop_table('search_selections')
    op.drop_index(op.f('ix_location_candidates_run_id'), table_name='location_candidates')
    op.drop_table('location_candidates')
    op.drop_index(op.f('ix_analysis_signals_run_id'), table_name='analysis_signals')
    op.drop_table('analysis_signals')
    op.drop_index(op.f('ix_image_analysis_runs_search_session_id'), table_name='image_analysis_runs')
    op.drop_index(op.f('ix_image_analysis_runs_image_id'), table_name='image_analysis_runs')
    op.drop_table('image_analysis_runs')
    op.drop_table('image_exif_metadata')
    op.drop_index(op.f('ix_uploaded_images_search_session_id'), table_name='uploaded_images')
    op.drop_index(op.f('ix_uploaded_images_user_id'), table_name='uploaded_images')
    op.drop_table('uploaded_images')
    op.drop_index(op.f('ix_search_sessions_user_id'), table_name='search_sessions')
    op.drop_table('search_sessions')
    op.drop_index(op.f('ix_otps_id'), table_name='otps')
    op.drop_index(op.f('ix_otps_email'), table_name='otps')
    op.drop_table('otps')
    op.drop_index(op.f('ix_users_user_id'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
