# Testing Guide

## Backend Tests

Backend tests should cover:

- Excel import parsing and row validation.
- Duplicate email detection inside import files.
- Attendee upsert behavior.
- QR encryption and hashing.
- QR send selection for unsent and failed modes.
- SMTP failure logging.
- Rule evaluation for active, inactive, wrong-station, and time-window cases.
- Scan idempotency by `localScanId`.
- Duplicate prevention by QR/station/rule.
- Offline scan replay safety.

Run:

```bash
npm run test -w server
```

## Frontend Tests

Frontend tests should cover:

- Login form behavior.
- Admin Excel upload controls.
- On-spot registration form.
- QR batch buttons.
- Dashboard rendering with aggregate stats.
- Scanner payload validation.
- Offline queue add and flush behavior.
- PWA installability basics: manifest present, service worker registered, app shell reopens offline.
- Accepted, duplicate, denied, pending, and failed scanner states.

Run:

```bash
npm run test -w client
```

## End-To-End Manual Acceptance

Use this checklist before event deployment:

1. Start PostgreSQL.
2. Run migrations.
3. Create admin account.
4. Import a real-looking Excel file.
5. Preview catches invalid rows.
6. Commit creates attendee records.
7. On-spot registration creates or updates an attendee.
8. QR generation creates one QR per attendee.
9. QR payload does not expose plain attendee email.
10. SMTP sends at least one test QR.
11. CSV fallback downloads unsent QR rows.
12. Volunteer login works on phone browser.
13. Entry scan accepts first scan.
14. Entry duplicate scan returns duplicate.
15. Food scan accepts once and rejects duplicate food claim.
16. Offline scan queues locally when API is unavailable.
17. Sync sends queued scans when API returns.
18. Dashboard totals update after scans.

## Documentation Checks

Before release, compare:

- `.env.example` against `server/src/config.ts`.
- `docs/API.md` against Express routes.
- `docs/DATA_MODEL.md` against SQL migrations.
- `docs/OPERATIONS.md` against the real event-day flow.

Documentation is part of the deliverable. If behavior changes, update the docs in the same pull request.
