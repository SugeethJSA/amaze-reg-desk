ALTER TABLE registration_form_fields 
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- Insert default system fields if they don't exist
INSERT INTO registration_form_fields (field_key, label, field_type, required, sort_order, active, show_in_list, is_system)
VALUES 
  ('name', 'Full Name', 'text', TRUE, 1, TRUE, TRUE, TRUE),
  ('email', 'Email Address', 'email', TRUE, 2, TRUE, TRUE, TRUE),
  ('phone', 'Phone Number', 'phone', FALSE, 3, TRUE, TRUE, TRUE),
  ('college', 'Club Name / Institution', 'text', FALSE, 4, TRUE, TRUE, TRUE),
  ('department', 'Booking ID / Area Code', 'text', FALSE, 5, TRUE, TRUE, TRUE)
ON CONFLICT (field_key) DO UPDATE 
SET is_system = TRUE;
