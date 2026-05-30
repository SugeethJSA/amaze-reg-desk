CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
  ('kit_limit', '1000'::jsonb, 'Maximum number of registration kits that can be deployed.'),
  ('food_limit', '1000'::jsonb, 'Maximum number of food tokens that can be deployed.')
ON CONFLICT (setting_key) DO NOTHING;
