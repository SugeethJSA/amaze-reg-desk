# API Reference

Base URL: `/api`

All protected endpoints use:

```http
Authorization: Bearer <token>
```

Errors use:

```json
{
  "error": "machine_readable_code",
  "message": "Human-readable message."
}
```

## Authentication

### `POST /auth/login`

Request:

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

Response:

```json
{
  "token": "jwt",
  "qrDecryptKey": "base64-aes-key-for-authorized-offline-scanning",
  "user": {
    "id": "uuid",
    "name": "Admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### `GET /auth/me`

Returns the signed-in user.

### `POST /auth/users`

Admin-only. Creates admin or volunteer accounts.

### `GET /auth/users`

Admin-only. Lists users and available volunteer station scopes.

### `PUT /auth/users/:id`

Admin-only. Updates a user, active status, password, role, and volunteer scopes.

### `DELETE /auth/users/:id`

Admin-only. Deactivates a user and revokes volunteer scopes while preserving scan/audit history.

## Attendees

### `GET /attendees?q=search`

Returns up to 250 attendees matching name or email.

### `POST /attendees`

Admin-only. Creates or updates an on-spot attendee.

Request:

```json
{
  "name": "Student Name",
  "email": "student@example.com",
  "phone": "9999999999",
  "college": "Example College",
  "department": "CSE",
  "customFields": {
    "workshop_track": "Web"
  }
}
```

## Registration Form Fields

### `GET /form-fields`

Returns configured fields in display order.

### `POST /form-fields`

Admin-only. Creates a field.

```json
{
  "fieldKey": "workshop_track",
  "label": "Workshop Track",
  "fieldType": "select",
  "required": true,
  "options": ["Web", "Cybersecurity"],
  "sortOrder": 1,
  "active": true
}
```

### `PUT /form-fields/:id`

Admin-only. Updates a field using the same shape as create.

### `DELETE /form-fields/:id`

Admin-only. Deletes a field definition. Existing attendee metadata remains stored.

## Imports

### `POST /imports/preview`

Admin-only multipart form upload with `file`.

Returns row-level validation status.

### `POST /imports/commit`

Admin-only multipart form upload with `file`.

Upserts valid attendees and records an import batch.

## QR Codes

### `POST /qr/batches`

Admin-only. Generates encrypted QR codes for attendees who do not yet have QR records.

Request:

```json
{
  "name": "Main event batch"
}
```

### `POST /qr/send`

Admin-only. Sends QR emails.

Request:

```json
{
  "mode": "unsent",
  "batchId": "optional-uuid"
}
```

`mode` can be `unsent` or `failed`.

### `GET /qr/export.csv`

Admin-only. Downloads unsent QR payloads as CSV for manual sending fallback.

## Scan Sync

### `POST /scans/sync`

Volunteer/admin. Syncs online or offline scans.

Request:

```json
{
  "scans": [
    {
      "localScanId": "device-generated-uuid",
      "encryptedPayload": "v1.iv.tag.ciphertext",
      "payloadHash": "sha256",
      "station": "entry",
      "ruleId": "optional-rule-uuid",
      "scannedAt": "2026-05-29T10:30:00.000Z",
      "offlineCreated": false,
      "deviceId": "browser-device-id"
    }
  ]
}
```

Response:

```json
{
  "results": [
    {
      "localScanId": "device-generated-uuid",
      "status": "accepted",
      "reason": "Accepted."
    }
  ]
}
```

## Rules

### `GET /rules`

Returns configured scan rules.

### `POST /rules`

Admin-only. Creates a scan rule.

Request:

```json
{
  "name": "Lunch food claim",
  "station": "food",
  "startsAt": "2026-05-29T12:00:00.000Z",
  "endsAt": "2026-05-29T14:00:00.000Z",
  "eligibility": {},
  "active": true
}
```

## Dashboard

### `GET /stats/dashboard`

Returns registration, QR sending, scan, and station aggregates.

Also returns dashboard chart data:

- `scans.total` and `scans.pending`
- `stationTotals` for station distribution graphs
- `timeline` for hourly scan bars
- `customFieldBreakdowns` for active select/checkbox registration fields
