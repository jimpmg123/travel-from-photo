-- Travel From Photo PostgreSQL schema
-- This file runs automatically when the Docker PostgreSQL volume is created for the first time.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    user_id VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',
    google_sub VARCHAR(255) UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'traveler',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_role_check CHECK (role IN ('traveler', 'admin', 'moderator'))
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS ix_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_role ON users(role);

CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(120) NOT NULL,
    default_privacy VARCHAR(20) NOT NULL DEFAULT 'private',
    theme VARCHAR(20) NOT NULL DEFAULT 'system',
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_settings_privacy_check CHECK (default_privacy IN ('private', 'public', 'unlisted')),
    CONSTRAINT user_settings_theme_check CHECK (theme IN ('system', 'light', 'dark'))
);

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS ix_user_settings_user_id ON user_settings(user_id);

CREATE TABLE IF NOT EXISTS gallery_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL DEFAULT 'Untitled Gallery',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_gallery_groups_updated_at ON gallery_groups;
CREATE TRIGGER trg_gallery_groups_updated_at
BEFORE UPDATE ON gallery_groups
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS ix_gallery_groups_user_id ON gallery_groups(user_id);
CREATE INDEX IF NOT EXISTS ix_gallery_groups_created_at ON gallery_groups(created_at DESC);

CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gallery_group_id INTEGER REFERENCES gallery_groups(id) ON DELETE SET NULL,
    file_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    has_gps BOOLEAN NOT NULL DEFAULT FALSE,
    selected_location_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_images_updated_at ON images;
CREATE TRIGGER trg_images_updated_at
BEFORE UPDATE ON images
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS ix_images_user_id ON images(user_id);
CREATE INDEX IF NOT EXISTS ix_images_gallery_group_id ON images(gallery_group_id);
CREATE INDEX IF NOT EXISTS ix_images_upload_date ON images(upload_date DESC);

CREATE TABLE IF NOT EXISTS search_results (
    id SERIAL PRIMARY KEY,
    image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    candidate_name VARCHAR(255) NOT NULL,
    region VARCHAR(255),
    confidence_score NUMERIC(5,2),
    reason TEXT,
    rank INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_search_results_image_id ON search_results(image_id);
CREATE INDEX IF NOT EXISTS ix_search_results_rank ON search_results(image_id, rank);

CREATE TABLE IF NOT EXISTS selected_locations (
    id SERIAL PRIMARY KEY,
    image_id INTEGER NOT NULL UNIQUE REFERENCES images(id) ON DELETE CASCADE,
    place_name VARCHAR(255) NOT NULL,
    country VARCHAR(120),
    city VARCHAR(120),
    address TEXT,
    source_type VARCHAR(20) NOT NULL DEFAULT 'ai',
    confidence_score NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT selected_locations_source_check CHECK (source_type IN ('ai', 'manual'))
);

CREATE INDEX IF NOT EXISTS ix_selected_locations_image_id ON selected_locations(image_id);

CREATE TABLE IF NOT EXISTS journals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'private',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT journals_visibility_check CHECK (visibility IN ('private', 'public', 'unlisted'))
);

DROP TRIGGER IF EXISTS trg_journals_updated_at ON journals;
CREATE TRIGGER trg_journals_updated_at
BEFORE UPDATE ON journals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS ix_journals_user_id ON journals(user_id);
CREATE INDEX IF NOT EXISTS ix_journals_created_at ON journals(created_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id VARCHAR(80) NOT NULL DEFAULT 'support',
    message_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_chat_messages_sender_user_id ON chat_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS ix_chat_messages_room_created ON chat_messages(room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS moderation_items (
    id SERIAL PRIMARY KEY,
    item_type VARCHAR(80) NOT NULL,
    title VARCHAR(200) NOT NULL,
    reporter_name VARCHAR(120) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT moderation_items_status_check CHECK (status IN ('open', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS ix_moderation_items_status ON moderation_items(status);
CREATE INDEX IF NOT EXISTS ix_moderation_items_created_at ON moderation_items(created_at DESC);

CREATE TABLE IF NOT EXISTS image_metadata (
    id BIGSERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    absolute_path VARCHAR(500),
    file_size_bytes BIGINT NOT NULL,
    image_format VARCHAR(50),
    image_mode VARCHAR(50),
    width INTEGER,
    height INTEGER,
    captured_at VARCHAR(100),
    camera_make VARCHAR(100),
    camera_model VARCHAR(100),
    lens_model VARCHAR(150),
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    has_gps BOOLEAN NOT NULL DEFAULT FALSE,
    metadata_case VARCHAR(20) NOT NULL,
    raw_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_image_metadata_created_at ON image_metadata(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_image_metadata_has_gps ON image_metadata(has_gps);
