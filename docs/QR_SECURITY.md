# QR Security

## Security Goal

QR codes must not expose plain attendee data. Someone viewing the QR payload should not be able to read the attendee name, email, or registration identifier without authorized key material.

## Payload Format

V1 QR payloads use this shape:

```text
v1.<iv>.<authTag>.<ciphertext>
```

The ciphertext is AES-256-GCM encrypted JSON. The plaintext contains minimum operational fields such as attendee ID, name, email, issue time, and batch ID. The API stores a SHA-256 hash of the final encrypted payload for lookup.

## Encryption

The server derives an AES-256-GCM key from `QR_MASTER_SECRET`. The derived key encrypts QR payloads during generation and decrypts them when server-side inspection is needed.

For browser scanning, V1 gives the authenticated volunteer session a QR decrypt key after login. The scanner can decrypt the payload locally while offline, then stores the encrypted payload and hash for later sync. The final scan decision still happens on the server.

## Offline Behavior

Offline scans store:

- Local scan UUID.
- Encrypted QR payload.
- QR payload hash.
- Station context.
- Device ID.
- Scan timestamp.

The phone can decrypt QR details while offline, but it does not mark scans as finally accepted while offline. It displays pending sync state. When the connection returns, the queued scans are synced to the backend, which resolves rules and conflicts.

## Volunteer Keys

Volunteer accounts have associated key metadata:

- Station permissions.
- Public hint/label.
- Revocation timestamp.

In V1, the login response supplies authorized scanner key material to the browser session. The `volunteer_keys` table models station permissions and revocation metadata. A hardened deployment can extend this by encrypting station-specific QR data for volunteer-held public keys instead of using a shared event decrypt key.

## Revocation Limitations

Offline capability always has a revocation tradeoff. If a volunteer has already loaded scanner permissions and then loses internet, the server cannot instantly revoke that phone until it reconnects. For this reason:

- Final acceptance remains server-authoritative.
- Offline scans are pending, not final.
- Admins should revoke accounts before event gates open when possible.
- Volunteers should sync before changing station assignments.

## What QR Codes Do Not Do

- They do not store plain attendee data.
- They do not grant final access without backend verification.
- They do not bypass duplicate prevention.
- They do not replace volunteer authentication.
