# Deployment Guide

Amaze Reg Desk is optimized for serverless deployment on Vercel with a managed PostgreSQL database via Supabase. 

## 1. Managed Database (Supabase)

1. Sign up for [Supabase](https://supabase.com).
2. Create a new Organization and Project.
3. Wait for the database to provision.
4. Navigate to **Project Settings -> Database**.
5. Locate the **Connection String (URI)**.
6. Make sure you use the connection string that supports connection pooling (port `6543`), or disable PgBouncer if deploying directly. Vercel Serverless Functions open many connections, so connection pooling is required for high traffic.
7. Note down the URI. It should look like:
   `postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require`

## 2. Setting up the Vercel Project

1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Log into [Vercel](https://vercel.com).
3. Click **Add New -> Project**.
4. Import your repository.
5. Vercel will automatically detect the settings based on `package.json` and `vercel.json`. 

## 3. Environment Variables

Before hitting "Deploy", expand the **Environment Variables** section and add the following keys:

- `DATABASE_URL`: Your Supabase connection string.
- `JWT_SECRET`: A long, random string (e.g. 64 random characters). Used for API auth.
- `QR_MASTER_SECRET`: Generate this by running `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. MUST be exactly 32-bytes base64 encoded. **Do not lose this** or previous QR codes will fail to decrypt.
- `APP_PUBLIC_URL`: The domain where your app will live (e.g., `https://my-event.vercel.app`). Do not include a trailing slash.
- `CORS_ORIGIN`: Same as `APP_PUBLIC_URL`.
- `SMTP_HOST`: E.g., `smtp.sendgrid.net`
- `SMTP_PORT`: E.g., `465` or `587`
- `SMTP_USER`: SMTP login username
- `SMTP_PASS`: SMTP login password
- `SMTP_FROM`: E.g., `"Amaze Team" <noreply@amaze.com>`

## 4. Deploy and Migrate

1. Hit **Deploy** on Vercel.
2. Wait for the deployment to finish.
3. Once deployed, the database is currently empty. You must run migrations.
4. Clone the repository locally, set up the `.env` with the production database URL, and run:
   ```bash
   cd server
   npm run db:migrate
   ```
5. Create your first admin user in the production database:
   ```bash
   ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD=ChangeMe123 npm run db:seed-admin
   ```

## 5. Security & Rate Limiting

To prevent abuse on public registration forms and endpoints:
- Use Vercel Edge Middleware or Upstash Redis to apply IP-based rate limiting to `/api/attendees/public-register` and `/api/attendees/public-transfer`.
- Supabase provides database-level protections, but since all traffic flows through your Express API, rate-limiting must occur at the Vercel level.
