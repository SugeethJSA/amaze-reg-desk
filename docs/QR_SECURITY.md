# QR Code Security & Workflows

Amaze Reg Desk utilizes a zero-knowledge QR payload design to prevent unauthorized data scraping and duplication.

## Threat Model

1. **Attendee data leak**: If an attendee's QR code is intercepted, the attacker should not be able to read personal information (Name, Email, Phone, Custom Fields).
2. **QR Forgery**: An attacker should not be able to generate a valid QR code without database access.
3. **Ticket Duplication**: If an attendee shares their QR code, the system must enforce usage rules to prevent multi-entry.

## Defenses

### 1. AES-256-GCM Encryption
Instead of embedding raw JSON or UUIDs in the QR code, the backend constructs a minimal payload (e.g. `{ "id": "uuid-here" }`) and encrypts it using `AES-256-GCM`.
- The encryption key is derived using a globally configured `QR_MASTER_SECRET`.
- The resulting payload includes the Initialization Vector (IV), Ciphertext, and Authentication Tag.
- The volunteer scanner app simply reads the base64 string and forwards it to the backend. The backend decrypts it. The scanner app never holds the decryption keys.

### 2. Conflict-Resistant Syncing
When a QR code is scanned:
1. The scanner generates a `client_id` (a local UUID) for the scan event.
2. The scanner sends `{ qrData, stationId, timestamp, clientId }` to `/api/scans/sync`.
3. The backend decrypts `qrData` to get the `attendeeId`.
4. The backend evaluates the `scan_rules` for the given `stationId`.
5. If the rule prohibits multiple scans, the backend checks for existing accepted scans for this attendee and station.
6. The database relies on a `UNIQUE(client_id)` constraint on `scan_events` to gracefully handle network retries (idempotency).

### 3. Dynamic QR Dispatch
QR codes are not stored as images on the server. They are generated in memory and embedded directly into the email body as inline attachments (CIDs).
- The `{{qr_code_image}}` tag in the Email Template is dynamically replaced with an `img src="cid:qrcode"` pointing to the generated attachment.
- This ensures QR codes are never publicly accessible via a URL.
