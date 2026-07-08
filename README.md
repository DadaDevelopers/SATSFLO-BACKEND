# SatsFlo Backend

REST API for SatsFlo — a menstrual health tracking app with Bitcoin Lightning tipping and partner sharing.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Database | PostgreSQL 15 via `pg` pool |
| Auth | JWT (access + refresh) + Google OAuth |
| Email | Resend SDK (HTTP — SMTP blocked on Render) |
| Lightning | Blink GraphQL API |
| File Uploads | Cloudinary |
| Migrations | node-pg-migrate |
| Tests | Jest + Supertest |

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- A [Resend](https://resend.com) API key (for emails)

## Local Setup

```bash
git clone git@github.com:DadaDevelopers/SATSFLO-BACKEND.git
cd SATSFLO-BACKEND
npm install
cp .env.example .env      # fill in values (see below)
npm run migrate           # apply all migrations
npm run seed              # optional: load test data
npm run dev               # starts on http://localhost:3000
```

## Environment Variables

Copy `.env.example` and fill in the required values. The minimum set to run locally:

```
# Server
NODE_ENV=development
PORT=3000

# Database (choose one approach)
DATABASE_URL=postgresql://user:pass@localhost:5432/satsflo
# OR individual vars
DB_HOST=localhost
DB_PORT=5432
DB_NAME=satsflo
DB_USER=satsflo
DB_PASSWORD=secret
DB_SSL=false

# JWT (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=<64-char hex>
JWT_REFRESH_SECRET=<64-char hex>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email
RESEND_API_KEY=re_...
FROM_EMAIL=info@satsflo.app

# Encryption
ENCRYPTION_KEY=<64-char hex>  # npm run generate-key

# Google OAuth (for Sign in with Google)
GOOGLE_CLIENT_ID=...
```

Optional services (Lightning, Cloudinary, Firebase) can be left unset — those features return 503 when unconfigured.

## Useful Commands

```bash
npm run dev              # Development server with hot-reload
npm run migrate          # Apply pending migrations
npm run migrate:down     # Roll back last migration
npm run seed             # Seed test accounts
npm test                 # Run full test suite
npm run test:coverage    # Coverage report
npm run lint             # ESLint check
npm run format           # Prettier format
npm run generate-key     # Generate an ENCRYPTION_KEY
```

## Health Check

```
GET /health
```

Returns database connectivity status and uptime.

## Further Reading

| Doc | Contents |
|-----|----------|
| [API.md](./API.md) | All endpoints, request/response shapes |
| [docs/PAYMENTS.md](./docs/PAYMENTS.md) | Lightning payment flow in detail |
| [TESTING.md](./TESTING.md) | Test suite, how to run, what's covered |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design, DB schema, request lifecycle |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Render setup, env vars, migrations |
| [docs/SECURITY.md](./docs/SECURITY.md) | Auth flow, rate limiting, security headers |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Git workflow, commit style, PR process |
