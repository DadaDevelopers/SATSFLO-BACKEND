# SatsFlo API Reference

**Base URL (production):** `https://satsflo-backend.onrender.com/api/v1`
**Local:** `http://localhost:3000/api/v1`
**Content-Type:** `application/json`

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```
Access tokens expire per `JWT_EXPIRES_IN` env var (default `15m`). Refresh with `POST /auth/refresh`. Refresh tokens rotate on every use.

**Response envelope (every endpoint):**
```json
{ "success": true,  "message": "...", "data": { ... },   "timestamp": "..." }
{ "success": false, "message": "...", "errors": [{ "field": "", "message": "" }] }
```
Frontend reads `response.data.data.<field>` (axios wraps response in `.data`; envelope wraps payload in `data`).

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Cycle Profile](#3-cycle-profile)
4. [Cycles](#4-cycles)
5. [Day Logs](#5-day-logs)
6. [Water Settings](#6-water-settings)
7. [Journal](#7-journal)
8. [Partner System](#8-partner-system)
9. [Wallet](#9-wallet)
10. [Payments](#10-payments)
11. [Chats (DMs)](#11-chats-dms)
12. [Groups](#12-groups)
13. [Community — Threads](#13-community--threads)
14. [Community — Notifications](#14-community--notifications)
15. [Health — Symptoms](#15-health--symptoms)
16. [Health — Moods](#16-health--moods)
17. [Health — Analytics](#17-health--analytics)
18. [Health — Vitals (Add Log)](#18-health--vitals-add-log)
19. [Lightning](#19-lightning)
20. [Enums & Constants](#20-enums--constants)
21. [Error Codes](#21-error-codes)
22. [Rate Limits](#22-rate-limits)



---

## 1. Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | — | Create account. Sends welcome email. |
| `POST` | `/auth/login` | — | Login with email + password. |
| `POST` | `/auth/refresh` | — | Swap refresh token. Body: `refreshToken` |
| `POST` | `/auth/logout` | ✓ | Revoke current device refresh token. Body: `refreshToken` |
| `POST` | `/auth/logout-all` | ✓ | Revoke all refresh tokens for this user. |
| `POST` | `/auth/forgot-password` | — | Send 6-digit OTP to email. Body: `email` |
| `POST` | `/auth/verify-otp` | — | Verify OTP. Body: `email, otp` → `{ reset_token }` |
| `POST` | `/auth/reset-password/:token` | — | Reset password. Body: `password, confirm_password` |
| `GET`  | `/auth/me` | ✓ | Returns `{ id, email, name, role, avatar, avatar_url, emailVerified }` |

**Register body:**
```json
{ "name": "Jane", "email": "jane@example.com", "password": "secret", "confirm_password": "secret" }
```

**Auth response** (register & login):
```json
{
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "user", "emailVerified": true },
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": "15m"
}
```

**Forgot-password flow (3 steps):**
```
POST /auth/forgot-password   { "email": "..." }
  → 200 OK  (OTP sent — generic success even if email not found)

POST /auth/verify-otp        { "email": "...", "otp": "123456" }
  → 200 OK  { "reset_token": "<32-byte hex>" }

POST /auth/reset-password/:token   { "password": "...", "confirm_password": "..." }
  → 200 OK
```

**OTP rules:** 6 digits · valid 10 min · max 3 requests per email per hour · brute-force locked after 5 wrong attempts.

---

## 2. Users

All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/users/profile` | Profile: `id, email, name, phone, avatar_url, date_of_birth, timezone, language, role` |
| `PUT`  | `/users/profile` | Update profile. Fields: `name, phone, date_of_birth, timezone, language` |
| `POST` | `/users/avatar` | Upload avatar (JSON). Body: `{ "avatar": "<base64 or data URL>" }` → updates `avatar_url` |
| `POST` | `/users/profile/avatar` | Upload avatar (multipart). Field: `file` (image, max 5 MB) → updates `avatar_url` |
| `GET`  | `/users/preferences` | Get reminder toggles + UI preferences |
| `PUT`  | `/users/preferences` | Update preferences (partial merge, no reset) |
| `GET`  | `/users/health-profile` | Health profile (decrypted) |
| `PUT`  | `/users/health-profile` | Update health profile |
| `GET`  | `/users/export` | GDPR data export (user + all records) |
| `DELETE` | `/users/account` | Delete account. Body: `{ "password": "..." }` |

**`GET /users/preferences` response:**
```json
{
  "reminders": {
    "periodStarts": true,
    "periodEnds":   true,
    "fertility":    false,
    "ovulation":    false,
    "medicine":     false
  }
}
```

**`PUT /users/preferences` body** (all optional, deep-merged into `reminders`):
```json
{
  "reminders": {
    "periodStarts": true,
    "periodEnds":   true,
    "fertility":    false,
    "ovulation":    false,
    "medicine":     false
  }
}
```

**`POST /users/profile/avatar` request:**
```
Content-Type: multipart/form-data
Field: file  (image/*, max 5 MB)
```
**Response:**
```json
{ "avatar_url": "data:image/jpeg;base64,..." }
```

> `health_conditions`, `medications`, `notes` (health profile) are AES-256-GCM encrypted at rest. Returned decrypted.

---

## 3. Cycle Profile

Lightweight settings widget. Separate from the full cycle tracking module.
All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/cycle-profile` | Create (or replace) profile. Returns full calculated response. |
| `PUT`  | `/cycle-profile` | Partial update — only updates fields you send. Returns full calculated response. |
| `GET`  | `/cycle-profile` | Get profile + live calculations. |

**POST body** (all snake_case — both camelCase and snake_case accepted):
```json
{
  "last_period_start":       "2026-03-10",
  "cycle_length":            28,
  "period_length":           5,
  "luteal_phase_length":     14,
  "ignore_irregular_cycle":  false
}
```

**GET / POST / PUT response** (calculations are live on every request):
```json
{
  "cycle_length":            28,
  "period_length":           5,
  "luteal_phase_length":     14,
  "last_period_start":       "2026-03-10",
  "ignore_irregular_cycle":  false,

  "current_day":       21,
  "ovulation_day":     14,
  "days_until_period": 7,
  "current_phase":     "luteal"
}
```

**Calculated field formulas:**
```
current_day       = (today_UTC - last_period_start) % cycle_length + 1
ovulation_day     = cycle_length - luteal_phase_length
days_until_period = cycle_length - current_day
current_phase:
  current_day <= period_length        → "menstrual"
  current_day <= ovulation_day - 2    → "follicular"
  current_day <= ovulation_day + 2    → "ovulation"
  else                                → "luteal"
```

**Constraints:** `cycle_length` 21–35 · `period_length` 3–9 · `luteal_phase_length` 7–21

**PUT is a true partial update** — sending `{ "period_length": 5 }` does not reset other fields.

---

## 4. Cycles

Full period tracking history. All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/cycles/start` | Start a new period. Body: `{ "start_date": "YYYY-MM-DD" }`. Syncs `last_period_start` in cycle profile. |
| `PUT`  | `/cycles/start` | Update start date of current period. Body: `{ "date": "YYYY-MM-DD" }` |
| `POST` | `/cycles/end` | End current period. Body: `{ "end_date": "YYYY-MM-DD" }` |
| `PUT`  | `/cycles/end` | Update end date of current period. Body: `{ "date": "YYYY-MM-DD" }` |
| `GET`  | `/cycles/current` | Current cycle status with phase + predictions |
| `GET`  | `/cycles/predictions` | Predictions only (next period, ovulation, fertile window) |
| `GET`  | `/cycles/phases` | Phase date ranges for the current cycle (wheel segments) |
| `GET`  | `/cycles/forecast?months=3` | Upcoming period + ovulation predictions for N months (max 12) |
| `GET`  | `/cycles/analytics` | Cycle analytics. Query: `startDate?, endDate?` (default: last 6 months) |
| `POST` | `/cycles/log` | Log a daily entry. Body: `date, flowIntensity?, temperature?, notes?` |
| `POST` | `/cycles/:cycleId/logs` | Log scoped to a specific cycle. |
| `GET`  | `/cycles/log/:date` | Get daily log for date (`YYYY-MM-DD`) |
| `GET`  | `/cycles` | Cycle history. Query: `page?, limit?, startDate?, endDate?` |
| `GET`  | `/cycles/:cycleId` | Single cycle by ID |
| `PUT`  | `/cycles/:cycleId` | Update cycle. Fields: `flowIntensity?, notes?, startDate?, endDate?` |
| `DELETE` | `/cycles/:cycleId` | Delete cycle |

### Calculation formulas

These drive every period/ovulation prediction in the API:

```
cycle_day         = floor((today_UTC - last_period_start) / 86400000) % cycle_length + 1
next_period_date  = last_period_start + (cycles_passed + 1) × cycle_length   ← uses cycle_length only
period_end_date   = next_period_date + period_length - 1
ovulation_day     = cycle_length - luteal_phase_length                        ← within the cycle
next_ovulation    = next_period_date - luteal_phase_length                    ← absolute date
fertile_window    = [next_ovulation - 5 … next_ovulation + 1]

Phase boundaries (cycle_day based):
  cycle_day ≤ period_length             → menstrual
  cycle_day ≤ ovulation_day - 2         → follicular
  cycle_day ≤ ovulation_day + 2         → ovulation
  else                                  → luteal
```

> **Important:** `next_period_date` is calculated from `cycle_length` **only** — changing `luteal_phase_length` in settings shifts where ovulation lands within the cycle but does **not** affect the predicted period date.

---

**`GET /cycles/current` response:**
```json
{
  "id": "uuid",
  "startDate":               "2026-03-10",
  "last_period_start":       "2026-03-10",
  "current_day":             21,
  "cycle_length":            28,
  "period_length":           5,
  "ovulation_day":           14,
  "current_phase":           "luteal",
  "days_until_next_period":  7,
  "period_dates":            ["2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14"],
  "fertility_window":        ["2026-03-18", "2026-03-19", "2026-03-20", "2026-03-21", "2026-03-22"],
  "ovulation_date":          "2026-03-23",
  "pregnancy_chance":        "Low",
  "phase": { "name": "luteal", "day": 21, "description": "Luteal phase - Post-ovulation" },
  "predictions": {
    "nextPeriod":    { "date": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "daysUntil": 7 },
    "ovulation":     { "date": "YYYY-MM-DD", "daysUntil": -7 },
    "fertileWindow": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
  }
}
```

> `last_period_start` is an alias for `startDate`.
> `period_dates` — array of YYYY-MM-DD strings for each day of the period (length = `period_length`).
> `fertility_window` — 5 dates from `ovulation_day - 5` to `ovulation_day - 1` as absolute dates.
> `ovulation_date` — absolute date string for the ovulation day of the current cycle.
> `pregnancy_chance` — `"High"` (within fertile window + 1 day of ovulation), `"Medium"` (within ±2 days beyond that), `"Low"` (otherwise).
> `days_until_next_period` — use this field on the home/wheel screen (includes `next_`).
> Returns `null` data with `200 OK` if no active cycle exists.

---

**`GET /cycles/predictions` response:**
```json
{
  "nextPeriod": {
    "date":     "2026-04-07",
    "endDate":  "2026-04-11",
    "daysUntil": 7
  },
  "ovulation": {
    "date":     "2026-03-24",
    "daysUntil": -7
  },
  "fertileWindow": {
    "start": "2026-03-19",
    "end":   "2026-03-25"
  }
}
```

> Returns `null` data with `200 OK` if no cycle exists.
> `daysUntil` is negative once the date has passed.

---

**`GET /cycles/phases` response:**
```json
{
  "current_day": 21,
  "cycle_start": "2026-03-10",
  "phases": {
    "menstrual":  { "start": "2026-03-10", "end": "2026-03-14", "days": 5 },
    "follicular": { "start": "2026-03-15", "end": "2026-03-21", "days": 7 },
    "ovulation":  { "start": "2026-03-22", "end": "2026-03-26", "days": 5 },
    "luteal":     { "start": "2026-03-27", "end": "2026-04-06", "days": 11 }
  }
}
```

> All dates are absolute YYYY-MM-DD strings anchored to the current cycle's start date.
> Used to render the four wheel segments. `days` is the width of each segment.
> Returns `null` data with `200 OK` if no cycle exists.

---

**`GET /cycles/forecast?months=3` response:**
```json
{
  "cycle_length":  28,
  "period_length": 5,
  "periods": [
    { "start": "2026-04-07", "end": "2026-04-11" },
    { "start": "2026-05-05", "end": "2026-05-09" },
    { "start": "2026-06-02", "end": "2026-06-06" }
  ],
  "ovulations": [
    { "date": "2026-03-24", "fertile_start": "2026-03-19", "fertile_end": "2026-03-25" },
    { "date": "2026-04-21", "fertile_start": "2026-04-16", "fertile_end": "2026-04-22" },
    { "date": "2026-05-19", "fertile_start": "2026-05-14", "fertile_end": "2026-05-20" }
  ]
}
```

> `months` query param: 1–12, default 3. Capped at 12 server-side.
> `ovulation.date` is computed as `period_start - luteal_phase_length` (respects user's saved luteal phase setting).
> `fertile_start` is 5 days before ovulation; `fertile_end` is 1 day after.
> Returns `null` data with `200 OK` if no cycle history exists.

---

**`GET /cycles/analytics` response:**
```json
{
  "totalCycles":         6,
  "averageCycleLength":  28,
  "averagePeriodLength": 5,
  "shortestCycle":       26,
  "longestCycle":        30,
  "cycleVariability":    2,
  "cycles":              [ /* array of cycle objects */ ]
}
```

> Default date range: last 6 months. Pass `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` to override.
> `cycleVariability` is the standard deviation of cycle lengths (rounded). `null` if fewer than 2 cycles.
> `averageCycleLength` / `averagePeriodLength` are `null` when there is not enough data.

---

**Flow intensity:** `spotting` · `light` · `medium` · `heavy` · `very_heavy`

---

## 5. Day Logs

One log per calendar date. All fields are optional; only fields present in the PUT body are updated. All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/logs/:date` | Get log for a date (path param). Always returns a full object (never null). |
| `GET`  | `/logs?date=YYYY-MM-DD` | Same as above (query param variant). |
| `GET`  | `/logs/range?from=YYYY-MM-DD&to=YYYY-MM-DD` | All logs in date range. |
| `PUT`  | `/logs/:date` | Upsert log for `:date`. Safe to call multiple times (partial update). |

**`PUT /logs/:date` body** — all fields optional, both frontend and DB names accepted:

| Accepted name | Also accepts | Type | Notes |
|--------------|--------------|------|-------|
| `flow_level` | `flow` | string | See flow enum below |
| `mood` | `moods` | string \| string[] | Stored as array |
| `notes` | `note` | string | |
| `symptoms` | — | string[] | |
| `medicine` | — | string[] | See medicine enum |
| `weight` | — | number \| string | Parsed to numeric |
| `weight_unit` | — | string | `"kg"` or `"lb"` |
| `temperature` | — | number \| string | Parsed to numeric |
| `temperature_unit` | — | string | `"C"` or `"F"` |
| `water_intake_ml` | `water_intake` | number | Millilitres |
| `period_start` | — | boolean | |
| `period_end` | — | boolean | |

**`GET /logs/:date` response** (always a full object, defaults shown when no log exists):
```json
{
  "flow_level":       "veryHeavy",
  "symptoms":         ["cramps", "headache"],
  "mood":             ["happy"],
  "notes":            "Feeling okay",
  "medicine":         ["pill"],
  "weight":           65.5,
  "weight_unit":      "kg",
  "temperature":      36.6,
  "temperature_unit": "C",
  "water_intake_ml":  1500,
  "period_start":     false,
  "period_end":       false
}
```

> `flow_level` is returned in camelCase (`veryHeavy`) to match frontend expectations. Input accepts both `veryHeavy` and `very_heavy`.

---

## 6. Water Settings

All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/water-settings` | Returns settings. Returns defaults if none set. |
| `PUT`  | `/water-settings` | Upsert settings. |

**GET response:**
```json
{
  "water_target":  2000,
  "daily_goal_ml": 2000,
  "cup_capacity":  250,
  "cup_style":     "standard"
}
```

**PUT body** (all optional):
```json
{
  "daily_goal_ml": 2000,
  "cup_capacity":  250,
  "cup_style":     "standard"
}
```
> `daily_goal_ml` is accepted as alias for `water_target`. Both work on input; both appear in response.

---

## 7. Journal

Private diary. All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/journal?month=YYYY-MM` | All entries for a calendar month, ordered newest first. |
| `GET`  | `/journal/search?q=text&month=YYYY-MM` | Full-text search in title + content. `month` is optional. Max 50 results. |
| `POST` | `/journal/media` | Upload images/videos. Returns base64 data URLs to embed in `images[]`. |
| `POST` | `/journal` | Create entry. |
| `GET`  | `/journal/:id` | Get single entry by ID. |
| `PUT`  | `/journal/:id` | Update entry (partial — only sent fields are changed). |
| `DELETE` | `/journal/:id` | Delete entry. |

**`POST /journal/media` request:**
```
Content-Type: multipart/form-data
Field: files  (up to 5 files, images or video, max 10 MB each)
```
**Response:**
```json
{ "urls": ["data:image/jpeg;base64,...", "data:video/mp4;base64,..."] }
```
Use the returned `urls` in the `images[]` array when creating or updating an entry.

**`POST /journal` body:**
```json
{
  "date":     "2026-03-31",
  "title":    "Day 21",
  "content":  "Feeling good today",
  "mood":     "happy",
  "symptoms": ["Clear skin", "High energy"],
  "images":   ["data:image/jpeg;base64,..."]
}
```
> `title`, `mood`, `symptoms`, `images` are optional. `content` may be empty string.
> `date` and `entry_date` are both accepted.

**`GET /journal` list item / `GET /journal/:id` / `POST` / `PUT` response:**
```json
{
  "id":         "uuid",
  "date":       "2026-03-31",
  "title":      "Day 21",
  "content":    "Feeling good today",
  "mood":       "happy",
  "symptoms":   ["Clear skin", "High energy"],
  "images":     ["data:image/jpeg;base64,..."],
  "cycle_day":  21,
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```
> `cycle_day` is computed from `cycle_profiles.last_period_start`. Returns `null` if no cycle profile exists.

**`PUT /journal/:id` body** (all optional):
```json
{
  "title":    "Updated title",
  "content":  "Updated content",
  "mood":     "calm",
  "symptoms": ["Bloating"],
  "images":   [],
  "date":     "2026-03-31"
}
```

**Valid mood values:** `normal` · `happy` · `sad` · `calm` · `hyped` · `inlove` · `peaceful` · `angry` · `lonely` · `silly` · `relaxed`

---

## 8. Partner System

All require `Authorization: Bearer <token>`.

### Sender flow

| Step | Method | Endpoint | Description |
|------|--------|----------|-------------|
| 1 | `POST` | `/partner/invite` | Set sharing options + generate 6-char code. Expires 24 h. |
| 2 | `GET`  | `/partner/invite/status` | Poll until `status = "accepted"` (receiver has connected). |
| 3 | `PUT`  | `/partner/nickname` | Save nicknames after pairing is confirmed. |

**`POST /partner/invite` body** (sharing options selected on the Sharing Options screen):
```json
{
  "share_period_dates":   true,
  "share_fertile_window": true,
  "share_symptoms_moods": false,
  "share_cycle_insights": false,
  "share_sex_drive":      false
}
```
All sharing fields are optional — defaults: `period_dates=true`, `fertile_window=true`, rest `false`.

**`POST /partner/invite` response:**
```json
{
  "invite_code":          "X9L4Q8",
  "expires_at":           "2026-04-08T14:30:00Z",
  "share_url":            "https://satsflo.app/invite?code=X9L4Q8",
  "share_period_dates":   true,
  "share_fertile_window": true,
  "share_symptoms_moods": false,
  "share_cycle_insights": false,
  "share_sex_drive":      false
}
```
> `share_url` is the link to use with the native share sheet when the user taps "Share my code".
> Opening `share_url` on a device with the app installed deep-links to the "Enter Code to Connect" screen with the code pre-filled.
> Opening it without the app shows a web landing page with the code + App Store / Play Store download links.
> Configured via `APP_URL` env var (default `https://satsflo.app`).

**`GET /partner/invite/status` response:**
```json
{
  "invite_code": "X9L4Q8",
  "status":      "accepted",
  "expires_at":  "2026-04-08T14:30:00Z",
  "partner":     { "id": "uuid", "name": "Sarah", "avatar_url": "..." }
}
```
`status` values: `none` · `pending` · `accepted` · `expired`

---

### Receiver flow

| Step | Method | Endpoint | Description |
|------|--------|----------|-------------|
| 1 | `POST` | `/partner/accept` | Enter the 6-char code to pair. |
| 2 | `PUT`  | `/partner/nickname` | Save nicknames after success screen. |

**`POST /partner/accept` body:**
```json
{ "invite_code": "X9L4Q8" }
```
**Response:**
```json
{
  "partnership_id": "uuid",
  "partner": { "id": "uuid", "name": "Sarah", "avatar_url": "..." }
}
```

---

### Nicknames (both sender and receiver — runs after pairing)

**`PUT /partner/nickname` body:**
```json
{
  "my_nickname":      "My Love",
  "partner_nickname": "Babe"
}
```
Both fields are optional — send one or both. The two Figma screens ("What name does your partner call you?" and "Any nickname you have for your partner?") can each call this endpoint individually or be combined into one call on Done.

**Response:**
```json
{ "my_nickname": "My Love", "partner_nickname": "Babe" }
```

---

### After pairing — management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/partner` | My Partner screen data |
| `DELETE` | `/partner` | Unpair (Unpair with Partner dialog → Yes, Unpair) |
| `GET`    | `/partner/settings` | My current sharing permissions |
| `PUT`    | `/partner/settings` | Update what I share with my partner |
| `PUT`    | `/partner/mode` | Toggle partner mode (Switch to my partner's cycle) |
| `GET`    | `/partner/cycle` | View partner's cycle data |
| `GET`    | `/partner/calendar` | View partner's calendar |

**`GET /partner` response** (My Partner screen):
```json
{
  "partnership_id":      "uuid",
  "partner":             { "id": "uuid", "name": "Sarah", "avatar_url": "..." },
  "my_nickname":         "My Love",
  "partner_nickname":    "Babe",
  "partner_mode_enabled": false,
  "connected_since":     "2026-04-06T10:00:00Z",
  "my_sharing": {
    "share_period_dates":   true,
    "share_fertile_window": true,
    "share_symptoms_moods": false,
    "share_cycle_insights": false,
    "share_sex_drive":      false
  }
}
```
> "Paired for X day(s)" — calculate on frontend: `Math.floor((Date.now() - new Date(connected_since)) / 86400000)`.

**`PUT /partner/settings` body** (all optional, partial update):
```json
{
  "share_period_dates":   true,
  "share_fertile_window": true,
  "share_symptoms_moods": true,
  "share_cycle_insights": false,
  "share_sex_drive":      false
}
```

**`PUT /partner/mode` body:**
```json
{ "partner_mode_enabled": true }
```

---

### Partner cycle view ("Babe's Cycle")

**`GET /partner/cycle` response** (filtered by partner's sharing settings):
```json
{
  "partner_name":        "Sarah",
  "partner_nickname":    "Babe",
  "partner_avatar_url":  "...",
  "cycle_day":           12,
  "cycle_phase":         "ovulation",
  "phase_description":   "Your partner is in the ovulation period. Keep in touch and stay connected.",
  "next_period_days":    15,
  "next_ovulation_days": 7,
  "pregnancy_chance":    "Low",
  "todays_symptoms":     ["cramps", "headache"],
  "moods":               ["happy", "calm"],
  "sex_drive":           null
}
```
> `partner_nickname` is used as the screen heading — e.g. "Babe's Cycle".
> `todays_symptoms` and `moods` are read from the partner's `day_logs` for today. Both are `null` if `share_symptoms_moods = false`.
> `sex_drive` is always `null` — not yet a tracked field. Field is omitted from response if `share_sex_drive = false`.
> `phase_description` values by phase:
> - `menstrual` → "Your partner is in their period. They may need some extra care right now."
> - `follicular` → "Your partner is in the follicular phase. Energy levels are rising."
> - `ovulation`  → "Your partner is in the ovulation period. Keep in touch and stay connected."
> - `luteal`     → "Your partner is in the luteal phase. They may experience mood changes."

**`GET /partner/calendar` response** (filtered by sharing settings):
```json
{
  "period_days":     ["2026-04-21", "2026-04-22", "2026-04-23", "2026-04-24", "2026-04-25"],
  "fertility_window": ["2026-04-11", "2026-04-12", "2026-04-13", "2026-04-14", "2026-04-15", "2026-04-16"],
  "ovulation_day":   "2026-04-16",
  "cycle_count":     4
}
```
> `period_days` is `null` if `share_period_dates = false`.
> `fertility_window` and `ovulation_day` are `null` if `share_fertile_window = false`.
> Returns 403 if partner has disabled both `share_period_dates` and `share_fertile_window`.

---

## 9. Wallet

All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/wallet/lightning` | Returns `{ lightning_address }` (null if not set) |
| `PUT`  | `/wallet/lightning` | Save address. Body: `{ "lightning_address": "user@domain.com" }` |

---

## 10. Payments

All require `Authorization: Bearer <token>` except `/webhook`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/payments/btc-price` | ✓ | Current BTC/USD price for USD ↔ SATS conversion. Cached 2 min. |
| `POST` | `/payments/validate` | ✓ | Validate LN address before amount entry. Body: `{ lightning_address }` |
| `POST` | `/payments/tip` | ✓ | Create tip + fetch invoice. Returns bolt11 + payment_hash. |
| `POST` | `/payments/confirm` | ✓ | Mark payment sent. Body: `{ payment_hash }` |
| `GET`  | `/payments/status/:paymentHash` | ✓ | Poll status: `pending\|completed\|failed` |
| `GET`  | `/payments/history?type=sent` | ✓ | Tx history. Query: `type=sent\|received` |
| `POST` | `/payments/webhook` | — | Provider webhook. Header: `x-webhook-secret` |

### Gift Token flow (Figma screens)

```
Screen 1: Intro          → no API call
Screen 2: Choose action  → no API call

Screen 3: Send Gift Token (destination + amount + note)
  1. GET  /payments/btc-price     → sats_per_usd for the USD↔SATS amount toggle
  2. POST /payments/validate      → confirm address reachable, get min/max sats
  3. POST /payments/tip           → on "Create Invoice" tap

Screen 4: Create Invoice (QR code + countdown)
  → render bolt11_invoice as QR code
  → countdown timer from expires_at (10 min window)
  → "I have sent the tip" → POST /payments/confirm

Screen 5: Success "Your SATS was sent successfully!!"
```

### `GET /payments/btc-price` response:
```json
{
  "btc_usd":      94250.00,
  "sats_per_usd": 1060,
  "updated_at":   "2026-04-07T14:30:00Z"
}
```
> `amount_sats = Math.round(usd_amount * sats_per_usd)`.
> Fetched from CoinGecko, cached 2 min. Returns stale cache if CoinGecko is unreachable (502 if no cache).

### `POST /payments/validate` body:
```json
{ "lightning_address": "Sarahabraham@blink.sv" }
```
**Response:** `{ "valid": true, "min_sats": 1, "max_sats": 1000000, "comment_allowed": 140 }`
> Call when the user finishes entering the destination. Use `min_sats`/`max_sats` to clamp the amount input.

### `POST /payments/tip` body:
```json
{
  "lightning_address": "Sarahabraham@blink.sv",
  "amount_sats":       106700,
  "note":              "For flowers"
}
```
Or tip a SatsFlo user by ID (looks up their saved lightning address):
```json
{ "recipient_id": "uuid", "amount_sats": 106700, "note": "Great post!", "thread_id": "uuid" }
```
**Response:**
```json
{
  "transaction_id":    "uuid",
  "bolt11_invoice":    "lnbc10760nx...",
  "payment_hash":      "abc123...",
  "amount_sats":       106700,
  "expires_at":        "2026-04-07T14:40:00Z",
  "lightning_address": "Sarahabraham@blink.sv"
}
```
> `bolt11_invoice` → render as QR code. Also display truncated as wallet address text.
> `expires_at` → drive the countdown timer. Invoice window is 10 min.
> BTC display: `amount_sats / 100_000_000`.

### `POST /payments/confirm` body:
```json
{ "payment_hash": "abc123..." }
```
> Returns 409 if already confirmed, 410 if invoice expired.

### `GET /payments/history` response:
```json
[
  {
    "id":                "uuid",
    "amount_sats":       106700,
    "status":            "completed",
    "note":              "For flowers",
    "created_at":        "ISO timestamp",
    "payment_hash":      "abc123...",
    "lightning_address": "Sarahabraham@blink.sv",
    "recipient":         null
  }
]
```
> `recipient` / `sender` is `null` when the counterparty is an external Lightning address (not a SatsFlo user).

---

## 11. Chats (DMs)

All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/chats` | List conversations. |
| `POST`   | `/chats` | Start conversation. Body: `{ "recipient_id": "uuid" }`. Idempotent. |
| `GET`    | `/chats/:conversationId` | Get messages. Query: `page?, limit?` (default 50, newest first). |
| `POST`   | `/chats/:conversationId` | Send message. Body: `{ "content": "..." }` |
| `DELETE` | `/chats/:conversationId/:messageId` | Soft-delete own message. |
| `PUT`    | `/chats/:conversationId/read` | Mark all messages as read. |
| `POST`   | `/chats/:conversationId/typing` | Body: `{ "is_typing": true }`. State expires after 5s. |

**`GET /chats` conversation item:**
```json
{
  "id":           "uuid",
  "conversation_id": "uuid",
  "recipient":    { "id": "uuid", "name": "...", "avatar_url": "..." },
  "name":         "Jane",
  "last_message": "Hey!",
  "updated_at":   "ISO timestamp",
  "is_online":    false,
  "unread_count": 2
}
```

**`GET /chats/:conversationId` response:**
```json
{
  "messages": [
    {
      "id":         "uuid",
      "content":    "Hey!",
      "is_sent":    true,
      "sender_id":  "uuid",
      "created_at": "ISO timestamp"
    }
  ]
}
```

---

## 12. Groups

All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/groups` | List groups you're a member of. |
| `POST`   | `/groups` | Create group. Body: `{ name, description?, member_ids?: [] }`. Creator becomes admin. |
| `GET`    | `/groups/:groupId` | Group info + full member list with roles. |
| `PUT`    | `/groups/:groupId` | Update. Body: `{ name?, description? }`. Admin only. |
| `DELETE` | `/groups/:groupId` | Delete. Admin only. |
| `POST`   | `/groups/:groupId/members` | Add member. Body: `{ "user_id": "uuid" }`. Admin only. |
| `DELETE` | `/groups/:groupId/members/:userId` | Remove member. Admin only. |
| `POST`   | `/groups/:groupId/leave` | Leave group. Fails if only admin. |
| `GET`    | `/groups/:groupId/messages` | Messages. Query: `page?, limit?` |
| `POST`   | `/groups/:groupId/messages` | Send message. Body: `{ "content": "..." }` |
| `DELETE` | `/groups/:groupId/messages/:messageId` | Soft-delete (own or admin). |

**`GET /groups` group item:**
```json
{
  "id":            "uuid",
  "name":          "SatsFlo Chat",
  "last_message":  "Hello!",
  "members_count": 5
}
```

---

## 13. Community — Threads

Read endpoints are public. Write endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/threads` | Optional | List threads. Query: `tab=recent\|popular, search?, page?, limit?` |
| `POST` | `/threads` | ✓ | Create thread. Body: `{ "content": "..." }` (title/category accepted but not stored) |
| `GET`  | `/threads/:id` | Optional | Single thread with comments. |
| `PUT`  | `/threads/:id` | ✓ | Update (own only). Body: `{ content?, image_url? }` |
| `DELETE` | `/threads/:id` | ✓ | Delete (own or admin). |
| `GET`  | `/threads/:id/comments` | Optional | List comments. |
| `POST` | `/threads/:id/comments` | ✓ | Add comment. Body: `{ "content": "..." }` |
| `PUT`  | `/threads/:id/comments/:commentId` | ✓ | Update comment (own only). |
| `DELETE` | `/threads/:id/comments/:commentId` | ✓ | Delete (own or admin). |
| `POST` | `/threads/:id/like` | ✓ | Like. Returns `{ like_count, is_liked_by_me: true }` |
| `DELETE` | `/threads/:id/like` | ✓ | Unlike. Returns `{ like_count, is_liked_by_me: false }` |

**Thread item (list and single):**
```json
{
  "id":             "uuid",
  "content":        "...",
  "user":           { "id": "uuid", "name": "Jane", "avatar_url": "..." },
  "created_at":     "ISO timestamp",
  "likes_count":    4,
  "comments_count": 2,
  "is_liked":       false
}
```

---

## 14. Community — Notifications

All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/notifications` | Last 50 notifications. |
| `PATCH`  | `/notifications/read-all` | Mark all as read. |
| `PATCH`  | `/notifications/:notificationId/read` | Mark one as read. |

**Notification item:**
```json
{
  "id":         "uuid",
  "type":       "like",
  "message":    "Someone liked your post",
  "created_at": "ISO timestamp",
  "read":       false,
  "is_read":    false,
  "actor":      { "id": "uuid", "name": "...", "avatar_url": "..." }
}
```

**Notification types:** `comment` · `like`
Auto-generated by DB triggers when someone comments on or likes a thread.

---

## 15. Health — Symptoms

All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/health/symptoms` | Log symptom. Body: `date, symptom, category, severity, timeOfDay?, notes?` |
| `POST` | `/health/symptoms/batch` | Batch log. Body: `date, symptoms: [{ symptom, category, severity }]` |
| `GET`  | `/health/symptoms` | List. Query: `startDate?, endDate?, category?, page?, limit?` |
| `GET`  | `/health/symptoms/date/:date` | All symptoms for a date. |
| `PUT`  | `/health/symptoms/:id` | Update. Fields: `severity?, notes?` |
| `DELETE` | `/health/symptoms/:id` | Delete. |

**Categories:** `physical` · `emotional` · `pain` · `digestive` · `skin` · `sleep`
**Severity:** `1` (mild) → `5` (severe)

---

## 16. Health — Moods

All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/health/moods` | Log mood. Body: `date, mood, intensity, notes?, triggers?[]` |
| `POST` | `/health/moods/batch` | Batch log. Body: `date, moods: [{ mood, intensity }]` |
| `GET`  | `/health/moods` | List. Query: `startDate?, endDate?, mood?, page?, limit?` |
| `GET`  | `/health/moods/date/:date` | All moods for a date. |
| `PUT`  | `/health/moods/:id` | Update. Fields: `intensity?, notes?` |
| `DELETE` | `/health/moods/:id` | Delete. |

**Moods:** `happy` · `sad` · `irritable` · `anxious` · `energetic` · `tired` · `calm` · `stressed` · `emotional` · `confident`

---

## 17. Health — Analytics

All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/health/analytics/symptoms` | Top symptoms, category breakdown. Query: `startDate?, endDate?` |
| `GET`  | `/health/analytics/moods` | Mood distribution, avg intensity. Query: `startDate?, endDate?` |
| `GET`  | `/health/summary/:date` | Combined symptoms + moods for one date. |
| `GET`  | `/health/trends/:cycleId` | Symptom & mood data correlated by cycle day. |

---

## 18. Health — Vitals (Add Log)

Shortcut endpoints for the Add Log screen. Each call upserts the corresponding field in `day_logs` for today (or a specified date). All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/health/flow` | Log flow level for today. Body: `{ "date": "YYYY-MM-DD", "flow": "heavy" }` |
| `PUT`  | `/health/flow` | Same as POST (idempotent alias). |
| `POST` | `/health/medicine` | Log medicine taken. Body: `{ "date": "YYYY-MM-DD", "medicine": ["pill"] }` |
| `PUT`  | `/health/medicine` | Same as POST (idempotent alias). |
| `POST` | `/health/weight` | Log weight. Body: `{ "date": "YYYY-MM-DD", "weight": 65.5, "weight_unit": "kg" }` |
| `PUT`  | `/health/weight` | Same as POST (idempotent alias). |
| `GET`  | `/health/weight` | Last 30 days of weight entries. Query: none. |
| `POST` | `/health/temperature` | Log basal body temperature. Body: `{ "date": "YYYY-MM-DD", "temperature": 36.6, "temperature_unit": "C" }` |
| `PUT`  | `/health/temperature` | Same as POST (idempotent alias). |
| `GET`  | `/health/temperature` | Last 30 days of temperature entries. Query: none. |

**Flow body:**
```json
{ "date": "2026-04-07", "flow": "heavy" }
```
> `flow` and `flow_level` both accepted. Values: `spotting` · `light` · `medium` · `heavy` · `very_heavy` (also accepts camelCase `veryHeavy`).

**Medicine body:**
```json
{ "date": "2026-04-07", "medicine": ["pill", "ibuprofen"] }
```
> Standard values: `condom` · `patch` · `injection` · `spermicide` · `iud` · `pill` · `implant` · `vaginal_ring`. Free-form strings also accepted.

**Weight / Temperature body:**
```json
{ "date": "2026-04-07", "weight": 65.5, "weight_unit": "kg" }
{ "date": "2026-04-07", "temperature": 36.6, "temperature_unit": "C" }
```
> `weight` and `temperature` accept numeric strings (e.g. `"65.5"`).

**`GET /health/weight` and `GET /health/temperature` response:**
```json
[
  { "date": "2026-04-07", "weight": 65.5, "weight_unit": "kg" },
  { "date": "2026-04-06", "weight": 65.2, "weight_unit": "kg" }
]
```

---

## 19. Lightning

Direct Lightning wallet integration. All require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/lightning/wallet` | Wallet balance + info. |
| `POST` | `/lightning/wallet/sync` | Sync wallet state. |
| `POST` | `/lightning/invoices` | Create invoice. |
| `POST` | `/lightning/payments/probe` | Probe route. Body: `bolt11` |
| `POST` | `/lightning/payments/pay` | Pay invoice. Body: `bolt11` |
| `POST` | `/lightning/payments/preview` | Preview payment. Body: `bolt11` |
| `POST` | `/lightning/payments/lnurl` | Pay via LNURL. Body: `lnurl` |
| `POST` | `/lightning/payments/ln-address` | Pay to LN address. Body: `ln_address, amount_sats` |
| `GET`  | `/lightning/transactions` | Transaction history. |
| `GET`  | `/lightning/proof-of-payment?payment_hash=...` | Payment proof. |

---

## 20. Enums & Constants

| Group | Values |
|-------|--------|
| Cycle phases | `menstrual` · `follicular` · `ovulation` · `luteal` |
| Flow intensity | `spotting` · `light` · `medium` · `heavy` · `very_heavy` (API input also accepts `veryHeavy`) |
| Cervical mucus | `dry` · `sticky` · `creamy` · `watery` · `egg_white` |
| Symptom categories | `physical` · `emotional` · `pain` · `digestive` · `skin` · `sleep` |
| Day-log moods | `happy` · `sad` · `irritable` · `anxious` · `energetic` · `tired` · `calm` · `stressed` · `emotional` · `confident` · `normal` · `hyped` · `in_love` · `peaceful` · `angry` · `lonely` · `silly` · `relaxed` |
| Journal moods | `normal` · `happy` · `sad` · `calm` · `hyped` · `inlove` · `peaceful` · `angry` · `lonely` · `silly` · `relaxed` |
| Medicine (standard) | `condom` · `patch` · `injection` · `spermicide` · `iud` · `pill` · `implant` · `vaginal_ring` (free-form strings also accepted) |
| Weight units | `kg` · `lb` |
| Temperature units | `C` · `F` |
| Pregnancy chance | `High` · `Medium` · `Low` |
| Notification types | `comment` · `like` |
| Account status | `active` · `inactive` · `suspended` · `deleted` |
| Payment status | `pending` · `completed` · `failed` |
| Themes | `light` · `dark` · `system` |
| Privacy | `private` · `friends` · `public` |
| Language | `English` · `Spanish` · `Swahili` · `Arabic` · `Hindi` · `French` · `German` · `Russian` · `Mandarin` · `Portuguese` · `Indonesia` · `Urdu` (legacy codes `en` · `sw` · `fr` · `es` · `pt` also accepted) |

---

## 21. Error Codes

| Status | Meaning |
|--------|---------|
| `400` | Bad Request — invalid or missing input |
| `401` | Unauthorized — token missing, expired, or invalid |
| `403` | Forbidden — insufficient permissions |
| `404` | Not Found |
| `409` | Conflict — e.g. duplicate email or already has partner |
| `410` | Gone — invite code expired |
| `422` | Unprocessable — business rule violation (e.g. no lightning address set) |
| `429` | Too Many Requests — rate limited |
| `500` | Internal Server Error |
| `502` | Bad Gateway — upstream Lightning service unreachable |
| `503` | Service Unavailable — e.g. email delivery failed during OTP send |

---

## 22. Rate Limits

| Group | Limit |
|-------|-------|
| General API | 100 req / 15 min |
| Auth (login/refresh) | 5 req / 15 min |
| OTP (forgot-password) | 3 req / hour per email |
| Registration | 5 req / hour |
| Sensitive data (health) | 30 req / min |

---

## Notes

- All dates: `YYYY-MM-DD`. All timestamps: ISO 8601 UTC.
- Cycle calculations use UTC date math — no timezone offset issues.
- Upsert endpoints (`PUT /logs/:date`, `PUT /water-settings`, `POST /cycle-profile`) are safe to call multiple times.
- `PUT /cycle-profile` is a **true partial update** — only the fields you send are changed; others are preserved.
- `PUT /logs/:date` is also a partial update — only the fields present in the request body are written.
- `POST /cycles/start` automatically updates `cycle_profiles.last_period_start` to keep the cycle wheel in sync.
- `PUT /cycles/start` and `PUT /cycles/end` update an existing period's dates without creating a new cycle.
- `GET /logs/:date` always returns a full object with all fields set to their defaults — never returns `null` or empty body.
- Avatar upload supports both JSON (`POST /users/avatar`, field `avatar`) and multipart (`POST /users/profile/avatar`, field `file`).
- Journal `symptoms` are free-form tags stored in `journal_entries` — separate from the structured day-log symptoms in `health_symptoms`.
- Journal `images` are base64 data URLs. Upload via `POST /journal/media` first, then embed the returned URLs.
- `cycle_day` in journal entries is computed at read time from `cycle_profiles.last_period_start`; it is `null` if no cycle profile exists.
- Health fields (`health_conditions`, `medications`, `notes` in health profile) are encrypted at rest with AES-256-GCM. Returned decrypted.
- OTP codes are 6 digits, cryptographically secure (`crypto.randomInt`), valid 10 min, max 3/hour per email.
- Lightning invoices expire in 10 min. After expiry `GET /payments/status` returns `status: failed`.
- Pending migrations to run before next deploy:
  - `20260322000000_day_logs_units.js` — adds `weight_unit`, `temperature_unit` columns; expands flow CHECK to include `very_heavy`
  - `20260322000001_journal_symptoms_images.js` — adds `symptoms TEXT[]` and `images TEXT[]` to `journal_entries`
