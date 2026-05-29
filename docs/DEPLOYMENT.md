# Deployment Guide

## Recommended V1 Deployment

Use a conventional web deployment:

- Managed PostgreSQL database.
- Express API hosted on a Node-capable server.
- React client built as static assets and served through a CDN or the same host.
- HTTPS enabled for both frontend and backend.
- SMTP account verified before event day.

## Required Environment

Backend:

```text
DATABASE_URL
JWT_SECRET
QR_MASTER_SECRET
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM
APP_PUBLIC_URL
API_PORT
CORS_ORIGIN
```

Frontend:

```text
VITE_API_URL
```

## Build

```bash
npm install
npm run build
```

Backend output is generated in `server/dist`. Frontend output is generated in `client/dist`.

## Database Release Steps

1. Back up the database.
2. Deploy backend code.
3. Run `npm run db:migrate -w server`.
4. Run a health check against `/health`.
5. Log in as admin.
6. Test one import, one QR generation, and one scan before opening registrations.

## Security Checklist

- Use long random values for `JWT_SECRET` and `QR_MASTER_SECRET`.
- Rotate `QR_MASTER_SECRET` between major events if old QR codes should become invalid.
- Serve over HTTPS so camera access works reliably on phones.
- Restrict database network access to the backend host.
- Disable volunteer accounts after the event.
- Keep PostgreSQL backups until attendance reconciliation is complete.

## Operational Monitoring

At minimum, watch:

- API process uptime.
- PostgreSQL connectivity.
- SMTP send failures.
- Duplicate/denied scan spikes.
- Offline sync queue reports from volunteers.

## Rollback

For V1, rollback is application-level:

1. Stop new imports and QR sends.
2. Revert backend/frontend deployment.
3. Keep PostgreSQL data intact.
4. Use CSV exports if SMTP or app hosting is unavailable.

Do not drop or reset the database during an event. The scan and send logs are operational evidence.
