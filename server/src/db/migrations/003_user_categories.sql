-- User Categories: reusable permission templates for volunteers
CREATE TABLE IF NOT EXISTS user_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#6366f1',
  station_permissions station_type[] NOT NULL DEFAULT ARRAY[]::station_type[],
  capabilities JSONB NOT NULL DEFAULT '{
    "can_scan": true,
    "can_verify": false,
    "can_register": false,
    "can_view_attendees": true,
    "can_export": false,
    "can_transfer": false
  }'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link users to categories
ALTER TABLE users ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES user_categories(id) ON DELETE SET NULL;

-- Index for fast user-by-category lookups
CREATE INDEX IF NOT EXISTS idx_users_category ON users(category_id);
