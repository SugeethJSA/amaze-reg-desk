ALTER TYPE form_field_type ADD VALUE IF NOT EXISTS 'hidden';
ALTER TYPE form_field_type ADD VALUE IF NOT EXISTS 'calculated';

ALTER TABLE registration_form_fields 
ADD COLUMN IF NOT EXISTS visibility_rules JSONB,
ADD COLUMN IF NOT EXISTS validations JSONB,
ADD COLUMN IF NOT EXISTS calculation TEXT;
