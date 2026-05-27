-- Minimal production-like seed data for local deployment checks.
-- Safe to run more than once because core records use ON CONFLICT.

INSERT INTO users (first_name, last_name, user_id, email, role, is_active)
VALUES
    ('Jaemin', 'Jeon', 'jaemin001', 'jaemin@example.com', 'admin', TRUE),
    ('Mina', 'Park', 'traveler102', 'mina@example.com', 'traveler', TRUE)
ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO user_settings (user_id, display_name, default_privacy, theme, email_notifications, bio)
SELECT id, first_name || ' ' || last_name, 'private', 'system', TRUE,
       'I like saving travel photos and checking places later.'
FROM users
WHERE user_id IN ('jaemin001', 'traveler102')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO gallery_groups (user_id, title, description)
SELECT id, 'Sample Travel Photos', 'Local deployment sample gallery.'
FROM users
WHERE user_id = 'jaemin001'
  AND NOT EXISTS (
      SELECT 1 FROM gallery_groups gg
      WHERE gg.user_id = users.id AND gg.title = 'Sample Travel Photos'
  );

INSERT INTO chat_messages (sender_user_id, room_id, message_text)
SELECT id, 'support', 'Welcome. Use this chat for account, gallery, journal, or search support.'
FROM users
WHERE user_id = 'jaemin001'
  AND NOT EXISTS (SELECT 1 FROM chat_messages WHERE room_id = 'support');

INSERT INTO chat_messages (sender_user_id, room_id, message_text)
SELECT id, 'support', 'I need help saving a manually entered location.'
FROM users
WHERE user_id = 'traveler102'
  AND NOT EXISTS (SELECT 1 FROM chat_messages WHERE room_id = 'support' AND message_text = 'I need help saving a manually entered location.');

INSERT INTO moderation_items (item_type, title, reporter_name, reason)
SELECT 'Search result', 'Wrong place candidate reported', 'Mina Park', 'The returned city was close, but the exact landmark was incorrect.'
WHERE NOT EXISTS (SELECT 1 FROM moderation_items WHERE title = 'Wrong place candidate reported');

INSERT INTO moderation_items (item_type, title, reporter_name, reason)
SELECT 'Chat', 'Support request waiting', 'Mina Park', 'User asked why manual location input did not save.'
WHERE NOT EXISTS (SELECT 1 FROM moderation_items WHERE title = 'Support request waiting');
