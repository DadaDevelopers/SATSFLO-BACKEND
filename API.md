# Satsflow API Documentation

Complete API reference for the Satsflow mobile application backend.

**Base URL**: `http://localhost:3000/api/v1`

**Content-Type**: `application/json`

---

## Table of Contents

1. [Authentication](#authentication)
2. [User Management](#user-management)
3. [Cycle Profile](#cycle-profile)
4. [Cycle Tracking](#cycle-tracking)
5. [Day Logs](#day-logs)
6. [Health (Symptoms & Moods)](#health-symptoms--moods)
7. [Journal](#journal)
8. [Water Settings](#water-settings)
9. [Community](#community)
10. [Constants & Enums](#constants--enums)
11. [Error Codes](#error-codes)
12. [Rate Limits](#rate-limits)

---

## Authentication

All protected endpoints require the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Access tokens expire in `15m`. When expired, call `/auth/refresh` with the refresh token to get a new pair.

---

### Register

Create a new user account. A verification email is sent automatically.

```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "confirmPassword": "SecurePass123",
  "name": "Jane Doe",
  "dateOfBirth": "1995-05-15",
  "acceptTerms": "true"
}
```

**Password Requirements:** 8+ chars, one uppercase, one lowercase, one number.

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Jane Doe",
      "role": "user",
      "emailVerified": false
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "expiresIn": "15m"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Login

```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Jane Doe",
      "role": "user",
      "emailVerified": true
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "expiresIn": "15m"
  }
}
```

---

### Refresh Token

Swap a refresh token for a new access + refresh pair. The old refresh token is revoked immediately.

```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "expiresIn": "15m"
  }
}
```

---

### Logout

Revoke the current refresh token (single device).

```http
POST /auth/logout
```

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": null
}
```

---

### Logout All Devices

Revoke every refresh token for the authenticated user.

```http
POST /auth/logout-all
```

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out from all devices",
  "data": null
}
```

---

### Verify Email

Confirm the user's email address using the token sent in the verification email.

```http
GET /auth/verify-email/:token
```

**URL Param:** `:token` — token from the verification email link.

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

---

### Resend Verification Email

```http
POST /auth/resend-verification
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "If an account exists, a verification email has been sent"
}
```

---

### Forgot Password

Request a password reset email. Always returns the same message to prevent email enumeration.

```http
POST /auth/forgot-password
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "If an account exists, a password reset email has been sent"
}
```

---

### Reset Password

Reset password using the token from the reset email. Valid for 1 hour, single-use. All refresh tokens are revoked on success.

```http
POST /auth/reset-password/:token
```

**URL Param:** `:token` — token from the reset email link.

**Request Body:**
```json
{
  "password": "NewSecurePass123",
  "confirmPassword": "NewSecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

### Change Password

Change password for the currently authenticated user. All refresh tokens are revoked on success.

```http
PUT /auth/change-password
```

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456",
  "confirmNewPassword": "NewPassword456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### Get Current User

```http
GET /auth/me
```

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

## User Management

### Get Profile

```http
GET /users/profile
```

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe",
    "date_of_birth": "1995-05-15",
    "avatar_url": null,
    "timezone": "UTC",
    "language": "en",
    "role": "user",
    "email_verified": true,
    "created_at": "2024-01-01T00:00:00.000Z",
    "last_login": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### Update Profile

```http
PUT /users/profile
```

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body (all fields optional):**
```json
{
  "name": "Jane Smith",
  "date_of_birth": "1995-05-15",
  "timezone": "Africa/Nairobi",
  "language": "en",
  "avatar_url": "https://cdn.example.com/avatar.jpg"
}
```

---

### Get Health Profile

Returns decrypted health information.

```http
GET /users/health-profile
```

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "average_cycle_length": 28,
    "average_period_length": 5,
    "birth_control_method": "none",
    "health_conditions": ["endometriosis"],
    "medications": [],
    "last_period_date": "2024-01-01",
    "is_pregnant": false,
    "is_trying_to_conceive": false
  }
}
```

> `health_conditions`, `medications`, and `notes` are encrypted at rest and decrypted before returning.

---

### Update Health Profile

```http
PUT /users/health-profile
```

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body (all fields optional):**
```json
{
  "averageCycleLength": 30,
  "averagePeriodLength": 6,
  "birthControlMethod": "pill",
  "healthConditions": ["pcos"],
  "medications": ["metformin"],
  "lastPeriodDate": "2024-01-10",
  "isPregnant": false,
  "isTryingToConceive": true
}
```

---

### Get Preferences

```http
GET /users/preferences
```

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "notifications": {
      "periodReminder": true,
      "ovulationReminder": true,
      "pillReminder": false,
      "dailyLogReminder": false,
      "communityUpdates": true
    },
    "reminderTime": "09:00",
    "privacy": "private",
    "theme": "system",
    "units": "metric"
  }
}
```

---

### Update Preferences

```http
PUT /users/preferences
```

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body (all fields optional, merged with existing):**
```json
{
  "notifications": {
    "periodReminder": true,
    "dailyLogReminder": true
  },
  "reminderTime": "20:00",
  "privacy": "friends",
  "theme": "dark"
}
```

---

### Export User Data

GDPR-compliant full data export (user, health profile, cycles, symptoms, moods).

```http
GET /users/export
```

**Headers:** `Authorization: Bearer <token>` (required)

---

### Delete Account

Soft-deletes the account. Requires password confirmation.

```http
DELETE /users/account
```

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "password": "YourPassword123",
  "confirmation": "DELETE"
}
```

---

## Cycle Profile

Lightweight cycle setup used by the home-screen widget. Separate from the full Cycle Tracking module.

### Create / Update Cycle Profile

```http
POST /cycle-profile
```

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "cycle_length": 28,
  "period_length": 5,
  "last_period_start": "2024-01-15"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `last_period_start` | string (YYYY-MM-DD) | Yes | — |
| `cycle_length` | integer | No | 21–35 (default: 28) |
| `period_length` | integer | No | 3–9 (default: 5) |

**Response (201):**
```json
{
  "success": true,
  "message": "Cycle profile saved",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "cycle_length": 28,
    "period_length": 5,
    "last_period_start": "2024-01-15",
    "created_at": "2024-01-15T00:00:00.000Z"
  }
}
```

---

### Get Cycle Profile

Returns the stored profile plus live calculations.

```http
GET /cycle-profile
```

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200):**
```json
{
  "success": true,
  "message": "Cycle profile retrieved",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "cycle_length": 28,
    "period_length": 5,
    "last_period_start": "2024-01-15",
    "current_day": 12,
    "days_until_period": 17,
    "current_phase": "follicular"
  }
}
```

**Phases:** `menstrual` · `follicular` · `ovulation` · `luteal`

**Response (404):** Returned when no profile exists yet.

---

## Cycle Tracking

All endpoints require `Authorization: Bearer <token>`.

### Start Period

```http
POST /cycles/start
```

**Request Body:**
```json
{
  "date": "2024-01-15",
  "flowIntensity": "medium",
  "notes": "Started this morning"
}
```

**Flow Intensity:** `spotting` · `light` · `medium` · `heavy`

**Response (201):**
```json
{
  "success": true,
  "message": "Period started",
  "data": {
    "id": "uuid",
    "startDate": "2024-01-15",
    "endDate": null,
    "periodEndDate": null,
    "periodLength": null,
    "cycleLength": null,
    "notes": "Started this morning",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### End Period

```http
POST /cycles/end
```

**Request Body:**
```json
{
  "date": "2024-01-20"
}
```

**Response (200):** Returns the updated cycle with `periodEndDate` and `periodLength` set.

---

### Log Daily Entry

```http
POST /cycles/log
```

**Request Body (all fields except `date` optional):**
```json
{
  "date": "2024-01-16",
  "flowIntensity": "heavy",
  "temperature": 36.5,
  "cervicalMucus": "creamy",
  "sexualActivity": false,
  "contraceptionUsed": false,
  "notes": "Cramps in the morning"
}
```

**Cervical Mucus:** `dry` · `sticky` · `creamy` · `watery` · `egg_white`

If an entry already exists for the date it is updated; otherwise a new one is created.

---

### Get Current Cycle

```http
GET /cycles/current
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "startDate": "2024-01-15",
    "dayOfCycle": 5,
    "phase": {
      "name": "menstrual",
      "day": 5,
      "description": "Menstrual phase - Period days"
    },
    "predictions": {
      "nextPeriod": { "date": "2024-02-12", "daysUntil": 23 },
      "ovulation":  { "date": "2024-01-29", "daysUntil": 9 },
      "fertileWindow": { "start": "2024-01-24", "end": "2024-01-30" }
    }
  }
}
```

---

### Get Predictions

```http
GET /cycles/predictions
```

Returns the same prediction object as the current cycle endpoint.

---

### Get Cycle History

```http
GET /cycles?page=1&limit=20&startDate=2024-01-01&endDate=2024-12-31
```

**Query Parameters (all optional):**

| Param | Description |
|-------|-------------|
| `page` | Page number (default: 1) |
| `limit` | Results per page (default: 20) |
| `startDate` | Filter cycles starting on or after this date |
| `endDate` | Filter cycles starting on or before this date |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "cycles": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 6
    }
  }
}
```

---

### Get Cycle Analytics

```http
GET /cycles/analytics?startDate=2024-01-01&endDate=2024-06-30
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalCycles": 6,
    "averageCycleLength": 28,
    "averagePeriodLength": 5,
    "shortestCycle": 26,
    "longestCycle": 32,
    "cycleVariability": 2.1,
    "cycles": [...]
  }
}
```

---

### Get Daily Log

```http
GET /cycles/log/:date
```

**URL Param:** `:date` — date in `YYYY-MM-DD` format.

Returns `null` if no entry exists for that date.

---

### Get / Update / Delete Cycle by ID

```http
GET    /cycles/:id
PUT    /cycles/:id
DELETE /cycles/:id
```

---

## Day Logs

A flexible daily log — one entry per date — that consolidates period status, symptoms, moods, vitals, and notes. All endpoints require authentication.

### Get Day Log

```http
GET /logs?date=YYYY-MM-DD
```

**Response (200):**
```json
{
  "success": true,
  "message": "Day log retrieved",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "log_date": "2024-01-15",
    "period_start": true,
    "period_end": false,
    "flow_level": "medium",
    "symptoms": ["cramps", "bloating"],
    "moods": ["tired"],
    "medicine": ["ibuprofen"],
    "note": "Felt tired all day",
    "weight": 62.5,
    "temperature": 36.7,
    "water_intake": 1800,
    "created_at": "2024-01-15T08:00:00.000Z"
  }
}
```

Returns `null` data when no log exists for the date.

---

### Upsert Day Log

Create or update the log for a specific date. Send only the fields you want to set.

```http
PUT /logs/:date
```

**URL Param:** `:date` — date in `YYYY-MM-DD` format.

**Request Body (all fields optional):**
```json
{
  "period_start": true,
  "period_end": false,
  "flow_level": "medium",
  "symptoms": ["cramps", "bloating"],
  "moods": ["tired", "emotional"],
  "medicine": ["ibuprofen"],
  "note": "Felt tired all day",
  "weight": 62.5,
  "temperature": 36.7,
  "water_intake": 1800
}
```

**Response (200):** Returns the full saved log object.

---

### Get Day Logs Range

```http
GET /logs/range?from=YYYY-MM-DD&to=YYYY-MM-DD
```

| Param | Required | Description |
|-------|----------|-------------|
| `from` | Yes | Start date (inclusive) |
| `to` | Yes | End date (inclusive) |

**Response (200):** Array of log objects ordered by date ascending.

---

## Health (Symptoms & Moods)

All endpoints require `Authorization: Bearer <token>`.

### Log Symptom

```http
POST /health/symptoms
```

**Request Body:**
```json
{
  "date": "2024-01-15",
  "symptom": "cramps",
  "category": "pain",
  "severity": 2,
  "timeOfDay": "morning",
  "notes": "Took ibuprofen"
}
```

**Categories:** `physical` · `emotional` · `pain` · `digestive` · `skin` · `sleep`

**Severity:** `1` (mild) · `2` (moderate) · `3` (severe) · up to `5`

**Time of Day:** `morning` · `afternoon` · `evening` · `night`

---

### Log Multiple Symptoms

```http
POST /health/symptoms/batch
```

**Request Body:**
```json
{
  "date": "2024-01-15",
  "symptoms": [
    { "symptom": "cramps",   "category": "pain",     "severity": 2 },
    { "symptom": "bloating", "category": "physical", "severity": 1 },
    { "symptom": "headache", "category": "pain",     "severity": 2 }
  ]
}
```

---

### Get Symptoms

```http
GET /health/symptoms?page=1&limit=20&startDate=2024-01-01&endDate=2024-03-31&category=pain
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "symptoms": [...],
    "pagination": { "page": 1, "limit": 20, "total": 45 }
  }
}
```

---

### Get Symptoms by Date

```http
GET /health/symptoms/date/2024-01-15
```

---

### Update / Delete Symptom

```http
PUT    /health/symptoms/:id
DELETE /health/symptoms/:id
```

---

### Log Mood

```http
POST /health/moods
```

**Request Body:**
```json
{
  "date": "2024-01-15",
  "mood": "happy",
  "intensity": 4,
  "notes": "Great day!",
  "triggers": ["good sleep", "exercise"]
}
```

**Moods:** `happy` · `sad` · `irritable` · `anxious` · `energetic` · `tired` · `calm` · `stressed` · `emotional` · `confident`

**Intensity:** `1` (very low) to `5` (very high)

---

### Log Multiple Moods

```http
POST /health/moods/batch
```

**Request Body:**
```json
{
  "date": "2024-01-15",
  "moods": [
    { "mood": "energetic", "intensity": 4 },
    { "mood": "happy",     "intensity": 3 }
  ]
}
```

---

### Get Moods

```http
GET /health/moods?page=1&limit=20&startDate=2024-01-01&mood=happy
```

---

### Get Moods by Date

```http
GET /health/moods/date/2024-01-15
```

---

### Update / Delete Mood

```http
PUT    /health/moods/:id
DELETE /health/moods/:id
```

---

### Get Symptom Analytics

```http
GET /health/analytics/symptoms?startDate=2024-01-01&endDate=2024-03-31
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalEntries": 45,
    "topSymptoms": [
      { "symptom": "cramps",   "count": 12, "avgSeverity": 2.1 },
      { "symptom": "headache", "count": 8,  "avgSeverity": 1.8 }
    ],
    "categoryBreakdown": {
      "pain": 20,
      "physical": 15,
      "emotional": 10
    },
    "dateRange": { "startDate": "2024-01-01", "endDate": "2024-03-31" }
  }
}
```

---

### Get Mood Analytics

```http
GET /health/analytics/moods?startDate=2024-01-01&endDate=2024-03-31
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalEntries": 38,
    "moodDistribution": [
      { "mood": "happy", "count": 12, "percentage": 32, "avgIntensity": 3.8 },
      { "mood": "tired", "count": 9,  "percentage": 24, "avgIntensity": 3.1 }
    ],
    "dateRange": { "startDate": "2024-01-01", "endDate": "2024-03-31" }
  }
}
```

---

### Get Daily Summary

Combined symptoms and moods for one date.

```http
GET /health/summary/2024-01-15
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "symptoms": [...],
    "moods": [...],
    "hasSymptomsLogged": true,
    "hasMoodsLogged": true
  }
}
```

---

### Get Health Trends

Symptom and mood data correlated by cycle day for a specific cycle.

```http
GET /health/trends/:cycleId
```

---

## Journal

Private diary entries. All endpoints require `Authorization: Bearer <token>`.

### Get Journal Entries

Retrieve all entries for a calendar month.

```http
GET /journal?month=YYYY-MM
```

**Response (200):**
```json
{
  "success": true,
  "message": "Journal entries retrieved",
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "entry_date": "2024-01-15",
      "content": "Feeling much better today.",
      "created_at": "2024-01-15T20:00:00.000Z",
      "updated_at": "2024-01-15T20:00:00.000Z"
    }
  ]
}
```

---

### Create Journal Entry

```http
POST /journal
```

**Request Body:**
```json
{
  "entry_date": "2024-01-15",
  "content": "Feeling much better today."
}
```

| Field | Type | Required |
|-------|------|----------|
| `entry_date` | string (YYYY-MM-DD) | Yes |
| `content` | string (non-empty) | Yes |

**Response (201):**
```json
{
  "success": true,
  "message": "Journal entry created",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "entry_date": "2024-01-15",
    "content": "Feeling much better today.",
    "created_at": "2024-01-15T20:00:00.000Z"
  }
}
```

---

## Water Settings

Per-user water intake goal and cup configuration. All endpoints require `Authorization: Bearer <token>`.

### Get Water Settings

Returns saved settings, or defaults if none have been set.

```http
GET /water-settings
```

**Response (200):**
```json
{
  "success": true,
  "message": "Water settings retrieved",
  "data": {
    "user_id": "uuid",
    "water_target": 2000,
    "cup_capacity": 250,
    "cup_style": "standard"
  }
}
```

**Defaults:** `water_target` = 2000 ml · `cup_capacity` = 250 ml · `cup_style` = `"standard"`

---

### Update Water Settings

```http
PUT /water-settings
```

**Request Body (all fields optional):**
```json
{
  "water_target": 2500,
  "cup_capacity": 300,
  "cup_style": "large"
}
```

| Field | Type | Constraints |
|-------|------|-------------|
| `water_target` | integer | > 0 (ml) |
| `cup_capacity` | integer | > 0 (ml) |
| `cup_style` | string | Free-form label |

---

## Community

Public forum threads, comments, likes, and notifications.

### Get Threads

Publicly readable. Authenticated users receive a personalised `is_liked_by_me` flag.

```http
GET /threads?tab=recent&search=cramps&page=1&limit=20
```

**Auth:** Optional (`Authorization: Bearer <token>`)

| Param | Default | Description |
|-------|---------|-------------|
| `tab` | `recent` | `recent` or `popular` |
| `search` | — | Content search string |
| `page` | `1` | Page number |
| `limit` | `20` | Results per page (max 50) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "threads": [
      {
        "id": "uuid",
        "content": "Anyone else dealing with PCOS?",
        "image_url": null,
        "created_at": "2024-01-15T10:00:00.000Z",
        "updated_at": "2024-01-15T10:00:00.000Z",
        "user": {
          "id": "uuid",
          "name": "Jane Doe",
          "avatar_url": null
        },
        "like_count": 12,
        "comment_count": 4,
        "is_liked_by_me": false
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

---

### Create Thread

```http
POST /threads
```

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "content": "Anyone else dealing with PCOS?",
  "image_url": "https://example.com/image.jpg"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `content` | Yes | Non-empty string |
| `image_url` | No | Optional image URL |

**Response (201):**
```json
{
  "success": true,
  "message": "Thread created",
  "data": {
    "id": "uuid",
    "content": "Anyone else dealing with PCOS?",
    "image_url": null,
    "created_at": "2024-01-15T10:00:00.000Z",
    "user": {
      "id": "uuid",
      "name": "Jane Doe",
      "avatar_url": null
    }
  }
}
```

---

### Get Comments

```http
GET /threads/:id/comments
```

**Auth:** Optional

**Response (200):**
```json
{
  "success": true,
  "message": "Comments retrieved",
  "data": [
    {
      "id": "uuid",
      "content": "Me too!",
      "created_at": "2024-01-15T11:00:00.000Z",
      "user": {
        "id": "uuid",
        "name": "Jane Doe",
        "avatar_url": null
      }
    }
  ]
}
```

---

### Add Comment

A notification is automatically sent to the thread author (unless they are the commenter).

```http
POST /threads/:id/comments
```

**Headers:** `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "content": "Me too!"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Comment added",
  "data": {
    "id": "uuid",
    "content": "Me too!",
    "created_at": "2024-01-15T11:00:00.000Z",
    "user": {
      "id": "uuid",
      "name": "Jane Doe",
      "avatar_url": null
    }
  }
}
```

---

### Like Thread

Idempotent — liking an already-liked thread is a no-op. A notification is sent to the author.

```http
POST /threads/:id/like
```

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200):**
```json
{
  "success": true,
  "message": "Thread liked",
  "data": { "like_count": 13 }
}
```

---

### Unlike Thread

```http
DELETE /threads/:id/like
```

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200):**
```json
{
  "success": true,
  "message": "Like removed",
  "data": { "like_count": 12 }
}
```

---

### Get Notifications

Returns the 50 most recent notifications.

```http
GET /notifications
```

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200):**
```json
{
  "success": true,
  "message": "Notifications retrieved",
  "data": [
    {
      "id": "uuid",
      "type": "comment",
      "message": "Someone commented on your post",
      "is_read": false,
      "created_at": "2024-01-15T12:00:00.000Z",
      "actor": {
        "id": "uuid",
        "name": "Jane Doe",
        "avatar_url": null
      }
    },
    {
      "id": "uuid",
      "type": "like",
      "message": "Someone liked your post",
      "is_read": true,
      "created_at": "2024-01-14T09:00:00.000Z",
      "actor": null
    }
  ]
}
```

**Notification types:** `comment` · `like`

---

### Mark All Notifications Read

```http
PATCH /notifications/read-all
```

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200):**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": null
}
```

---

## Constants & Enums

### Cycle Phases

| Phase | Typical Days | Description |
|-------|-------------|-------------|
| `menstrual` | 1–5 | Period |
| `follicular` | 6–13 | Pre-ovulation |
| `ovulation` | 14–16 | Fertile window |
| `luteal` | 17–28 | Post-ovulation |

### Flow Intensity

`spotting` · `light` · `medium` · `heavy`

### Symptom Categories

`physical` · `emotional` · `pain` · `digestive` · `skin` · `sleep`

### Mood Types

`happy` · `sad` · `irritable` · `anxious` · `energetic` · `tired` · `calm` · `stressed` · `emotional` · `confident`

### Privacy Levels

`private` · `friends` · `public`

### Account Status

`active` · `inactive` · `suspended` · `deleted`

---

## Error Codes

| Status | Description |
|--------|-------------|
| 400 | Bad Request — Invalid or missing input |
| 401 | Unauthorized — Token missing, invalid, or expired |
| 403 | Forbidden — Insufficient permissions |
| 404 | Not Found — Resource does not exist |
| 409 | Conflict — Resource already exists (e.g. duplicate email) |
| 429 | Too Many Requests — Rate limited |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email address",
      "value": "invalid-email"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Standard Response Envelope

All responses share the same structure:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| General API | 100 requests / 15 min |
| Authentication | 5 requests / 15 min |
| Password reset | 3 requests / hour |
| Registration | 5 requests / hour |
| Sensitive data | 30 requests / min |

---

## Notes for Mobile Developers

1. **Token storage** — Store tokens in Keychain (iOS) / Keystore (Android)
2. **Token refresh** — Refresh the access token before it expires (`expiresIn: "15m"`); refresh tokens are rotated on each use
3. **Date format** — Always use ISO 8601 (`YYYY-MM-DD`) for date fields
4. **Timezone** — All timestamps are UTC; convert to the user's timezone in the app
5. **Health data** — Encrypted at rest; decrypted automatically before API responses — no client-side decryption needed
6. **Offline** — Cache cycle and health data locally; sync on reconnect
7. **Email verification** — Prompt the user to verify email after registration; `emailVerified: false` in the register response signals this
