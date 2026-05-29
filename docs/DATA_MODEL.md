# Data Model

## Core Entities

### `users`

Stores admin and volunteer accounts. Admins can import data, configure rules, and send QR batches. Volunteers scan QR codes from mobile browsers.

Important fields:

- `role`: `admin` or `volunteer`.
- `active`: disables accounts without deleting audit history.

### `volunteer_keys`

Stores volunteer key metadata and station permissions. V1 uses a shared server-side QR encryption secret, but the table models key lifecycle and revocation so role-scoped key distribution can be hardened over time.

Important fields:

- `station_permissions`: allowed station types.
- `revoked_at`: disables a volunteer key.

### `attendees`

Stores imported and on-spot registrations.

Important fields:

- `email`: unique attendee identity in V1.
- `registered_on_spot`: distinguishes manual registrations.
- `metadata`: stores import context or future custom fields.

### `import_batches`

Records Excel imports and summary counts.

### `qr_batches`

Groups generated QR codes for sending and auditing.

### `qr_codes`

Stores encrypted QR payloads.

Important fields:

- `encrypted_payload`: QR content shown to attendee.
- `payload_hash`: stable SHA-256 hash used for lookup and conflict checks.
- `sent_at`: marks successful delivery.
- Unique `attendee_id`: one active QR code per attendee in V1.

### `email_send_attempts`

Logs every SMTP attempt and failed fallback condition.

Important fields:

- `status`: `pending`, `sent`, `failed`, or `exported`.
- `error_message`: operational reason for failure.

### `scan_rules`

Defines station behavior.

Rule examples:

- Entry check-in from 09:00 to 10:30.
- Food claim during lunch window.
- Kit collection from a custom desk.

### `scan_events`

Records every scan result.

Important constraints:

- Unique `local_scan_id` makes offline sync idempotent.
- Partial unique constraint on `(qr_payload_hash, station, rule_id)` for accepted scans prevents duplicate claims for the same station/rule.

### `offline_sync_records`

Tracks queued scan sync results by device and local scan ID.

### `audit_logs`

Captures administrative and operational actions for later review.

## Conflict Prevention

Reg Desk prevents duplicate and conflicting actions in layers:

1. The browser creates a unique `localScanId` for every scan.
2. The API rejects or reuses previously synced `localScanId` values.
3. The API looks up QR codes by `payload_hash`.
4. PostgreSQL prevents multiple accepted scans for the same QR/station/rule.
5. The API records duplicate attempts instead of silently dropping them.

This makes retrying offline scans safe. A volunteer can press sync again without accidentally creating multiple accepted claims.
