# Architecture

## System Overview

Reg Desk is split into a React frontend, Express API, and PostgreSQL database. The browser is used for both admin operations and volunteer scanning. PostgreSQL remains the only source of truth for attendee records, QR code state, email attempts, rules, and scan events.

```mermaid
flowchart LR
  Admin["Admin browser"] --> API["Express API"]
  Volunteer["Volunteer phone browser"] --> API
  API --> DB["PostgreSQL"]
  API --> SMTP["SMTP server"]
  Admin --> Export["CSV fallback export"]
  Volunteer --> Cache["Local offline queue"]
  Cache --> API
```

## Frontend Responsibilities

The React frontend owns:

- Login/session UI.
- Admin import and registration screens.
- QR batch and sending controls.
- Volunteer scanner screen.
- Offline scan queue storage in browser local storage for V1.
- PWA manifest and service worker registration for installability and offline app-shell caching.
- Dashboard visualization and polling.

The frontend never becomes authoritative for scan acceptance. Even when it queues offline scans, final acceptance happens on the server during sync.

## Installable Offline Web App

The client includes a web app manifest and service worker. Browsers can install it to the home screen or desktop, and the service worker caches the application shell so volunteers can reopen the scanner screen during weak connectivity.

API writes are not cached by the service worker. Offline scan resilience is handled by the scanner queue, which stores pending scan payloads locally and syncs them when the backend becomes reachable.

## Backend Responsibilities

The Express API owns:

- Authentication and role enforcement.
- Excel parsing and import commit.
- Attendee creation and search.
- QR payload encryption and QR metadata storage.
- SMTP sending and send attempt logging.
- CSV fallback export.
- Scan rule evaluation.
- Scan idempotency and duplicate prevention.
- Dashboard aggregate endpoints.

## Database Responsibilities

PostgreSQL owns:

- Durable attendee and event state.
- Unique attendee email constraints.
- One QR code per attendee.
- Idempotent scan sync using `local_scan_id`.
- Duplicate resource prevention using partial unique constraints.
- Audit trail persistence.

## Import Flow

```mermaid
sequenceDiagram
  participant Admin
  participant Client
  participant API
  participant DB
  Admin->>Client: Upload Excel
  Client->>API: POST /imports/preview
  API-->>Client: Row-level validation result
  Admin->>Client: Commit accepted rows
  Client->>API: POST /imports/commit
  API->>DB: Upsert attendees and create import batch
  API-->>Client: Import summary
```

## QR Send Flow

```mermaid
sequenceDiagram
  participant Admin
  participant API
  participant DB
  participant SMTP
  Admin->>API: Generate QR batch
  API->>DB: Create encrypted payload per attendee
  Admin->>API: Send unsent QR codes
  API->>SMTP: Send email with QR image
  API->>DB: Log sent or failed attempt
  API-->>Admin: Batch result
```

## Scanner Flow

```mermaid
flowchart TD
  Scan["Volunteer scans QR"] --> Shape["Validate encrypted QR shape"]
  Shape --> Online{"Network online?"}
  Online -->|Yes| Sync["POST /scans/sync"]
  Online -->|No| Queue["Save scan locally"]
  Queue --> Retry["Sync when network returns"]
  Retry --> Sync
  Sync --> Rule["Resolve active rule"]
  Rule --> DBCheck["Database conflict checks"]
  DBCheck --> Result["accepted / duplicate / denied / conflict"]
```

## Realtime Statistics

V1 uses dashboard polling every few seconds. This avoids WebSocket deployment complexity while still giving organizers useful live visibility. Server-sent events or WebSockets can be added later without changing the underlying stats queries.
