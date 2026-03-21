# Satsflow API Reference

**Base URL** `http://localhost:3000/api/v1`
**Production** set via `EXPO_PUBLIC_API_URL` env var
**Content-Type** `application/json`

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```
Access tokens expire in `15m`. Refresh with `POST /auth/refresh`. Refresh tokens rotate on every use.

**Response envelope** (all endpoints):
```
{ "success": true, "message": "...", "data": { ... } }
{ "success": false, "message": "...", "errors": [{ "field": "", "message": "" }] }
```

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Cycle Profile](#3-cycle-profile)
4. [Cycles](#4-cycles)
5. [Day Logs](#5-day-logs)
6. [Health — Symptoms](#6-health--symptoms)
7. [Health — Moods](#7-health--moods)
8. [Health — Analytics & Summaries](#8-health--analytics--summaries)
9. [Journal](#9-journal)
10. [Water Settings](#10-water-settings)
11. [Wallet](#11-wallet)
12. [Partner System](#12-partner-system)
13. [Chats (DMs)](#13-chats-dms)
14. [Groups](#14-groups)
15. [Community — Threads](#15-community--threads)
16. [Community — Notifications](#16-community--notifications)
17. [Payments](#17-payments)
18. [Enums & Constants](#18-enums--constants)
19. [Error Codes](#19-error-codes)
20. [Rate Limits](#20-rate-limits)

---

## 1. Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | — | Create account. Sends welcome email. Body: `name, email, password, confirm_password` |
| `POST` | `/auth/login` | — | Login. Body: `email, password` |
| `POST` | `/auth/refresh` | — | Swap refresh token for new pair. Body: `refreshToken` |
| `POST` | `/auth/logout` | ✓ | Revoke current device refresh token. Body: `refreshToken` |
| `POST` | `/auth/logout-all` | ✓ | Revoke all refresh tokens for this user |
| `POST` | `/auth/forgot-password` | — | Send 4-digit OTP to email. Body: `email` |
| `POST` | `/auth/verify-otp` | — | Verify 4-digit OTP (forgot-password flow only). Body: `email, otp` → returns `{ reset_token }` |
| `POST` | `/auth/reset-password/:token` | — | Reset password. Path: `token`. Body: `password, confirm_password` |
| `PUT`  | `/auth/change-password` | ✓ | Change password. Body: `currentPassword, newPassword` |
| `GET`  | `/auth/me` | ✓ | Returns `{ id, email, role }` for the authenticated user |

**Auth response** (register & login):
```
{ user: { id, email, name, role, emailVerified: true }, accessToken, refreshToken, expiresIn }
```

**Forgot password flow:**
```
POST /auth/forgot-password   { email }            → 4-digit OTP sent to email
POST /auth/verify-otp        { email, otp }        → { reset_token }  (valid 15 min)
POST /auth/reset-password/:token  { password, confirm_password }
```

---

## 2. Users

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/users/profile` | Get profile: `id, email, name, phone, avatar_url, date_of_birth, timezone, role, email_verified` |
| `PUT`  | `/users/profile` | Update profile. Fields: `name, phone, date_of_birth, timezone, avatar_url, language` |
| `GET`  | `/users/health-profile` | Get health profile (decrypted) |
| `PUT`  | `/users/health-profile` | Update health profile. Fields: `blood_type, height_cm, weight_kg, health_conditions, medications, notes` |
| `GET`  | `/users/preferences` | Get notification & UI preferences |
| `PUT`  | `/users/preferences` | Update preferences. Fields: `notifications_enabled, reminder_time, theme, language` |
| `GET`  | `/users/export` | Full GDPR data export (user + all health records) |
| `DELETE` | `/users/account` | Delete account. Body: `password` (required confirmation) |

> `health_conditions`, `medications`, `notes` are AES-256-GCM encrypted at rest. Returned decrypted.

---

## 3. Cycle Profile

Lightweight widget data. Separate from the full cycle tracking module.
All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/cycle-profile` | Create or replace profile. Body: `cycle_length, period_length, last_period_start, luteal_phase_length?, ignore_irregular_cycle?` |
| `PUT`  | `/cycle-profile` | Partial update. All fields optional: `cycle_length?, period_length?, last_period_start?, luteal_phase_length?, ignore_irregular_cycle?` |
| `GET`  | `/cycle-profile` | Get profile + live calculations: `current_day, days_until_period, current_phase` |

**Constraints:** `cycle_length` 21–35 · `period_length` 3–9 · `luteal_phase_length` 7–21

---

## 4. Cycles

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/cycles/start` | Start a period. Body: `date, flowIntensity?, notes?` |
| `POST` | `/cycles/end` | End current period. Body: `date` |
| `POST` | `/cycles/log` | Log a daily entry (no cycle ID needed). Body: `date, flowIntensity?, temperature?, cervicalMucus?, notes?` |
| `POST` | `/cycles/:cycleId/logs` | Log a daily entry scoped to a specific cycle |
| `GET`  | `/cycles/current` | Current cycle + phase + predictions (next period, ovulation, fertile window) |
| `GET`  | `/cycles/predictions` | Predictions only (next period, ovulation, fertile window) |
| `GET`  | `/cycles/analytics` | Analytics: avg cycle length, avg period length, shortest/longest. Query: `startDate?, endDate?` |
| `GET`  | `/cycles/log/:date` | Get daily log for a specific date (`YYYY-MM-DD`) |
| `GET`  | `/cycles` | Cycle history. Query: `page?, limit?, startDate?, endDate?` |
| `GET`  | `/cycles/:cycleId` | Get a single cycle by ID |
| `PUT`  | `/cycles/:cycleId` | Update a cycle. Fields: `flowIntensity?, notes?, startDate?, endDate?` |
| `DELETE` | `/cycles/:cycleId` | Delete a cycle |

**Flow intensity:** `spotting` · `light` · `medium` · `heavy`
**Cervical mucus:** `dry` · `sticky` · `creamy` · `watery` · `egg_white`

---

## 5. Day Logs

One log per day — consolidates vitals, water, period markers, notes.
All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/logs?date=YYYY-MM-DD` | Get log for a date. Returns `null` if none exists. |
| `GET`  | `/logs/range?from=YYYY-MM-DD&to=YYYY-MM-DD` | Get all logs in a date range |
| `PUT`  | `/logs/:date` | Upsert log for `:date`. Safe to call multiple times. |

**Upsert fields (all optional):** `period_start, period_end, flow_level, symptoms[], moods[], medicine[], note, weight, temperature, water_intake`

---

## 6. Health — Symptoms

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/health/symptoms` | Log one symptom. Body: `date, symptom, category, severity, timeOfDay?, notes?` |
| `POST` | `/health/symptoms/batch` | Log multiple symptoms. Body: `date, symptoms: [{ symptom, category, severity }]` |
| `GET`  | `/health/symptoms` | List symptoms. Query: `startDate?, endDate?, category?, page?, limit?` |
| `GET`  | `/health/symptoms/date/:date` | All symptoms for a specific date |
| `PUT`  | `/health/symptoms/:id` | Update a symptom. Fields: `severity?, notes?` |
| `DELETE` | `/health/symptoms/:id` | Delete a symptom |

**Categories:** `physical` · `emotional` · `pain` · `digestive` · `skin` · `sleep`
**Severity:** `1` (mild) → `5` (severe)

---

## 7. Health — Moods

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/health/moods` | Log one mood. Body: `date, mood, intensity, notes?, triggers?[]` |
| `POST` | `/health/moods/batch` | Log multiple moods. Body: `date, moods: [{ mood, intensity }]` |
| `GET`  | `/health/moods` | List moods. Query: `startDate?, endDate?, mood?, page?, limit?` |
| `GET`  | `/health/moods/date/:date` | All moods for a specific date |
| `PUT`  | `/health/moods/:id` | Update a mood. Fields: `intensity?, notes?` |
| `DELETE` | `/health/moods/:id` | Delete a mood |

**Moods:** `happy` · `sad` · `irritable` · `anxious` · `energetic` · `tired` · `calm` · `stressed` · `emotional` · `confident`
**Intensity:** `1` (very low) → `5` (very high)

---

## 8. Health — Analytics & Summaries

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/health/analytics/symptoms` | Top symptoms, category breakdown. Query: `startDate?, endDate?` |
| `GET`  | `/health/analytics/moods` | Mood distribution, avg intensity. Query: `startDate?, endDate?` |
| `GET`  | `/health/summary/:date` | Combined symptoms + moods for one date |
| `GET`  | `/health/trends/:cycleId` | Symptom & mood data correlated by cycle day |

---

## 9. Journal

Private diary entries.
All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/journal?month=YYYY-MM` | All entries for a calendar month |
| `POST` | `/journal` | Create entry. Body: `entry_date, content` |
| `PUT`  | `/journal/:id` | Update entry. Body: `content` |
| `DELETE` | `/journal/:id` | Delete entry |

---

## 10. Water Settings

Per-user water goal and cup configuration.
All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/water-settings` | Get settings. Returns defaults if none set (`water_target: 2000 ml`) |
| `PUT`  | `/water-settings` | Upsert settings. Fields: `water_target?, cup_capacity?, cup_style?` |

---

## 11. Wallet

Connect Bitcoin Lightning wallet.
All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/wallet/lightning` | Get saved lightning address. Returns `{ lightning_address }` (null if not set) |
| `PUT`  | `/wallet/lightning` | Save lightning address. Body: `{ lightning_address }`. Must be `user@domain.com` format |

> Setting a lightning address here makes the user tippable via `POST /payments/tip` with `recipient_id`.
> It also persists on `GET /users/profile` as `lightning_address`.

---

## 12. Partner System

All endpoints require `Authorization: Bearer <token>`.

**Invite flow (sender):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/partner/invite` | Generate 6-char invite code. Body: `share_period_dates?, share_fertile_window?, share_symptoms_moods?, share_cycle_insights?, share_sex_drive?`. Returns `{ invite_code, expires_at }`. Expires in 24 h. |
| `GET`  | `/partner/invite/status` | Check if partner accepted. Returns `{ invite_code, status: pending\|accepted\|expired, partner? }` |

**Accept flow (receiver):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/partner/accept` | Enter code to connect. Body: `{ invite_code }`. Returns `{ partnership_id, partner: { id, name, avatar_url } }` |

**After pairing (both users):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/partner` | Get current partner info: `{ partner, my_nickname, partner_nickname, partner_mode_enabled, connected_since, my_sharing }` |
| `DELETE` | `/partner` | Unpair with partner |
| `PUT`    | `/partner/nickname` | Set nicknames. Body: `{ my_nickname, partner_nickname }` |
| `GET`    | `/partner/settings` | Get your current sharing permissions |
| `PUT`    | `/partner/settings` | Update what you share. Body: same sharing booleans as invite |
| `PUT`    | `/partner/mode` | Toggle partner mode. Body: `{ partner_mode_enabled: boolean }` |

**Partner cycle view:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/partner/cycle` | Partner's cycle data filtered by their sharing settings. Returns `{ cycle_day, cycle_phase, next_period_days, next_ovulation_days, pregnancy_chance, todays_symptoms?, moods?, sex_drive? }` |
| `GET` | `/partner/calendar` | Partner's calendar dates. Returns `{ period_days?, fertility_window?, ovulation_day?, cycle_count }` — fields omitted if partner hasn't enabled sharing |

**Business rules:**
- One active partner at a time. Unpair to connect someone new.
- Invite codes are 6 characters, uppercase alphanumeric, expire in 24 hours.
- Sharing settings are per-user — each person controls what they share.
- `share_symptoms_moods` gates `todays_symptoms` + `moods` in `/partner/cycle`.
- `share_period_dates` gates `period_days` in `/partner/calendar`.
- `share_fertile_window` gates `fertility_window` + `ovulation_day` in `/partner/calendar`.

---

## 13. Chats (DMs)

Direct messages between two users.
All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/chats` | List all conversations. Returns `[{ conversation_id, other_user, last_message, last_message_time, unread_count, is_typing }]` |
| `POST`   | `/chats` | Start a conversation. Body: `{ recipient_id }`. Idempotent — returns existing if already exists. |
| `GET`    | `/chats/:conversationId` | Get messages. Query: `page?, limit?` (default 50, newest first) |
| `POST`   | `/chats/:conversationId` | Send message. Body: `{ content }` |
| `DELETE` | `/chats/:conversationId/:messageId` | Soft-delete own message |
| `PUT`    | `/chats/:conversationId/read` | Mark all unread messages in conversation as read |
| `POST`   | `/chats/:conversationId/typing` | Set typing state. Body: `{ is_typing: boolean }`. State expires after 5 s. |

> `is_typing` in the conversation list reflects the other user's active typing state (fresh within 5 seconds).

---

## 14. Groups

Group chats with multiple participants.
All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/groups` | List groups you are a member of |
| `POST`   | `/groups` | Create group. Body: `{ name, description?, member_ids?: [] }`. Creator becomes admin. |
| `GET`    | `/groups/:groupId` | Group info + full member list with roles |
| `PUT`    | `/groups/:groupId` | Update group. Body: `{ name?, description? }`. Admin only. |
| `DELETE` | `/groups/:groupId` | Delete group. Admin only. |
| `POST`   | `/groups/:groupId/members` | Add member. Body: `{ user_id }`. Admin only. |
| `DELETE` | `/groups/:groupId/members/:userId` | Remove member. Admin only. |
| `GET`    | `/groups/:groupId/messages` | Get messages. Query: `page?, limit?` (default 50, newest first) |
| `POST`   | `/groups/:groupId/messages` | Send message. Body: `{ content }` |
| `DELETE` | `/groups/:groupId/messages/:messageId` | Soft-delete message (own or admin) |
| `POST`   | `/groups/:groupId/leave` | Leave group. Fails if you are the only admin. |

---

## 15. Community — Threads

Read endpoints are public. Write endpoints require `Authorization: Bearer <token>`.
Authenticated reads return personalised `is_liked_by_me`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/threads` | Optional | List threads. Query: `tab=(recent\|popular), search?, page?, limit?` |
| `POST` | `/threads` | ✓ | Create thread. Body: `content, image_url?` |
| `GET`  | `/threads/:id` | Optional | Single thread with full comment list and `is_liked_by_me` |
| `PUT`  | `/threads/:id` | ✓ | Update thread (own only). Body: `content?, image_url?` |
| `DELETE` | `/threads/:id` | ✓ | Delete thread (own or admin) |
| `GET`  | `/threads/:id/comments` | Optional | List comments for a thread |
| `POST` | `/threads/:id/comments` | ✓ | Add comment. Body: `content` |
| `PUT`  | `/threads/:id/comments/:commentId` | ✓ | Update comment (own only). Body: `content` |
| `DELETE` | `/threads/:id/comments/:commentId` | ✓ | Delete comment (own or admin) |
| `POST` | `/threads/:id/like` | ✓ | Like thread. Idempotent. Returns `{ like_count, is_liked_by_me: true }` |
| `DELETE` | `/threads/:id/like` | ✓ | Unlike thread. Returns `{ like_count, is_liked_by_me: false }` |

---

## 16. Community — Notifications

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/notifications` | Last 50 notifications with `actor: { id, name, avatar_url }` |
| `PATCH` | `/notifications/read-all` | Mark all notifications as read |
| `PATCH` | `/notifications/:notificationId/read` | Mark a single notification as read |

**Notification types:** `comment` · `like`
Auto-generated by DB triggers when someone comments on or likes a thread.

---

## 17. Payments

Lightning Network tipping via LNURL-pay.
All endpoints require `Authorization: Bearer <token>` except `/webhook`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/payments/validate` | ✓ | Validate LN address or LNURL before amount entry. Returns `{ valid, min_sats, max_sats, comment_allowed, description }` |
| `POST` | `/payments/tip` | ✓ | Create tip → fetch invoice via LNURL-pay → store pending tx. Returns `{ invoice, payment_hash, expires_at }` |
| `POST` | `/payments/confirm` | ✓ | Mark own tx as completed after paying. Body: `payment_hash`. Scoped to sender. |
| `GET`  | `/payments/status/:paymentHash` | ✓ | Poll payment status. Auto-expires pending tx after 10 min. Returns `{ status: pending\|completed\|failed }` |
| `GET`  | `/payments/history` | ✓ | Transaction history. Query: `type=sent\|received` (default `sent`) |
| `POST` | `/payments/webhook` | — | Lightning provider webhook. Body: `payment_hash`. Header: `x-webhook-secret` |

**Tip body:** `recipient_id` (UUID — SatsFlo user) **or** `lightning_address` (external), plus `amount_sats, thread_id?, note?`

**Payment flow:**
```
POST /payments/validate   →  check address is reachable + get min/max
POST /payments/tip        →  get invoice
open lightning:<invoice>  →  user pays in wallet
POST /payments/confirm    →  mark as completed
GET  /payments/status/:hash →  poll to confirm (optional)
```

**Recipient must set `lightning_address`** via `PUT /users/profile`.

---

## 18. Enums & Constants

| Group | Values |
|-------|--------|
| Cycle phases | `menstrual` · `follicular` · `ovulation` · `luteal` |
| Flow intensity | `spotting` · `light` · `medium` · `heavy` |
| Cervical mucus | `dry` · `sticky` · `creamy` · `watery` · `egg_white` |
| Symptom categories | `physical` · `emotional` · `pain` · `digestive` · `skin` · `sleep` |
| Mood types | `happy` · `sad` · `irritable` · `anxious` · `energetic` · `tired` · `calm` · `stressed` · `emotional` · `confident` |
| Account status | `active` · `inactive` · `suspended` · `deleted` |
| Payment status | `pending` · `completed` · `failed` |
| Notification types | `comment` · `like` |
| Themes | `light` · `dark` · `system` |
| Privacy | `private` · `friends` · `public` |

---

## 19. Error Codes

| Status | Meaning |
|--------|---------|
| `400` | Bad Request — invalid or missing input |
| `401` | Unauthorized — token missing, expired, or invalid |
| `403` | Forbidden — insufficient permissions |
| `404` | Not Found |
| `409` | Conflict — resource already exists (e.g. duplicate email) |
| `422` | Unprocessable — valid format but business rule violation (e.g. no lightning address set) |
| `429` | Too Many Requests — rate limited |
| `500` | Internal Server Error |
| `502` | Bad Gateway — upstream Lightning service unreachable |

---

## 20. Rate Limits

| Group | Limit |
|-------|-------|
| General API | 100 req / 15 min |
| Auth (login/refresh) | 5 req / 15 min |
| Password reset | 3 req / hour |
| Registration | 5 req / hour |
| Sensitive data (health) | 30 req / min |

---

## Notes

- All dates: `YYYY-MM-DD`. All timestamps: ISO 8601 UTC.
- Upsert endpoints (`PUT /logs/:date`, `PUT /water-settings`, `POST /cycle-profile`) are safe to call multiple times — they create if missing, update if exists.
- Health fields (`health_conditions`, `medications`, `notes`) are encrypted at rest with AES-256-GCM. Returned decrypted — no client-side work needed.
- OTP codes (forgot-password flow only) are 6 digits, valid 10 minutes. After verification, a `reset_token` valid for 15 minutes is returned. Max 3 OTP requests per email per hour.
- Lightning invoices expire in 10 minutes. After expiry `GET /payments/status` returns `status: failed`.
- `POST /payments/confirm` is scoped to `sender_id` — users can only confirm their own outgoing payments.
