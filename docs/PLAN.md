# Reg Desk V1 Product Plan

## Goal

Reg Desk V1 gives an event team a reliable registration workflow from imported attendee data to live check-in statistics. The system must be simple enough for college club contributors to maintain, but strong enough to survive event-day realities: weak internet, last-minute registrations, duplicate scans, QR email failures, and multiple volunteers scanning at once.

## V1 Scope

- Browser-based admin and volunteer experience.
- PostgreSQL as the authoritative event database.
- Excel import and on-spot registration.
- Encrypted QR generation.
- SMTP QR delivery with CSV export fallback.
- Mobile-browser QR scanning.
- Offline scan queue with later sync.
- Dynamic rules for entry, food, kit, and custom checkpoints.
- Live operational dashboard.
- Documentation-first project structure.

## Out Of Scope For V1

- Native Android/iOS scanner app.
- Biometric identity verification.
- Payment collection.
- Multi-event tenant administration.
- Fully automated WhatsApp delivery.
- Complex visual form builder.

These are intentionally deferred so the first version can be deployed and tested quickly.

## Primary User Roles

- **Admin**: imports data, registers attendees, generates QR codes, sends batches, manages volunteers, configures rules, watches dashboard stats.
- **Volunteer**: logs in from a phone, selects or receives a station context, scans QR codes, sees immediate accepted/duplicate/denied/conflict feedback.
- **Organizer**: watches aggregate statistics and handles operational decisions such as food counts or kit stock.

## Success Criteria

- A team can import an Excel file and see validation errors before committing data.
- An attendee can be registered on spot and receive a QR code.
- QR codes do not contain readable attendee data.
- Volunteers can scan from a browser without installing an app.
- Offline scans are not lost.
- Duplicate entry, food, or kit claims are prevented.
- Admins can export QR data if SMTP breaks.
- Dashboard counts are accurate enough for live event decisions.

## Future Enhancements

- Native mobile scanner app using the same scan sync API.
- WhatsApp provider integration.
- Role-specific dashboards.
- Multi-event support.
- Configurable registration forms.
- Richer eligibility rules for workshops, tracks, and paid add-ons.
- Admin UI for key rotation and emergency revocation.
