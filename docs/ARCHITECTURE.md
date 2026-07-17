# Architecture

## System Design

```
React Native (Expo)
       │
       │  HTTPS/REST
       ▼
┌──────────────────────────────────────────┐
│  Express App (src/app.js)                │
│  ┌────────────────────────────────────┐  │
│  │  Middleware pipeline               │  │
│  │  helmet → cors → body parser →    │  │
│  │  sanitize → morgan → rate limit   │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Routes → Controllers → Services  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
       │
       ├── PostgreSQL (pg pool, 20 connections)
       ├── Resend (email, HTTP)
       ├── Cloudinary (file uploads)
       ├── Firebase (push notifications)
       └── Google OAuth2 (idToken verification)
```

## Request Lifecycle

```
1. helmet()          security headers
2. cors()            CORS check
3. express.json()    body parsing (10 MB limit)
4. sanitizeBody()    strip null/undefined, trim strings
5. morgan()          request logging
6. apiLimiter        100 req / 15 min (global)
─── route-specific ──────────────────────────────
7. rate limiter      per-endpoint limits
8. authenticateToken JWT verification → req.user
9. validate()        express-validator results
10. authorize()      RBAC check
── handler ─────────────────────────────────────
11. controller       calls service
12. service          SQL via pool.query()
13. ApiResponse      formats response envelope
── error path ───────────────────────────────────
14. errorHandler     maps PG codes → HTTP, logs
```

PostgreSQL error codes mapped by `errorHandler`:

| PG Code | HTTP |
|---------|------|
| 23505 (unique violation) | 409 |
| 23503 (FK violation) | 400 |
| 23502 (not null) | 400 |
| 23514 (check constraint) | 400 |

## Directory Layout

```
src/
├── app.js                # Express setup, middleware, routes mount
├── server.js             # HTTP server, startup checks, graceful shutdown
├── config/
│   ├── database.js       # pool + table name constants
│   ├── db.js             # pg.Pool construction
│   ├── pgConfig.js       # connection string builder
│   ├── jwt.js            # JWT secret/expiry config
│   ├── blink.js          # Blink API config + assertBlinkConfigured()
│   ├── cloudinary.js     # upload multer config + uploadBuffer()
│   └── google.js         # verifyGoogleToken()
├── routes/               # one file per domain
├── controllers/          # thin handlers: validate → service → ApiResponse
├── services/             # all business logic + SQL
├── middleware/
│   ├── auth.js           # authenticateToken, authorize, optionalAuth
│   ├── rateLimiter.js    # all rate limit instances
│   ├── errorHandler.js   # global error handler
│   └── validator.js      # runs express-validator, returns 400
├── validators/           # express-validator rule arrays per domain
├── utils/
│   ├── response.js       # ApiResponse static helpers
│   ├── logger.js         # structured JSON logger
│   ├── encryption.js     # AES-256-GCM encrypt/decrypt
│   └── constants.js      # enums, defaults, limits
└── database/
    ├── schema.sql         # reference schema (not used at runtime)
    ├── migrations/        # node-pg-migrate files
    └── seeds/index.js     # test data seeder
```

## Database Schema

### Core Auth

**users**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE | |
| password_hash | VARCHAR(255) | nullable for Google-only accounts |
| name | VARCHAR(255) | |
| date_of_birth | DATE | |
| avatar_url | TEXT | base64 or Cloudinary URL |
| timezone | VARCHAR(100) | default 'UTC' |
| language | VARCHAR(10) | default 'en' |
| role | VARCHAR(20) | user / admin / moderator |
| status | VARCHAR(20) | active / inactive / suspended / deleted |
| email_verified | BOOLEAN | |
| verification_token | VARCHAR(255) | 24 h expiry |
| verification_expires | TIMESTAMPTZ | |
| email_otp | VARCHAR(6) | forgot-password OTP |
| email_otp_expires | TIMESTAMPTZ | 10 min |
| google_id | VARCHAR(255) UNIQUE | Google Sign-In |
| auth_provider | VARCHAR(20) | local / google |
| fcm_token | VARCHAR(500) | push notification token |
| fcm_platform | VARCHAR(20) | ios / android |
| lightning_address | VARCHAR(255) | |
| preferences | JSONB | notification + reminder flags |
| last_login | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | soft delete |
| created_at / updated_at | TIMESTAMPTZ | |

**refresh_tokens**
| Column | Type |
|--------|------|
| id | UUID PK |
| user_id | UUID FK → users |
| token | TEXT |
| expires_at | TIMESTAMPTZ |
| revoked | BOOLEAN default false |
| created_at | TIMESTAMPTZ |

**password_resets**
| Column | Type |
|--------|------|
| id | UUID PK |
| user_id | UUID FK → users |
| token | VARCHAR(255) |
| expires_at | TIMESTAMPTZ (15 min) |
| used | BOOLEAN default false |
| created_at | TIMESTAMPTZ |

### Health & Cycle

**health_profiles** (1:1 per user)  
average_cycle_length, average_period_length, birth_control_method, health_conditions, medications, is_pregnant, is_trying_to_conceive, notes

**cycles**  
user_id, start_date, end_date, period_end_date, period_length, cycle_length, notes

**cycle_logs** (unique per user per date)  
user_id, cycle_id, date, flow_intensity (spotting/light/medium/heavy), temperature, cervical_mucus, sexual_activity, contraception_used, notes

**cycle_profiles** (1:1 per user — widget)  
user_id, cycle_length (21–35), period_length (3–9), last_period_start, luteal_phase_length (7–21), ignore_irregular_cycle

**day_logs** (unique per user per date — unified daily view)  
user_id, log_date, period_start, period_end, flow_level, symptoms[], moods[], medicine[], weight, temperature, water_intake, note, weight_unit (kg/lb), temperature_unit (C/F)

**symptoms**  
user_id, date, name, category (physical/emotional/pain/digestive/skin/sleep), severity (1–5), time_of_day, notes

**moods**  
user_id, date, mood, intensity (1–5), notes, triggers

**water_settings** (1:1 per user)  
user_id, water_target (ml), cup_capacity (ml), cup_style

### Personal Content

**journal_entries**  
user_id, entry_date, content, title, mood, symptoms TEXT[], images TEXT[]

### Community & Social

**threads**  
user_id, content, image_url, is_pinned, created_at, updated_at

**thread_comments**  
thread_id, user_id, content

**thread_likes** (composite PK: thread_id + user_id)

**notifications**  
user_id, actor_id, type, message, is_read

### Messaging

**conversations** — 1-to-1 DM channel; unique pair enforced (user_a_id < user_b_id)

**direct_messages**  
conversation_id, sender_id, content, read_at, deleted_at

**typing_indicators**  
conversation_id, user_id, is_typing (ephemeral)

**groups**  
name, description, created_by

**group_members** (unique per group per user)  
group_id, user_id, role (admin/member)

**group_messages**  
group_id, sender_id, content, deleted_at

### Partner System

**partner_invites**  
sender_id, invite_code (6-char, unique), sharing flags (5 booleans), status (pending/accepted/expired), expires_at (24 h)

**partnerships**  
user_a_id, user_b_id (unique pair), status, per-user sharing flags (10 total), per-user nicknames (4), per-user partner_mode flag (2), created_at, updated_at

### Payments

**gift_transactions** — the only active payments table  
sender_id (nullable), receiver_id (nullable), amount_sats, thread_id, comment_id, bolt11_invoice, payment_hash (unique), lightning_address, note, expires_at (10 min), status (pending/completed/failed)

See [PAYMENTS.md](./PAYMENTS.md) for the full LNURL-pay + BOLT11 flow.

> **Future tables (schema exists, not active):** `lightning_wallets`, `lightning_transactions`, `reward_ledger`, `wallets` — created by migrations for a planned in-app wallet feature. Not connected to any live frontend flow. Do not build on these for v1.

### DB Triggers

| Trigger | Table | Action |
|---------|-------|--------|
| `set_updated_at()` | users, cycles, day_logs, journal_entries, + 9 others | auto-updates `updated_at` |
| `notify_on_comment()` | thread_comments | creates notification row |
| `notify_on_like()` | thread_likes | creates notification row |

## Migration Order

| File | Adds |
|------|------|
| `20260310000000_initial_schema` | full base schema, triggers, indexes |
| `20260316000000_payments_otp` | email_otp on users, bolt11/payment_hash on gift_transactions |
| `20260318000000_profile_wallet` | phone on users |
| `20260318000001_partner_system` | partner_invites, partnerships |
| `20260318000002_chats_groups` | conversations, direct_messages, typing_indicators, groups, group_members, group_messages |
| `20260319000000_gift_transactions_fix` | nullable sender_id/receiver_id, lightning_address on gift_transactions |
| `20260319000001_lightning_blink_foundation` | lightning_wallets, lightning_transactions, reward_ledger |
| `20260319000002_lightning_payment_methods` | payment_method, lnurl, lightning_address on lightning_transactions |
| `20260319000003_lightning_wallet_shared_provider_ids` | relax unique constraint on provider_wallet_id |
| `20260321000000_journal_title_mood` | title, mood on journal_entries |
| `20260321000001_cycle_profile_luteal` | luteal_phase_length, ignore_irregular_cycle on cycle_profiles |
| `20260322000000_day_logs_units` | weight_unit, temperature_unit on day_logs |
| `20260322000001_journal_symptoms_images` | symptoms[], images[] on journal_entries |
| `20260322000003_fcm_token` | fcm_token, fcm_platform on users |
| `20260608000000_google_oauth` | google_id, auth_provider on users; password_hash nullable |

## Pool Configuration

- Max connections: 20
- Idle timeout: 30 s
- Connection timeout: 10 s (configurable via `DB_CONNECTION_TIMEOUT`)
- SSL: auto-enabled in production, configurable via `DB_SSL`
