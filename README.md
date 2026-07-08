# SatsFlo Backend

Period tracking with Bitcoin Lightning rewards.

Node.js · Express · PostgreSQL · JWT Auth · LNURL-pay · Resend Email

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Database & Migrations](#database--migrations)
7. [Authentication Flow](#authentication-flow)
8. [Payment Flow](#payment-flow)
9. [API Reference](#api-reference)
10. [Route Registration](#route-registration)

---

## Overview

SatsFlo is a menstrual health tracking app that rewards users with Bitcoin (sats) for logging consistently. The backend provides REST API endpoints for:

- User auth (register, login, forgot-password OTP flow, password reset)
- Cycle tracking (profiles, logs, phases, predictions)
- Daily health logging (symptoms, moods, water, journal)
- Community (threads, comments, likes, notifications)
- Direct messaging (1-to-1 chats and group chats)
- Partner system (paired cycle viewing with granular sharing permissions)
- Bitcoin Lightning tips via LNURL-pay protocol
- Wallet management (save / retrieve Lightning address)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥ 18 |
| Framework | Express 5 |
| Database | PostgreSQL 14+ |
| ORM/Query | `pg` (raw parameterised SQL) |
| Migrations | `node-pg-migrate` |
| Auth | `bcrypt` + `jsonwebtoken` (access + refresh tokens) |
| Email | Resend SDK (HTTP — SMTP is blocked on Render) |
| File uploads | `multer` (memory storage → base64 data URLs) |
| Lightning | LNURL-pay protocol + `bolt11` decoder + `bech32` |
| HTTP client | `axios` |
| Validation | `express-validator` |
| Security | `helmet`, `cors`, `express-rate-limit` |

---

## Project Structure

```
src/
├── app.js                        # Express app setup, middleware, CORS
├── server.js                     # HTTP server entry point
├── config/
│   ├── database.js               # Exports { pool }
│   ├── db.js                     # pg Pool (DATABASE_URL or individual vars)
│   └── jwt.js                    # JWT secret / expiry config
├── routes/
│   ├── index.js                  # Central router — mounts all route modules
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── cycle.routes.js
│   ├── cycleProfile.routes.js
│   ├── dayLogs.routes.js
│   ├── waterSettings.routes.js
│   ├── health.routes.js
│   ├── journal.routes.js
│   ├── community.routes.js       # /threads + /notifications
│   ├── payment.routes.js
│   ├── lightning.routes.js       # Blink wallet integration
│   ├── wallet.routes.js          # GET/PUT /wallet/lightning
│   ├── partner.routes.js
│   ├── chat.routes.js
│   └── group.routes.js
├── controllers/                  # HTTP handlers (thin layer)
├── services/                     # Business logic
├── middleware/
│   ├── auth.js                   # authenticateToken, optionalAuth
│   └── validator.js              # express-validator error formatter
├── validators/                   # Per-route validation rules
├── utils/
│   ├── response.js               # ApiResponse helpers
│   └── logger.js
└── database/
    ├── migrations/               # node-pg-migrate files (timestamp-prefixed)
    └── seeds/
```

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in values
cp .env.example .env

# 3. Run database migrations
npm run migrate

# 4. (Optional) Seed initial data
npm run seed

# 5. Start dev server with auto-reload
npm run dev

# 6. Start production server
npm start
```

---

## Environment Variables

```env
# ── Server ────────────────────────────────────────────────────
NODE_ENV=development
PORT=3000
API_VERSION=v1

# ── Database ──────────────────────────────────────────────────
# Option A: connection string (Render, Railway, etc.)
DATABASE_URL=postgres://user:pass@host:5432/dbname

# Option B: individual vars (local dev)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=satsflow
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=false               # set to true in production

# ── JWT ───────────────────────────────────────────────────────
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# ── Email (Resend SMTP) ───────────────────────────────────────
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
# From: SatsFlo <info@satsflo.app>

# ── App links ─────────────────────────────────────────────────
APP_URL=https://satsflo.app        # base URL for partner invite share links (invite?code=XXXXXX)
DEEP_LINK_URL=satsflo://           # mobile deep link prefix
FRONTEND_URL=https://satsflo.app   # fallback for email links

# ── Payments ──────────────────────────────────────────────────
WEBHOOK_SECRET=your_webhook_secret  # validates /payments/webhook calls

# ── CORS ──────────────────────────────────────────────────────
ALLOWED_ORIGINS=*                   # comma-separated origins, or * for all
```

> **SSL:** Enabled automatically when `NODE_ENV=production` or `DB_SSL=true`.
> On Render, use `DATABASE_URL` — SSL is handled automatically.

---

## Database & Migrations

```bash
npm run migrate        # apply all pending migrations
npm run migrate:down   # roll back last migration
```

| Migration | Description |
|-----------|-------------|
| `20260310000000_initial_schema` | Core tables: users, cycles, symptoms, moods, threads, notifications, gift_transactions |
| `20260316000000_payments_otp` | OTP columns on users; bolt11_invoice, payment_hash, note, expires_at on gift_transactions |
| `20260318000000_profile_wallet` | users.phone, cycle_profiles.luteal_phase_length + ignore_irregular_cycle |
| `20260318000001_partner_system` | partner_invites, partnerships |
| `20260318000002_chats_groups` | conversations, direct_messages, typing_indicators, groups, group_members, group_messages |
| `20260319000000_gift_transactions_fix` | receiver_id → nullable, add lightning_address column |
| `20260319000001_lightning_blink_foundation` | lightning_wallets, lightning_transactions (Blink provider) |
| `20260319000002_lightning_payment_methods` | payment_method / lnurl columns on lightning_transactions |
| `20260319000003_lightning_wallet_shared_provider_ids` | Drop unique constraint on provider_wallet_id |
| `20260321000000_journal_title_mood` | Adds `title`, `mood` to `journal_entries` |
| `20260321000001_cycle_profile_luteal` | Adds `luteal_phase_length`, `ignore_irregular_cycle` to `cycle_profiles` |
| `20260322000000_day_logs_units` | Adds `weight_unit`, `temperature_unit`; expands flow CHECK to include `very_heavy` |
| `20260322000001_journal_symptoms_images` | Adds `symptoms TEXT[]`, `images TEXT[]` to `journal_entries` |

---

## Authentication Flow

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

### Register
```
POST /api/v1/auth/register          { name, email, password, confirm_password }
  → welcome email sent
  → { user: { ..., emailVerified: true }, accessToken, refreshToken }
```

### Login
```
POST /api/v1/auth/login             { email, password }
  → { user, accessToken, refreshToken }

POST /api/v1/auth/refresh           { refreshToken }
  → { accessToken, refreshToken }

POST /api/v1/auth/logout            { refreshToken }   [auth]
POST /api/v1/auth/logout-all                           [auth]
```

### Forgot password (only OTP flow)
```
POST /api/v1/auth/forgot-password   { email }
  → 6-digit OTP sent to email (valid 10 min, max 3/hour)

POST /api/v1/auth/verify-otp        { email, otp }
  → { reset_token }  (valid 15 min)

POST /api/v1/auth/reset-password/:token   { password, confirm_password }
  → password updated, all sessions revoked

PUT  /api/v1/auth/change-password   { currentPassword, newPassword }   [auth]
```

---

## Payment Flow

SatsFlo uses the **LNURL-pay protocol** to send Bitcoin tips to any Lightning wallet.

```
Step 1  POST /payments/validate     Validate LN address, returns min/max sats
Step 2  [UI shows amount input using min/max from step 1]
Step 3  POST /payments/tip          Fetches BOLT11 invoice from recipient's wallet
Step 4  [Frontend shows QR code + lightning:<invoice> deep link]
Step 5  [User pays from their own Lightning wallet app]
Step 6  POST /payments/confirm      "I've sent the tip" → marks completed
Step 7  [Success screen]
```

### Step 1 — Validate (`POST /payments/validate`)

Resolves either format before the user enters an amount:

| Input | Resolution |
|-------|-----------|
| `alice@getalby.com` | `GET https://getalby.com/.well-known/lnurlp/alice` |
| `LNURL1DP68GURN8...` | bech32 decode → GET decoded URL |

```
Request:  { "lightning_address": "alice@getalby.com" }
Response: { "valid": true, "min_sats": 1, "max_sats": 1000000,
            "comment_allowed": 140, "description": "..." }
```

### Step 3 — Create Tip (`POST /payments/tip`)

```
// Tip a SatsFlo user (looks up their saved lightning address)
{ "recipient_id": "uuid", "amount_sats": 100, "note": "Great post!", "thread_id": "uuid?" }

// Tip any external Lightning wallet
{ "lightning_address": "alice@getalby.com", "amount_sats": 100 }

Response:
{
  "transaction_id": "uuid",
  "bolt11_invoice": "lnbc...",
  "payment_hash": "abc123...",
  "amount_sats": 100,
  "expires_at": "...",          ← 10 minutes from now
  "lightning_address": "alice@getalby.com"
}
```

Payment hash is extracted from the BOLT11 invoice using the `bolt11` npm decoder
(`decoded.tagsObject.payment_hash`), with a `crypto.randomBytes` fallback.

### Step 6 — Confirm (`POST /payments/confirm`)

```
Request:  { "payment_hash": "abc123..." }
```

- Scoped to `sender_id = req.user.id` — users can only confirm their own transactions
- Checks `expires_at > NOW()` → 410 if invoice expired
- Returns 409 if already settled
- No webhook needed — this is the **primary** completion path

### Webhook (bonus, `POST /payments/webhook`)

For wallets that support server callbacks:
```
Header:  x-webhook-secret: <WEBHOOK_SECRET>
Body:    { "payment_hash": "abc123..." }
```

### Poll status / history

```
GET /payments/status/:paymentHash   → { status: pending|completed|failed }
GET /payments/history?type=sent     → array of transactions
GET /payments/history?type=received → array of transactions
```

---

## API Reference

Base URL: `https://your-domain.com/api/v1`

Response envelope:
```json
{ "success": true, "message": "OK", "data": { ... } }
```

### Auth
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | — | body: `name, email, password, confirm_password` |
| POST | `/auth/login` | — | body: `email, password` |
| POST | `/auth/refresh` | — | body: `refreshToken` |
| POST | `/auth/logout` | ✓ | body: `refreshToken` |
| POST | `/auth/logout-all` | ✓ | |
| POST | `/auth/forgot-password` | — | sends 4-digit OTP |
| POST | `/auth/verify-otp` | — | body: `{ email, otp }` → `{ reset_token }` |
| POST | `/auth/reset-password/:token` | — | body: `password, confirm_password` |
| PUT | `/auth/change-password` | ✓ | body: `currentPassword, newPassword` |
| GET | `/auth/me` | ✓ | |

### Users
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/users/profile` | ✓ | Includes phone, lightning_address |
| PUT | `/users/profile` | ✓ | name, phone, date_of_birth, language |
| POST | `/users/avatar` | ✓ | JSON avatar: `{ "avatar": "<base64>" }` |
| POST | `/users/profile/avatar` | ✓ | Multipart — field `file` (image, max 5 MB) |
| GET | `/users/preferences` | ✓ | Returns `{ reminders: { periodStarts, periodEnds, fertility, ovulation, medicine } }` |
| PUT | `/users/preferences` | ✓ | Deep-merge into `reminders` key |
| GET | `/users/health-profile` | ✓ | |
| PUT | `/users/health-profile` | ✓ | |
| DELETE | `/users/account` | ✓ | body: `{ password }` |
| GET | `/users/export` | ✓ | GDPR export |

### Cycles
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/cycles/start` | ✓ | Start new period. Syncs `last_period_start` in cycle profile. |
| PUT | `/cycles/start` | ✓ | Update current period's start date: `{ date }` |
| POST | `/cycles/end` | ✓ | End current period: `{ end_date }` |
| PUT | `/cycles/end` | ✓ | Update current period's end date: `{ date }` |
| GET | `/cycles/current` | ✓ | Phase + predictions + `period_dates`, `fertility_window`, `ovulation_date`, `pregnancy_chance` |
| GET | `/cycles/predictions` | ✓ | Predictions only |
| GET | `/cycles/analytics` | ✓ | query: `startDate`, `endDate` |
| GET | `/cycles` | ✓ | Cycle history. query: `page`, `limit`, `startDate`, `endDate` |
| GET | `/cycles/:cycleId` | ✓ | Single cycle |
| PUT | `/cycles/:cycleId` | ✓ | |
| DELETE | `/cycles/:cycleId` | ✓ | |
| POST | `/cycles/:cycleId/logs` | ✓ | Add daily log to cycle |

### Cycle Profile
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/cycle-profile` | ✓ | Create/replace |
| PUT | `/cycle-profile` | ✓ | Partial update |
| GET | `/cycle-profile` | ✓ | Live phase calculations |

### Daily Logs
One log per date. PUT is a partial update — only fields in the body are written.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/logs/:date` | ✓ | Always returns full object with defaults. Never returns null. |
| GET | `/logs?date=YYYY-MM-DD` | ✓ | Query-param variant |
| GET | `/logs/range?from=YYYY-MM-DD&to=YYYY-MM-DD` | ✓ | Date range |
| PUT | `/logs/:date` | ✓ | Upsert. Accepts: `flow_level`, `mood`, `notes`, `symptoms`, `medicine`, `weight`, `weight_unit`, `temperature`, `temperature_unit`, `water_intake_ml`, `period_start`, `period_end` |

### Water Settings
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/water-settings` | ✓ | |
| PUT | `/water-settings` | ✓ | |

### Journal
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/journal?month=YYYY-MM` | ✓ | All entries for month, newest first |
| GET | `/journal/search?q=text&month=YYYY-MM` | ✓ | Full-text search. `month` optional. Max 50 results. |
| POST | `/journal/media` | ✓ | Multipart, field `files` (up to 5, max 10 MB each). Returns `{ urls: [...] }` |
| POST | `/journal` | ✓ | Fields: `date/entry_date`, `title`, `content`, `mood`, `symptoms[]`, `images[]` |
| GET | `/journal/:id` | ✓ | Returns `symptoms`, `images`, `cycle_day` |
| PUT | `/journal/:id` | ✓ | Partial update — only sent fields change |
| DELETE | `/journal/:id` | ✓ | |

### Wallet
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/wallet/lightning` | ✓ | Returns `{ lightning_address }` |
| PUT | `/wallet/lightning` | ✓ | body: `{ lightning_address }` — must be `user@domain.com` |

### Payments
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/payments/validate` | ✓ | Accepts `user@domain.com` or `LNURL1...` |
| POST | `/payments/tip` | ✓ | `recipient_id` or `lightning_address` |
| POST | `/payments/confirm` | ✓ | body: `{ payment_hash }` |
| GET | `/payments/status/:paymentHash` | ✓ | |
| GET | `/payments/history` | ✓ | query: `type=sent\|received` |
| POST | `/payments/webhook` | — | header: `x-webhook-secret` |

### Lightning — Blink
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/lightning/wallet` | ✓ | |
| POST | `/lightning/wallet/sync` | ✓ | |
| POST | `/lightning/invoices` | ✓ | |
| POST | `/lightning/payments/probe` | ✓ | |
| POST | `/lightning/payments/pay` | ✓ | |
| POST | `/lightning/payments/preview` | ✓ | |
| POST | `/lightning/payments/lnurl` | ✓ | |
| POST | `/lightning/payments/ln-address` | ✓ | |
| GET | `/lightning/transactions` | ✓ | |
| GET | `/lightning/proof-of-payment` | ✓ | |

### Partner System
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/partner/invite` | ✓ | Returns `{ invite_code, expires_at }` — 24h expiry |
| GET | `/partner/invite/status` | ✓ | `{ status: pending\|accepted\|expired }` |
| POST | `/partner/accept` | ✓ | body: `{ invite_code }` |
| GET | `/partner` | ✓ | Partner info + nicknames |
| DELETE | `/partner` | ✓ | Unpair |
| PUT | `/partner/nickname` | ✓ | `{ my_nickname, partner_nickname }` |
| GET | `/partner/settings` | ✓ | Your sharing permissions |
| PUT | `/partner/settings` | ✓ | Update sharing permissions |
| PUT | `/partner/mode` | ✓ | `{ partner_mode_enabled: bool }` |
| GET | `/partner/cycle` | ✓ | Partner's cycle, filtered by their sharing settings |
| GET | `/partner/calendar` | ✓ | Partner's calendar dates |

### Chats (DMs)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/chats` | ✓ | With `unread_count` + `is_typing` |
| POST | `/chats` | ✓ | body: `{ recipient_id }` — idempotent |
| GET | `/chats/:conversationId` | ✓ | Newest first. query: `page`, `limit` |
| POST | `/chats/:conversationId` | ✓ | body: `{ content }` |
| DELETE | `/chats/:conversationId/:messageId` | ✓ | Soft delete |
| PUT | `/chats/:conversationId/read` | ✓ | Mark all read |
| POST | `/chats/:conversationId/typing` | ✓ | `{ is_typing: bool }` — expires 5s |

### Groups
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/groups` | ✓ | Joined groups |
| POST | `/groups` | ✓ | `{ name, description?, member_ids? }` |
| GET | `/groups/:groupId` | ✓ | Info + member list |
| PUT | `/groups/:groupId` | ✓ | Admin only |
| DELETE | `/groups/:groupId` | ✓ | Admin only |
| POST | `/groups/:groupId/members` | ✓ | `{ user_id }` — admin only |
| DELETE | `/groups/:groupId/members/:userId` | ✓ | Admin only |
| GET | `/groups/:groupId/messages` | ✓ | Newest first |
| POST | `/groups/:groupId/messages` | ✓ | `{ content }` |
| DELETE | `/groups/:groupId/messages/:messageId` | ✓ | Sender or admin |
| POST | `/groups/:groupId/leave` | ✓ | Blocked if sole admin |

### Community — Threads
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/threads` | opt | query: `search`, `tab=recent\|popular`, `page`, `limit` |
| POST | `/threads` | ✓ | `{ content, image_url? }` |
| GET | `/threads/:id` | opt | With comments + `is_liked_by_me` |
| PUT | `/threads/:id` | ✓ | Owner only |
| DELETE | `/threads/:id` | ✓ | Owner or admin |
| POST | `/threads/:id/like` | ✓ | |
| DELETE | `/threads/:id/like` | ✓ | |
| POST | `/threads/:id/comments` | ✓ | `{ content }` |
| PUT | `/threads/:id/comments/:cId` | ✓ | Owner only |
| DELETE | `/threads/:id/comments/:cId` | ✓ | Owner or admin |

### Health — Vitals (Add Log Shortcuts)
Each endpoint upserts one field in `day_logs`. POST and PUT are identical (both upsert).

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST/PUT | `/health/flow` | ✓ | `{ date, flow }` — values: `spotting` · `light` · `medium` · `heavy` · `very_heavy` |
| POST/PUT | `/health/medicine` | ✓ | `{ date, medicine: [] }` |
| POST/PUT | `/health/weight` | ✓ | `{ date, weight, weight_unit }` — unit: `kg` or `lb` |
| GET | `/health/weight` | ✓ | Last 30 days of weight entries |
| POST/PUT | `/health/temperature` | ✓ | `{ date, temperature, temperature_unit }` — unit: `C` or `F` |
| GET | `/health/temperature` | ✓ | Last 30 days of temperature entries |

### Notifications
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/notifications` | ✓ | Latest 50 with actor info |
| PATCH | `/notifications/read-all` | ✓ | Mark all read |
| PATCH | `/notifications/:id/read` | ✓ | Mark single read |

---

## Route Registration

All routes mount under `/api/v1` in `src/routes/index.js`:

```js
router.use('/auth',           authRoutes);
router.use('/users',          userRoutes);
router.use('/cycles',         cycleRoutes);
router.use('/health',         healthRoutes);       // symptoms · moods · analytics · flow · weight · temperature · medicine
router.use('/cycle-profile',  cycleProfileRoutes);
router.use('/logs',           dayLogsRoutes);
router.use('/water-settings', waterSettingsRoutes);
router.use('/journal',        journalRoutes);      // entries · search · media upload
router.use('/payments',       paymentRoutes);
router.use('/lightning',      lightningRoutes);
router.use('/wallet',         walletRoutes);
router.use('/partner',        partnerRoutes);
router.use('/chats',          chatRoutes);
router.use('/groups',         groupRoutes);
router.use('/',               communityRoutes);    // /threads + /notifications
```

Health check: `GET /api/v1/health`

---

## Deployment (Render)

- **Build command:** `npm install && npm run migrate`
- **Start command:** `npm start`
- `app.set('trust proxy', 1)` is required for the rate limiter to see the real client IP behind Render's proxy.
- Email is sent via the Resend HTTP SDK — do not configure SMTP (port 25/587 is blocked on Render).

---

## Full API Reference

See **[API.md](./API.md)** for complete request/response shapes, field aliases, enum values, error codes, and rate limit rules.
