# Amaze Reg Desk

Amaze Reg Desk is a browser-based registration desk for college events. It imports pre-registration data from Excel, supports on-spot registration, generates encrypted QR codes, sends them in batches, lets volunteers scan from phones, and gives organizers live operational statistics.

The project is intentionally built as a web app instead of a native mobile app so volunteers can use whatever phone is available on event day. The scanner is PWA-friendly and queues scans locally when the network is weak.

## Features

- Excel `.xlsx` registration import with preview validation and duplicate detection.
- Editable registration form fields for collecting event-specific attendee details.
- On-spot attendee registration from the admin desk.
- PostgreSQL-backed event data, scan logs, QR batches, send attempts, rules, volunteer users, and audit logs.
- Encrypted QR payloads. QR codes do not expose plain attendee data.
- Volunteer accounts with station roles and revocable key metadata.
- SMTP batch sending with unsent-only and failed-resend workflows.
- CSV export fallback when email sending is unavailable during production.
- Mobile-browser QR scanner with offline queueing.
- Installable PWA shell for keeping the app on volunteer devices.
- Dynamic scan rules for entry, food, kit, and custom checkpoints.
- Conflict-resistant scan sync using local UUIDs, QR hashes, transactions, and database uniqueness constraints.
- Live dashboard statistics for registrations, sent QR codes, check-ins, resources, and conflicts.
- Verbose documentation for architecture, data model, QR security, APIs, operations, and testing.

## Repository Layout

```text
.
├── client/                 React + TypeScript frontend
├── server/                 Express + TypeScript API
├── docs/                   Product, architecture, data, security, API, ops, and testing docs
├── .env.example            Shared environment variable reference
└── package.json            Root workspace scripts
```

## Local Setup

Install dependencies from the repository root:

```bash
npm install
```

Create a PostgreSQL database:

```bash
npm run db:create -w server
```

Copy environment variables:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Run migrations:

```bash
npm run db:migrate -w server
```

Create the first admin:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=ChangeMe123! npm run db:seed-admin -w server
```

PowerShell:

```powershell
$env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="ChangeMe123!"; npm run db:seed-admin -w server
```

Start both apps:

```bash
npm run dev
```

The default frontend URL is `http://localhost:5173`. The backend API defaults to `http://localhost:4000/api`.

## Environment Variables

See [.env.example](.env.example) and [server/.env.example](server/.env.example).

Important values:

- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: secret for signed API sessions.
- `QR_MASTER_SECRET`: 32-byte base64 secret used to derive QR encryption keys.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: SMTP sending config.
- `APP_PUBLIC_URL`: public URL used in QR emails.
- `CORS_ORIGIN`: frontend origin allowed by the API.

## Basic Usage Flow

1. Admin logs in.
2. Admin imports Excel registration data or adds attendees on spot.
3. Admin generates a QR batch.
4. Admin sends unsent QR codes through SMTP or exports a CSV fallback.
5. Volunteers log in on phones and select the assigned station context.
6. Volunteers install/open the PWA and scan attendee QR codes. If offline, scans are queued locally.
7. Backend sync validates scan rules, prevents duplicate claims, and records audit logs.
8. Dashboard displays live registration, sending, scan, food, kit, and conflict statistics.

## Documentation

- [Product plan](docs/PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [QR security](docs/QR_SECURITY.md)
- [API reference](docs/API.md)
- [Operations guide](docs/OPERATIONS.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Testing guide](docs/TESTING.md)

## Development Commands

```bash
npm run dev              # run client and server together
npm run build            # build all workspaces
npm run test             # run all tests
npm run lint             # run all linters
npm run typecheck        # run TypeScript checks
```

Server-only:

```bash
npm run dev -w server
npm run db:create -w server
npm run db:migrate -w server
npm run db:seed-admin -w server
npm run test -w server
```

Client-only:

```bash
npm run dev -w client
npm run test -w client
```

## Current Implementation Notes

This repository contains the V1 implementation skeleton and feature code. Production deployment should still include real SMTP credentials, a managed PostgreSQL instance, HTTPS, monitored backups, and an event-day dry run with the actual volunteer devices.
