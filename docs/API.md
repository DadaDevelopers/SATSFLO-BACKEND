# API Reference

**Base URL:** `https://satsflo-backend.onrender.com/api/v1`  
**Local:** `http://localhost:3000/api/v1`

## Authentication

Protected endpoints require a Bearer token:

```
Authorization: Bearer <accessToken>
```

Access tokens expire in 15 minutes. Use `POST /auth/refresh` to rotate.

## Response Envelope

Every response — success or error — uses this shape:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... },
  "timestamp": "2026-06-08T10:00:00.000Z"
}
```

Paginated responses include a `pagination` key alongside `data`:

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Error Responses

```json
{
  "success": false,
  "message": "What went wrong",
  "errors": [{ "field": "email", "message": "Invalid email" }],
  "timestamp": "..."
}
```

| Status | Meaning |
|--------|---------|
| 400 | Validation error or bad input |
| 401 | Missing or invalid token |
| 403 | Forbidden (role or ownership check) |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Auth — `/auth`

### POST /auth/register

Create a new account.

**Body:**
```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "Secret1234",
  "confirm_password": "Secret1234"
}
```

Password rules: 8–128 chars, at least one uppercase, lowercase, and digit.

**Response 201:**
```json
{
  "user": { "id": "...", "email": "...", "name": "...", "role": "user", "emailVerified": false },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": "15m"
}
```

---

### POST /auth/login

```json
{ "email": "ada@example.com", "password": "Secret1234" }
```

**Response 200:** same shape as register, `emailVerified` reflects actual value.

---

### POST /auth/google

Sign in or register with a Google ID token from the mobile Google Sign-In SDK.

```json
{ "idToken": "<Google ID token from @react-native-google-signin/google-signin>" }
```

**Response 200:** same shape as login, `emailVerified: true` always.

Behaviour:
- New email → creates account
- Existing Google account → issues new tokens
- Existing email/password account → links Google ID, marks email verified

---

### POST /auth/refresh

```json
{ "refreshToken": "eyJ..." }
```

**Response 200:**
```json
{ "accessToken": "eyJ...", "refreshToken": "eyJ...", "expiresIn": "15m" }
```

Old refresh token is revoked (rotation).

---

### POST /auth/logout — 🔒

```json
{ "refreshToken": "eyJ..." }
```

Revokes the given refresh token.

---

### POST /auth/logout-all — 🔒

No body. Revokes all refresh tokens for the authenticated user (all devices).

---

### POST /auth/forgot-password

```json
{ "email": "ada@example.com" }
```

Always returns 200 (no email enumeration). If the email is registered, a 6-digit OTP is sent. OTP expires in 10 minutes; max 3 requests per hour.

---

### POST /auth/verify-otp

```json
{ "email": "ada@example.com", "otp": "123456" }
```

**Response 200:**
```json
{ "reset_token": "abc123..." }
```

---

### POST /auth/reset-password/:token

```json
{ "password": "NewPass1234", "confirm_password": "NewPass1234" }
```

Resets password and revokes all refresh tokens (forces re-login on all devices).

---

### GET /auth/verify-email/:token

Email verification link — returns an HTML page, not JSON. Sent to users after registration.

---

### POST /auth/resend-verification — 🔒

No body. Generates a new verification email. Max 3 per hour.

---

### GET /auth/me — 🔒

**Response 200:**
```json
{
  "id": "...",
  "email": "ada@example.com",
  "name": "Ada Lovelace",
  "role": "user",
  "avatar": "https://...",
  "avatar_url": "https://...",
  "emailVerified": true
}
```

---

## Users — `/users`

### GET /users/profile — 🔒

Returns full user profile.

### PUT /users/profile — 🔒

Update profile fields (name, date_of_birth, timezone, language, etc.).

### POST /users/avatar — 🔒

```json
{ "avatar": "<base64 string or URL>" }
```

### GET /users/health-profile — 🔒

Returns health profile (average_cycle_length, average_period_length, health conditions, etc.).

### PUT /users/health-profile — 🔒

Update health profile.

### GET /users/preferences — 🔒

Returns JSONB preferences object.

### PUT /users/preferences — 🔒

Update preferences (reminder settings, notification flags, etc.).

### POST /users/device-token — 🔒

```json
{ "token": "<FCM token>", "platform": "android" }
```

### DELETE /users/account — 🔒

```json
{ "password": "current-password" }
```

Soft-deletes the account.

### GET /users/export — 🔒

Returns a full data export of the user's information.

---

## Cycles — `/cycles`

### POST /cycles/start — 🔒

```json
{ "start_date": "2026-06-01", "flowIntensity": "medium", "notes": "..." }
```

Also syncs `cycle_profiles.last_period_start`.

### POST /cycles/end — 🔒

```json
{ "end_date": "2026-06-06" }
```

### GET /cycles/current — 🔒

Returns the active cycle with predictions:

```json
{
  "current_day": 8,
  "cycle_length": 28,
  "period_length": 5,
  "ovulation_day": 14,
  "current_phase": "follicular",
  "days_until_next_period": 20,
  "predictions": {
    "nextPeriod": { "date": "2026-06-29", "daysUntil": 20 },
    "ovulation": { "date": "2026-06-15", "daysUntil": 6 },
    "fertileWindow": { "start": "2026-06-10", "end": "2026-06-16" }
  }
}
```

### GET /cycles/predictions — 🔒

Next period and ovulation predictions only.

### GET /cycles/phases — 🔒

Phase date ranges for the cycle wheel UI (menstrual, follicular, ovulation, luteal with start/end/days).

### GET /cycles/forecast?months=3 — 🔒

Multi-month period and ovulation forecast. `months` capped at 12.

### GET /cycles/analytics?startDate=&endDate= — 🔒

Aggregate analytics over a date range.

### GET /cycles — 🔒

Paginated cycle history. Query: `page`, `limit`, `startDate`, `endDate`.

### GET /cycles/:cycleId — 🔒

Single cycle with daily logs.

### PUT /cycles/:cycleId — 🔒

Update cycle fields.

### DELETE /cycles/:cycleId — 🔒

Delete cycle.

### POST /cycles/log — 🔒

Log a daily entry (flow, symptoms, mood, etc.).

### GET /cycles/log/:date — 🔒

Daily log for a specific date (`YYYY-MM-DD`).

---

## Cycle Profile — `/cycle-profile`

Lightweight profile for the cycle widget (separate from full cycle tracking).

### POST /cycle-profile — 🔒

```json
{
  "last_period_start": "2026-05-28",
  "cycle_length": 28,
  "period_length": 5,
  "luteal_phase_length": 14,
  "ignore_irregular_cycle": false
}
```

Also accepts camelCase: `lastPeriodStart`, `cycleLength`, etc.

**Response 200:** Full calculated profile including `current_day`, `ovulation_day`, `days_until_period`.

### PUT /cycle-profile — 🔒

Partial update. All fields optional.

### GET /cycle-profile — 🔒

Returns live-calculated profile.

---

## Health — `/health`

### Symptoms

| Method | Path | Description |
|--------|------|-------------|
| POST | /health/symptoms | Log a symptom |
| POST | /health/symptoms/batch | Log multiple symptoms for a date |
| GET | /health/symptoms | Paginated history |
| GET | /health/symptoms/date/:date | Symptoms for a specific date |
| PUT | /health/symptoms/:id | Update symptom |
| DELETE | /health/symptoms/:id | Delete symptom |

Symptom fields: `date`, `name`, `category` (physical/emotional/pain/digestive/skin/sleep), `severity` (1–5), `time_of_day`.

### Moods

Same CRUD pattern as symptoms. Mood values: happy/sad/irritable/anxious/energetic/tired/calm/stressed/emotional/confident.

### Other Logs

| Method | Path | Body |
|--------|------|------|
| POST | /health/flow | `{ flow, date }` (spotting/light/medium/heavy/very_heavy) |
| PUT | /health/flow | same |
| POST | /health/medicine | `{ medicine, date }` |
| PUT | /health/medicine | same |
| POST | /health/weight | `{ weight, date }` (kg) |
| PUT | /health/weight | same |
| GET | /health/weight | `?from=&to=` — weight history |
| POST | /health/temperature | `{ temperature, date }` (°C) |
| PUT | /health/temperature | same |
| GET | /health/temperature | `?from=&to=` — temperature history |

### Analytics

```
GET /health/analytics/symptoms?startDate=&endDate=
GET /health/analytics/moods?startDate=&endDate=
GET /health/summary/:date
GET /health/trends/:cycleId
```

---

## Day Logs — `/logs`

Unified daily log (combines health data for a single date view).

| Method | Path | Description |
|--------|------|-------------|
| GET | /logs | `?date=YYYY-MM-DD` — today's log |
| GET | /logs/range | `?from=&to=` — range of logs |
| GET | /logs/:date | Log for a specific date |
| PUT | /logs/:date | Update log fields |

PUT body fields: `flow_level`, `symptoms[]`, `mood`, `notes`, `medicine`, `weight`, `temperature`, `water_intake_ml`.  
Response includes aliases: `flow` → `flow_level`, `notes` → `note`.

---

## Water Settings — `/water-settings`

### GET /water-settings — 🔒

```json
{ "water_target": 2000, "daily_goal_ml": 2000, "cup_capacity": 250, "cup_style": "glass" }
```

### PUT /water-settings — 🔒

```json
{ "water_target": 2500, "cup_capacity": 300, "cup_style": "bottle" }
```

---

## Journal — `/journal`

### GET /journal — 🔒

`?month=2026-06` — entries for the month.

### GET /journal/search — 🔒

`?q=running&month=2026-06` — full-text search.

### POST /journal — 🔒

```json
{
  "date": "2026-06-08",
  "title": "Feeling great",
  "content": "...",
  "mood": "happy",
  "symptoms": ["cramps", "headache"],
  "images": ["https://..."]
}
```

### GET /journal/:id — 🔒

Single entry.

### PUT /journal/:id — 🔒

Partial update.

### DELETE /journal/:id — 🔒

Delete entry. `DELETE /journal` (no id) deletes all entries.

### POST /journal/media — 🔒

`multipart/form-data` with `files[]` (max 5, 10 MB each). Returns `{ urls: ["https://res.cloudinary.com/..."] }`.

---

## Community

### Threads

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /threads | Optional | List threads (`?tab=`, `?search=`, `?page=`, `?limit=`) |
| POST | /threads | Yes | Create thread (`content`, `image_url`) |
| GET | /threads/:id | Optional | Single thread |
| PUT | /threads/:id | Yes | Update thread |
| DELETE | /threads/:id | Yes | Delete thread |
| GET | /threads/:id/comments | Optional | Comments on thread |
| POST | /threads/:id/comments | Yes | Add comment (`content`) |
| PUT | /threads/:id/comments/:commentId | Yes | Edit comment |
| DELETE | /threads/:id/comments/:commentId | Yes | Delete comment |
| POST | /threads/:id/like | Yes | Like thread |
| DELETE | /threads/:id/like | Yes | Unlike thread |

Like response: `{ "like_count": 5, "is_liked_by_me": true }`.  
Thread list shape includes: `likes_count`, `comments_count`, `is_liked`.

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | /notifications | All notifications |
| GET | /notifications/unread-count | `{ count: 3 }` |
| PATCH | /notifications/read-all | Mark all read |
| PATCH | /notifications/:id/read | Mark one read |
| DELETE | /notifications/:id | Delete |

Notification shape: `{ id, type, message, created_at, is_read, read }` (`read` is an alias for `is_read`).

---

## Chats — `/chats`

| Method | Path | Description |
|--------|------|-------------|
| GET | /chats | Conversations list |
| POST | /chats | Start conversation (`{ recipient_id }`) |
| GET | /chats/:id | Messages in conversation |
| POST | /chats/:id | Send message (`{ content }`) |
| DELETE | /chats/:id/:messageId | Delete message |
| PUT | /chats/:id/read | Mark conversation read |
| POST | /chats/:id/typing | `{ is_typing: true }` |

Conversations list shape: `{ id, recipient: { name }, name, last_message, updated_at, is_online }`.  
Messages shape: `{ messages: [{ id, content, is_sent, created_at }] }`.

---

## Groups — `/groups`

| Method | Path | Description |
|--------|------|-------------|
| GET | /groups | Groups list (`{ id, name, last_message, members_count }`) |
| POST | /groups | Create (`{ name, description, member_ids }`) |
| GET | /groups/:id | Group with members |
| PUT | /groups/:id | Update |
| DELETE | /groups/:id | Delete |
| POST | /groups/:id/members | Add member (`{ user_id }`) |
| DELETE | /groups/:id/members/:userId | Remove member |
| GET | /groups/:id/messages | Messages (`?page=`, `?limit=`) |
| POST | /groups/:id/messages | Send message (`{ content }`) |
| DELETE | /groups/:id/messages/:messageId | Delete message |
| POST | /groups/:id/leave | Leave group |

---

## Partner — `/partner`

### POST /partner/invite — 🔒

Generate a 6-character invite code.

```json
{
  "share_period_dates": true,
  "share_fertile_window": true,
  "share_symptoms_moods": false,
  "share_cycle_insights": false,
  "share_sex_drive": false
}
```

**Response:**
```json
{
  "invite_code": "AB3XZ7",
  "expires_at": "...",
  "share_url": "https://satsflo.app/invite?code=AB3XZ7"
}
```

### GET /partner/invite/status — 🔒

Returns `{ invite_code, status, expires_at, partner }`.

### POST /partner/accept — 🔒

```json
{ "invite_code": "AB3XZ7" }
```

Case-insensitive. Returns `{ partnership_id, partner: { id, name, avatar_url } }`.

### GET /partner — 🔒

Partner details including nicknames, sharing settings, `connected_since`.

### DELETE /partner — 🔒

Unpair.

### PUT /partner/nickname — 🔒

```json
{ "my_nickname": "Love", "partner_nickname": "Babe" }
```

### GET /partner/settings — 🔒

Returns all 5 sharing flags.

### PUT /partner/settings — 🔒

Update sharing flags.

### PUT /partner/mode — 🔒

```json
{ "partner_mode_enabled": true }
```

### GET /partner/cycle — 🔒

Partner's current cycle phase, days until period/ovulation (only data the partner has shared).

### GET /partner/calendar — 🔒

Partner's period dates and fertility window (respects sharing settings).

---

## Payments — `/payments`

See [docs/PAYMENTS.md](./docs/PAYMENTS.md) for the full flow explanation.

SatsFlo uses peer-to-peer Lightning tipping via LNURL-pay and BOLT11 — no third-party wallet API. The user pays from their own Lightning wallet; SatsFlo only fetches invoices and records status.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /payments/validate | Yes | Validate lightning address / LNURL, get min/max sats |
| POST | /payments/tip | Yes | Fetch BOLT11 invoice from recipient's LNURL endpoint |
| POST | /payments/confirm | Yes | Optimistic confirmation (sender-initiated) |
| GET | /payments/status/:paymentHash | Yes | Payment status |
| GET | /payments/history | Yes | `?type=sent\|received` — last 50 |
| GET | /payments/btc-price | Yes | Current BTC/USD rate |
| POST | /payments/webhook | No | Async confirmation from payment processor (requires `x-webhook-secret`) |
