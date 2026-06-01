# Amaze Reg Desk

Amaze Reg Desk is a fully-featured, white-labeled, browser-based registration desk and ticketing platform built for college events. It supports dynamic form building, public registrations, ticket transfers, PWA offline scanning, encrypted QR codes, granular volunteer access control, and live operational statistics.

## Key Features

1. **White-Labeling & Branding Engine**
   - Configure global App Name, Event Name, Logo, and Primary Theme Color via the Admin Dashboard.
   - Instantly propagates across public registration, login, and ticket transfer pages.
   
2. **Dynamic Form Builder**
   - Create custom text, number, select, and checkbox fields.
   - Packaged automatically into PostgreSQL `JSONB` metadata columns for attendees.
   - Configurable per field: Required, Show in List, Active.

3. **Public Registrations & Transfers**
   - Self-applied registrations with payment proof uploads.
   - Secure peer-to-peer ticket transfers verified by staff.
   - A dedicated **Verification Queue** in the admin desk to approve or reject pending requests.

4. **Advanced QR Operations & Security**
   - Payloads encrypted with `AES-256-GCM` using a master secret.
   - Emailed to attendees via SMTP using a dynamic templating engine (supporting `{{name}}`, `{{department}}`, custom fields).
   - Installable PWA scanner for volunteers (works offline using Service Worker caching).
   
5. **Granular Role-Based Access Control (RBAC)**
   - Create Volunteer Roles (Categories) that bind to specific station scopes.
   - Individual Volunteer overrides for specific scanning stations.

6. **Real-Time Audit & Analytics**
   - Live Scan History Panel showing real-time accepted/rejected scans.
   - Advanced Rule Engine (e.g., allow 1 "food" scan, unlimited "entry" scans).

## Architecture

- **Frontend**: React 19, TypeScript, Vite, React Router.
- **Backend**: Express, Node.js, `pg` (PostgreSQL).
- **Database**: Supabase / PostgreSQL.
- **Deployment**: Vercel (both client and server via Serverless functions).

## Deployment Guide (Vercel + Supabase)

### 1. Database Setup (Supabase)
1. Create a new Supabase project.
2. Go to **Project Settings -> Database** and copy the Connection String (URI). Ensure it ends with `?sslmode=require`.
3. In your local repository, copy the env files:
   ```bash
   cp .env.example .env
   cp server/.env.example server/.env
   ```
4. Set `DATABASE_URL` in `server/.env`.
5. Run migrations:
   ```bash
   cd server && npm run db:migrate
   ```
6. Seed the initial admin account:
   ```bash
   ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD=SecurePassword123 npm run db:seed-admin
   ```

### 2. Vercel Deployment
1. Import the repository into Vercel.
2. Vercel will automatically detect the monorepo.
3. Configure the **Environment Variables** in the Vercel Dashboard:
   - `DATABASE_URL`: Your Supabase connection string
   - `JWT_SECRET`: A random 32+ character string
   - `QR_MASTER_SECRET`: A 32-byte base64 encoded string
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: Your email provider credentials
   - `APP_PUBLIC_URL`: The production URL of your Vercel deployment (e.g., `https://amaze-reg-desk.vercel.app`)
4. The included `vercel.json` automatically configures the serverless functions (`server/src/index.ts`) and single-page app static routing.
5. Hit **Deploy**. 

### 3. Progressive Web App (PWA)
Once deployed, volunteers can open the Vercel link on Safari (iOS) or Chrome (Android) and select **"Add to Home Screen"**. The app comes pre-configured with a caching Service Worker (`sw.js`) and required meta tags for seamless native-app-like installation.

## Local Development

```bash
# Install all dependencies
npm install

# Start both frontend and backend concurrently
npm run dev
```

Visit `http://localhost:5173` to view the app. The API runs on `http://localhost:4000`.

## Documentation Hierarchy

- [Product plan](docs/PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [QR security](docs/QR_SECURITY.md)
- [API reference](docs/API.md)
- [Operations guide](docs/OPERATIONS.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Testing guide](docs/TESTING.md)
