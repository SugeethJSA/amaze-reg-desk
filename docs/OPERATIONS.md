# Operations Guide

## Before Event Day

1. Confirm PostgreSQL is reachable.
2. Confirm `server/.env` has real `DATABASE_URL`, `JWT_SECRET`, `QR_MASTER_SECRET`, and SMTP values.
3. Create the database with `npm run db:create -w server`.
4. Run migrations with `npm run db:migrate -w server`.
5. Create at least one admin account with `npm run db:seed-admin -w server`.
5. Import a small test Excel file.
6. Generate QR codes for test attendees.
7. Send a test email batch.
8. Test scanner login on the same phone models volunteers will use.
9. Create scan rules for entry, food, kit, and any custom checkpoints.
10. Dry run duplicate scan behavior.

## Excel Import Checklist

The first sheet should include columns that map to:

- Name
- Email
- Phone
- College
- Department
- External registration ID, if available

The importer accepts common variations such as `Name`, `Email Address`, `Mobile`, and `Department`.

Always preview before committing. The preview shows row numbers and validation errors.

## Registration Form Builder

Admins can create, edit, activate, deactivate, and delete on-spot registration fields from the Admin page. Use stable `field_key` values because attendee custom responses are stored under those keys in metadata.

Recommended field key examples:

- `workshop_track`
- `diet_preference`
- `team_name`
- `id_card_verified`

## QR Batch Sending

Recommended flow:

1. Generate a QR batch after import.
2. Send in `unsent` mode.
3. Review failed attempts.
4. Retry with `failed` mode if SMTP recovered.
5. Use CSV export fallback if SMTP is unavailable near event time.

## SMTP Failure Fallback

If email fails:

1. Download `/api/qr/export.csv`.
2. Share QR payloads manually through the event team’s chosen channel.
3. Keep the failed send attempts in the system for later audit.
4. Do not regenerate QR codes unless there is a security reason.

## Volunteer Scanner Setup

1. Admin creates volunteer accounts.
2. Volunteers log in from phone browsers.
3. Volunteers install the app from the browser menu when prompted or use “Add to Home screen”.
4. Volunteers select their assigned station.
5. Volunteers test one QR before gates open.
6. Volunteers keep the installed app or scanner page open during the event.
7. If internet drops, scans show pending sync.
8. Volunteers press sync when internet returns.

## Handling Duplicate Or Conflict Messages

- **Duplicate**: the attendee has already been accepted for the same station/rule.
- **Denied**: the QR is invalid, rule is inactive, or station context is wrong.
- **Conflict**: future reserved status for complex rule collisions.
- **Pending sync**: phone saved the scan locally and backend has not accepted it yet.

Volunteers should not override duplicate food or kit claims without an admin decision.

## Dashboard Use

The dashboard is meant for live operational decisions:

- Registration total confirms imported/on-spot volume.
- QR sent/unsent highlights communication gaps.
- Accepted scans indicate attendance.
- Food and kit counts help procurement teams.
- Duplicate and denied counts reveal scanning issues.

## End Of Event

1. Ensure every scanner sync queue is empty.
2. Export attendee and scan data if needed.
3. Disable volunteer accounts.
4. Back up PostgreSQL.
5. Record incidents and improvements for the next event.
