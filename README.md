# Satsflow Backend API

Production-ready Node.js backend for **Satsflow** — a period tracking mobile app with Bitcoin Lightning Network rewards and community features.

---

## Features

- **Period Tracking** — Track cycles, periods, daily logs, and get phase predictions
- **Health Monitoring** — Log symptoms and moods with AES-256-GCM encryption at rest
- **Analytics** — Cycle insights, symptom patterns, and mood distributions
- **Manual JWT Auth** — bcrypt password hashing + short-lived access tokens + refresh token rotation
- **Data Encryption** — Sensitive health fields encrypted before DB storage
- **RESTful API** — Mobile-optimized endpoints with consistent JSON responses
- **PostgreSQL** — Direct `pg` pool, parameterized queries, schema migrations via `node-pg-migrate`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js 5 |
| Database | PostgreSQL 13+ (via `pg` pool) |
| Auth | JWT access + refresh tokens (`jsonwebtoken`) |
| Password hashing | `bcrypt` (12 rounds) |
| Migrations | `node-pg-migrate` |
| Validation | `express-validator` |
| Security | Helmet, CORS, rate limiting |
| Email | Nodemailer |

---

## Quick Start

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 13 or higher (running locally or remote)

### 1. Install dependencies

```bash
git clone https://github.com/Dada-Developers/SATSFLO-BACKEND.git
cd SATSFLO-BACKEND
npm install
```

### 2. Configure environment

```bash
cp .env.example .env   # then edit .env with your values
```

Required `.env` variables:

```env
# Server
NODE_ENV=development
PORT=3000

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=satsflow
DB_USER=satsflow_user
DB_PASSWORD=your_db_password
DB_SSL=false

# JWT — generate with: npm run generate-key
JWT_SECRET=your_32_char_minimum_secret
JWT_REFRESH_SECRET=another_32_char_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption — generate with: npm run generate-key
ENCRYPTION_KEY=your_64_char_hex_key

# Email (optional in development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# App
FRONTEND_URL=http://localhost:8081
```

### 3. Create the database

```bash
# As postgres superuser
psql -U postgres -c "CREATE USER satsflow_user WITH PASSWORD 'your_db_password';"
psql -U postgres -c "CREATE DATABASE satsflow OWNER satsflow_user;"
```

### 4. Run migrations

```bash
npm run migrate
```

### 5. (Optional) Seed test data

```bash
npm run seed
```

Test accounts created by seed:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@satsflow.com | Admin123! |
| User | test@satsflow.com | Test123! |
| Demo | demo@satsflow.com | Demo123! |

### 6. Start the server

```bash
npm run dev      # development (hot reload)
npm start        # production
```

---

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with nodemon hot reload |
| `npm start` | Start production server |
| `npm run migrate` | Run pending migrations (up) |
| `npm run migrate:down` | Roll back one migration |
| `npm run migrate:status` | Show migration status |
| `npm run migrate:create` | Scaffold a new migration file |
| `npm run seed` | Seed development data |
| `npm run generate-key` | Generate a random 32-byte hex key |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier |

---

## Project Structure

```
SATSFLO-BACKEND/
├── src/
│   ├── app.js                  # Express app setup (middleware, routes)
│   ├── server.js               # HTTP server + graceful shutdown
│   ├── config/
│   │   ├── db.js               # pg Pool configuration
│   │   ├── database.js         # Exports pool + table name constants
│   │   └── jwt.js              # JWT secret/expiry config
│   ├── controllers/
│   │   ├── auth/               # Register, login, refresh, forgot password
│   │   ├── cycle/              # Period tracking
│   │   ├── health/             # Symptoms & moods
│   │   └── user/               # Profile management
│   ├── middleware/
│   │   ├── auth.js             # JWT verification + role authorization
│   │   ├── errorHandler.js     # Global error handler
│   │   ├── rateLimiter.js      # Per-route rate limits
│   │   └── validator.js        # express-validator helper
│   ├── routes/                 # Route definitions per feature
│   ├── services/               # Business logic
│   │   ├── auth.service.js     # Register/login/token management
│   │   ├── cycle.service.js    # Cycle + period tracking
│   │   ├── health.service.js   # Symptoms + moods
│   │   ├── user.service.js     # Profile + health profile
│   │   ├── community.service.js
│   │   ├── journal.service.js
│   │   ├── dayLogs.service.js
│   │   ├── waterSettings.service.js
│   │   └── cycleProfile.service.js
│   ├── utils/
│   │   ├── constants.js        # Enums, defaults, limits
│   │   ├── encryption.js       # AES-256-GCM encrypt/decrypt
│   │   ├── logger.js           # Winston logger
│   │   └── response.js         # Standardised API response helpers
│   ├── validators/             # express-validator rule sets
│   └── database/
│       ├── migrations/         # node-pg-migrate migration files
│       └── seeds/              # Development seed data
└── .env                        # Local environment variables (git-ignored)
```

---

## API Overview

### Base URL

```
http://localhost:3000/api/v1
```

### Authentication

All protected endpoints require:

```
Authorization: Bearer <access_token>
```

When the access token expires, swap the refresh token:

```http
POST /api/v1/auth/refresh
{ "refreshToken": "eyJhbGci..." }
```

### Endpoint Summary

| Group | Endpoints |
|-------|-----------|
| Auth | register, login, logout, logout-all, refresh, verify-email, resend-verification, forgot-password, reset-password, change-password, me |
| Users | profile, health-profile, preferences, export, delete account |
| Cycle Profile | upsert, get with live calculations |
| Cycles | start, end, log daily, current, history, analytics, get/update/delete by id |
| Day Logs | get by date, upsert, get range |
| Health | log/batch/get/update/delete symptoms & moods, analytics, daily summary, trends |
| Journal | get by month, create entry |
| Water Settings | get, update |
| Community | threads, comments, likes, notifications |

See [API.md](./API.md) for the full reference with request/response examples.

---

## Auth Flow

```
Register  →  bcrypt.hash(password)  →  INSERT users  →  access + refresh JWT
Login     →  bcrypt.compare()       →  UPDATE last_login  →  access + refresh JWT
Request   →  jwt.verify(accessToken)  →  req.user attached
Refresh   →  verify refreshToken in DB  →  revoke old  →  issue new pair
Logout    →  SET revoked = true on refresh token
```

- Access tokens expire in `15m` by default
- Refresh tokens expire in `7d` and are rotated on every refresh
- All refresh tokens are revoked on password reset or `logout-all`

---

## Security

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt, 12 salt rounds |
| Health data encryption | AES-256-GCM, key from `ENCRYPTION_KEY` |
| JWT tokens | HS256, short-lived access + rotating refresh |
| SQL injection prevention | Parameterized queries (`$1`, `$2`, ...) via `pg` |
| Rate limiting | `express-rate-limit` per route group |
| Input validation | `express-validator` on every mutating endpoint |
| Security headers | `helmet` middleware |
| CORS | Configurable origin whitelist |

---

## Database Schema

The full schema is in `src/database/migrations/20260310000000_initial_schema.js`.

Key tables:

| Table | Purpose |
|-------|---------|
| `users` | Accounts, roles, email verification |
| `refresh_tokens` | JWT refresh token store |
| `password_resets` | Password reset tokens |
| `health_profiles` | Per-user health config (encrypted fields) |
| `cycles` | Menstrual cycle records |
| `cycle_logs` | Daily tracking entries |
| `cycle_profiles` | Simplified cycle widget |
| `symptoms` | Symptom logs with severity |
| `moods` | Mood logs with intensity |
| `day_logs` | General daily log (water, weight, temp) |
| `water_settings` | Water intake goal + cup config |
| `journal_entries` | Private diary entries |
| `threads` | Community posts |
| `thread_comments` | Post comments |
| `thread_likes` | Post likes (composite PK, no duplicates) |
| `notifications` | Auto-populated by DB triggers |
| `gift_transactions` | ⚡ Lightning sats tips (reserved) |
| `forums` | Forum categories (reserved) |

---

## For Dev 2 — Lightning / Community

Reserved tables already in schema:

- `gift_transactions` — Lightning sats tip between users
- `forums` — Forum categories with slug routing

Columns to extend for Lightning wallet integration:
- Add `wallets` table for user Lightning node info
- Add `rewards` table for earned sats tracking
- Add `messages` table for direct messaging

---

## License

MIT

## Support

Open an issue at [GitHub Issues](https://github.com/Dada-Developers/SATSFLO-BACKEND/issues).
