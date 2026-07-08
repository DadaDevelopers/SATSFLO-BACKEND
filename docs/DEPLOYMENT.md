# Deployment

## Platform

The backend is deployed on [Render](https://render.com) as a Web Service connected to a managed PostgreSQL instance.

## Build & Start

| Setting | Value |
|---------|-------|
| Build Command | `npm install && npm run migrate` |
| Start Command | `npm start` |
| Runtime | Node 20 |
| Health Check | `GET /health` |

`npm run migrate` runs all pending node-pg-migrate migrations before the server starts. This is safe on every deploy — applied migrations are skipped.

## Environment Variables

Set these in the Render dashboard → Environment.

### Required

| Variable | Example | Notes |
|----------|---------|-------|
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | `postgresql://...` | Render provides this automatically for managed Postgres |
| `JWT_SECRET` | 64-char hex | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | 64-char hex | different from JWT_SECRET |
| `ENCRYPTION_KEY` | 64-char hex | `npm run generate-key` |
| `RESEND_API_KEY` | `re_...` | from resend.com — SMTP is blocked on Render |
| `FROM_EMAIL` | `info@satsflo.app` | must be a verified sender in Resend |
| `FRONTEND_URL` | `https://satsflo.app` | used in CORS and email links |
| `API_BASE_URL` | `https://satsflo-backend.onrender.com/api/v1` | |
| `VERIFICATION_BASE_URL` | `https://satsflo-backend.onrender.com/api/v1` | base for email verification links |

### Optional — Lightning (Blink)

| Variable | Notes |
|----------|-------|
| `BLINK_API_KEY` | required for Lightning wallet features |
| `BLINK_BTC_WALLET_ID` | required for Lightning wallet features |
| `BLINK_API_URL` | default: `https://api.blink.sv/graphql` |
| `BLINK_API_TIMEOUT_MS` | default: `10000` |
| `WEBHOOK_SECRET` | validates `x-webhook-secret` header on `/payments/webhook` |

### Optional — File Uploads (Cloudinary)

| Variable | Notes |
|----------|-------|
| `CLOUDINARY_CLOUD_NAME` | required for avatar and journal image uploads |
| `CLOUDINARY_API_KEY` | |
| `CLOUDINARY_API_SECRET` | |

### Optional — Push Notifications (Firebase)

| Variable | Notes |
|----------|-------|
| `FIREBASE_PROJECT_ID` | |
| `FIREBASE_CLIENT_EMAIL` | |
| `FIREBASE_PRIVATE_KEY` | multiline — use Render secret files or paste with `\n` |

### Optional — Google OAuth

| Variable | Notes |
|----------|-------|
| `GOOGLE_CLIENT_ID` | required for `POST /auth/google` |

### Optional — Tuning

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3000` | Render overrides this automatically |
| `JWT_EXPIRES_IN` | `15m` | access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | refresh token lifetime |
| `ALLOWED_ORIGINS` | `*` | comma-separated; set to your frontend domain in production |
| `RATE_LIMIT_WINDOW` | `15` | minutes |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | requests per window |
| `DB_SSL` | auto in production | set `false` for local dev |
| `DB_CONNECTION_TIMEOUT` | `10000` | ms |

## First-Time Setup on Render

1. Create a **PostgreSQL** database on Render — it will provide a `DATABASE_URL`.
2. Create a **Web Service** pointing at this repo.
3. Set environment variables listed above.
4. Set Build Command to `npm install && npm run migrate`.
5. Deploy — Render runs the build command then starts the server.

## Database Migrations

Migrations run automatically on every deploy (build command). To run manually:

```bash
npm run migrate          # apply all pending
npm run migrate:down     # roll back one
npm run migrate:status   # list applied vs pending
```

Migration files live in `src/database/migrations/`. Always implement `exports.down` for every migration.

## Seeding (Development / Staging Only)

```bash
npm run seed
```

Creates three test accounts:

| Email | Password | Role |
|-------|----------|------|
| admin@satsflow.com | Admin123! | admin |
| test@satsflow.com | Test123! | user |
| demo@satsflow.com | Demo123! | user |

**Never run seed on production.**

## Important Render Notes

- `app.set('trust proxy', 1)` is set in `src/app.js` — required so the rate limiter reads the real client IP from `X-Forwarded-For` rather than the load balancer IP.
- Render blocks outbound SMTP. Email is sent via the Resend HTTP API — do not switch to nodemailer/SMTP.
- Render free tier spins down after inactivity. The `/health` endpoint can be pinged by an uptime monitor to keep the instance warm.

## Health Check

```
GET /health
```

Returns:
```json
{
  "status": "ok",
  "database": "connected",
  "uptime": 3600
}
```

Returns 500 if the database is unreachable.

## Graceful Shutdown

The server handles `SIGTERM` and `SIGINT`:

1. Stop accepting new connections
2. Close the pg pool
3. Exit (30 s hard timeout)

Render sends `SIGTERM` before restarting — in-flight requests have time to complete.

## Logs

Structured JSON logs are written to:
- `logs/app.log` — all levels
- `logs/error.log` — errors only
- `logs/access.log` — HTTP requests

On Render, stdout/stderr are streamed to the Render log viewer. The `logs/` directory is ephemeral (lost on redeploy) — use the Render log viewer for production debugging.
