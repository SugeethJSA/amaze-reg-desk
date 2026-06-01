# API Reference

The backend Express application exposes a RESTful API under `/api`. All requests (except public endpoints) require a Bearer token in the `Authorization` header.

## Authentication

- `POST /api/auth/login`: Authenticate and receive a JWT.
- `GET /api/auth/me`: Validate JWT and return current user.

## Attendees

- `GET /api/attendees`: Fetch all attendees (Admin only).
- `POST /api/attendees`: Create an on-spot attendee.
- `PUT /api/attendees/:id`: Update an attendee.
- `DELETE /api/attendees/:id`: Delete an attendee.
- `POST /api/attendees/upload`: Batch upload via Excel.

### Public Attendees
- `POST /api/attendees/public-register`: Submit a public registration for verification.
- `POST /api/attendees/public-transfer`: Submit a ticket transfer request.
- `POST /api/attendees/:id/verify`: Approve or Reject a pending request (Admin only).

## QR Codes & Emails

- `POST /api/qr/batch-generate`: Generate encrypted QR codes for missing attendees.
- `POST /api/qr/send`: Trigger SMTP sending for a batch or specific mode (`unsent`, `failed`).
- `GET /api/qr/export-csv`: Download QR data as CSV for fallback external mailing.

## Form Fields

- `GET /api/form-fields`: Get all fields (Admin).
- `GET /api/form-fields/public`: Get active fields (Public, no auth).
- `POST /api/form-fields`: Create field.
- `PUT /api/form-fields/:id`: Update field.
- `DELETE /api/form-fields/:id`: Delete field.

## Settings & Branding

- `GET /api/settings`: Get global settings (Public, no auth).
- `PUT /api/settings`: Update settings (Admin only).

## Users & Categories

- `GET /api/users`: List users (Admin).
- `POST /api/users`: Create user (Admin).
- `PUT /api/users/:id`: Update user (Admin).
- `DELETE /api/users/:id`: Delete user (Admin).
- `GET /api/categories`: List categories (Admin).
- `POST /api/categories`: Create category.
- `PUT /api/categories/:id`: Update category.
- `DELETE /api/categories/:id`: Delete category.

## Scans & Rules

- `GET /api/rules`: List rules.
- `POST /api/rules`: Create rule.
- `PUT /api/rules/:id`: Update rule.
- `DELETE /api/rules/:id`: Delete rule.
- `POST /api/scans/sync`: Sync offline scan queue. Idempotent.
- `GET /api/scans`: Get live scan history log (Admin only).
