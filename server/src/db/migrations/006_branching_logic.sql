ALTER TABLE registration_form_fields 
ADD COLUMN IF NOT EXISTS depends_on_field TEXT,
ADD COLUMN IF NOT EXISTS depends_on_value TEXT;
