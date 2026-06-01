# Data Model

The data layer uses PostgreSQL, relying on `JSONB` for extensibility where strict schema bindings are unnecessary (such as dynamically generated form fields).

## Schema Overview

### `system_settings`
Global key-value configuration.
- `setting_key` (TEXT PK): e.g. `app_name`, `primary_color`, `public_registrations_enabled`.
- `setting_value` (TEXT): The stored string configuration.

### `form_fields`
Powers the dynamic form builder.
- `id` (UUID PK)
- `field_key` (TEXT UNIQUE): Used to map to `attendees.metadata`.
- `label`, `field_type`, `options`, `required`, `active`, `show_in_list`
- `order_index` (INT)

### `user_categories`
Roles/Groups for volunteers.
- `id` (UUID PK)
- `name` (TEXT)
- `color` (TEXT): For UI badges.
- `stations` (TEXT): Comma-separated list of scopes (e.g. `entry,food`).

### `users`
Administrators and Volunteers.
- `id` (UUID PK)
- `email` (TEXT UNIQUE)
- `password_hash` (TEXT)
- `role` (TEXT): `admin` or `volunteer`
- `category_id` (UUID FK): Links to `user_categories`.
- `stations` (TEXT): Optional override scopes for the user.

### `attendees`
Event attendees.
- `id` (UUID PK)
- `name`, `email` (UNIQUE), `phone`, `college`, `department`
- `metadata` (JSONB): Core extensibility node. Holds custom dynamic fields from `form_fields`, `verificationStatus` (pending/approved), `paymentProof` (base64 image), and `transferredFrom` (UUID).
- `registered_on_spot` (BOOLEAN)

### `qr_codes`
Encrypted QR codes tied to attendees.
- `id` (UUID PK)
- `attendee_id` (UUID FK)
- `payload_iv` (TEXT): Base64 initialization vector for AES.
- `payload_data` (TEXT): Base64 encrypted cipher text.
- `payload_auth_tag` (TEXT): Base64 auth tag.
- `batch_id` (UUID): Used for grouped email campaigns.
- `sent_at` (TIMESTAMPTZ): Marks successful dispatch.

### `scan_rules`
Operational rules enforced by scanners.
- `id` (UUID PK)
- `station_id` (TEXT): e.g. `entry` or `day-1-food`.
- `allow_multiple` (BOOLEAN): Can they scan twice?
- `allowed_categories` (TEXT[]): Optional group restrictions.

### `scan_events`
Immutable audit log of all scans.
- `id` (UUID PK)
- `qr_code_id` (UUID FK)
- `volunteer_id` (UUID FK)
- `station_id` (TEXT)
- `client_timestamp` (TIMESTAMPTZ)
- `status` (TEXT): `accepted` or `denied`
- `client_id` (TEXT UNIQUE): Prevents duplicate syncs.
