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

---

## Authentication

All authenticated endpoints require the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Register

Create a new user account.

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

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

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

Authenticate user and receive tokens.

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

Get new access token using refresh token.

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

Invalidate the current refresh token.

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

### Forgot Password

Request a password reset email.

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

Reset password using token from email.

```http
POST /auth/reset-password/:token
```

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

Change password for authenticated user.

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

**Request Body:**
```json
{
  "name": "Jane Smith",
  "dateOfBirth": "1995-05-15",
  "timezone": "Africa/Nairobi",
  "language": "en"
}
```

---

### Get Health Profile

Contains encrypted health information.

```http
GET /users/health-profile
```

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

---

### Update Health Profile

```http
PUT /users/health-profile
```

**Request Body:**
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

**Request Body:**
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

GDPR-compliant data export.

```http
GET /users/export
```

---

### Delete Account

Requires password confirmation.

```http
DELETE /users/account
```

**Request Body:**
```json
{
  "password": "YourPassword123",
  "confirmation": "DELETE"
}
```

---

## Cycle Profile

Lightweight cycle setup used to drive home-screen predictions. This is separate from the full Cycle Tracking module.

### Create / Update Cycle Profile

Create or replace the authenticated user's cycle profile.

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
    "user_id": "uuid",
    "cycle_length": 28,
    "period_length": 5,
    "last_period_start": "2024-01-15"
  }
}
```

---

### Get Cycle Profile

Retrieve the cycle profile with live calculations (current day, phase, days until next period).

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

**Phases:** `menstrual`, `follicular`, `ovulation`, `luteal`

**Response (404):** Returned when no profile has been created yet.

---

## Cycle Tracking

### Start Period

Begin tracking a new period/cycle.

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

**Flow Intensity Options:** `spotting`, `light`, `medium`, `heavy`

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

Mark the end of menstrual bleeding.

```http
POST /cycles/end
```

**Request Body:**
```json
{
  "date": "2024-01-20"
}
```

---

### Log Daily Entry

Log daily tracking data.

```http
POST /cycles/log
```

**Request Body:**
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

**Cervical Mucus Options:** `dry`, `sticky`, `creamy`, `watery`, `egg_white`

---

### Get Current Cycle

Get current cycle status with predictions.

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
      "nextPeriod": {
        "date": "2024-02-12",
        "daysUntil": 23
      },
      "ovulation": {
        "date": "2024-01-29",
        "daysUntil": 9
      },
      "fertileWindow": {
        "start": "2024-01-24",
        "end": "2024-01-30"
      }
    }
  }
}
```

---

### Get Predictions

```http
GET /cycles/predictions
```

---

### Get Cycle History

```http
GET /cycles?page=1&limit=20&startDate=2024-01-01&endDate=2024-12-31
```

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 6,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
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

---

### Get Cycle by ID

```http
GET /cycles/:cycleId
```

---

### Update Cycle

```http
PUT /cycles/:cycleId
```

---

### Delete Cycle

```http
DELETE /cycles/:cycleId
```

---

## Day Logs

A flexible daily log that consolidates period, symptoms, moods, vitals, and notes in one entry per day.

All endpoints require authentication.

### Get Day Log

```http
GET /logs?date=YYYY-MM-DD
```

**Headers:** `Authorization: Bearer <token>` (required)

**Query Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `date` | Yes | Date in `YYYY-MM-DD` format |

**Response (200):**
```json
{
  "success": true,
  "message": "Day log retrieved",
  "data": {
    "user_id": "uuid",
    "date": "2024-01-15",
    "period_start": true,
    "period_end": false,
    "flow_level": "medium",
    "symptoms": ["cramps", "bloating"],
    "moods": ["tired"],
    "medicine": ["ibuprofen"],
    "note": "Felt tired all day",
    "weight": 62.5,
    "temperature": 36.7,
    "water_intake": 1800
  }
}
```

Returns `null` data when no log exists for the requested date.

---

### Upsert Day Log

Create or update the log for a specific date. Only include the fields you want to set — omitted fields are left unchanged.

```http
PUT /logs/:date
```

**Headers:** `Authorization: Bearer <token>` (required)

**URL Parameter:** `:date` — date in `YYYY-MM-DD` format

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

**Response (200):**
```json
{
  "success": true,
  "message": "Day log saved",
  "data": { ... }
}
```

---

### Get Day Logs Range

Retrieve all logs for an inclusive date range.

```http
GET /logs/range?from=YYYY-MM-DD&to=YYYY-MM-DD
```

**Headers:** `Authorization: Bearer <token>` (required)

**Query Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `from` | Yes | Start date (`YYYY-MM-DD`), must not be after `to` |
| `to` | Yes | End date (`YYYY-MM-DD`) |

**Response (200):**
```json
{
  "success": true,
  "message": "Logs range retrieved",
  "data": [
    { "date": "2024-01-15", "flow_level": "medium", ... },
    { "date": "2024-01-16", "flow_level": "heavy",  ... }
  ]
}
```

---

## Health (Symptoms & Moods)

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

**Categories:** `physical`, `emotional`, `pain`, `digestive`, `skin`, `sleep`

**Severity:** `1` (mild), `2` (moderate), `3` (severe)

**Time of Day:** `morning`, `afternoon`, `evening`, `night`, `all_day`

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
    { "symptom": "cramps", "category": "pain", "severity": 2 },
    { "symptom": "bloating", "category": "physical", "severity": 1 },
    { "symptom": "headache", "category": "pain", "severity": 2 }
  ]
}
```

---

### Get Symptoms

```http
GET /health/symptoms?page=1&limit=20&startDate=2024-01-01&category=pain
```

---

### Get Symptoms by Date

```http
GET /health/symptoms/date/2024-01-15
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

**Moods:** `happy`, `sad`, `irritable`, `anxious`, `energetic`, `tired`, `calm`, `stressed`, `emotional`, `confident`

**Intensity:** `1` to `5`

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
    { "mood": "happy", "intensity": 3 }
  ]
}
```

---

### Get Moods

```http
GET /health/moods?page=1&limit=20&startDate=2024-01-01&mood=happy
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
      { "symptom": "cramps", "count": 12, "avgSeverity": 2.1 },
      { "symptom": "headache", "count": 8, "avgSeverity": 1.8 }
    ],
    "categoryBreakdown": {
      "pain": 20,
      "physical": 15,
      "emotional": 10
    },
    "dateRange": {
      "startDate": "2024-01-01",
      "endDate": "2024-03-31"
    }
  }
}
```

---

### Get Mood Analytics

```http
GET /health/analytics/moods?startDate=2024-01-01&endDate=2024-03-31
```

---

### Get Daily Summary

Combined symptoms and moods for a date.

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

Health data correlated with a specific cycle.

```http
GET /health/trends/:cycleId
```

---

## Journal

Personal diary entries grouped by month.

All endpoints require authentication.

### Get Journal Entries

Retrieve all entries for a given calendar month.

```http
GET /journal?month=YYYY-MM
```

**Headers:** `Authorization: Bearer <token>` (required)

**Query Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `month` | Yes | Month in `YYYY-MM` format |

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
      "created_at": "2024-01-15T20:00:00.000Z"
    }
  ]
}
```

---

### Create Journal Entry

```http
POST /journal
```

**Headers:** `Authorization: Bearer <token>` (required)

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

Per-user water intake goal and cup configuration.

All endpoints require authentication.

### Get Water Settings

Returns the user's saved settings, or sensible defaults if none have been set.

```http
GET /water-settings
```

**Headers:** `Authorization: Bearer <token>` (required)

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

**Defaults:** `water_target` = 2000 ml, `cup_capacity` = 250 ml, `cup_style` = `"standard"`

---

### Update Water Settings

Provide at least one field to update.

```http
PUT /water-settings
```

**Headers:** `Authorization: Bearer <token>` (required)

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
| `water_target` | integer | Positive integer (ml) |
| `cup_capacity` | integer | Positive integer (ml) |
| `cup_style` | string | Free-form label |

**Response (200):**
```json
{
  "success": true,
  "message": "Water settings updated",
  "data": {
    "user_id": "uuid",
    "water_target": 2500,
    "cup_capacity": 300,
    "cup_style": "large"
  }
}
```

---

## Community

Public forum threads, comments, likes, and notifications.

### Get Threads

Publicly readable. Authenticated users receive a personalised `is_liked_by_me` flag.

```http
GET /threads?tab=recent&search=cramps&page=1&limit=20
```

**Auth:** Optional (`Authorization: Bearer <token>`)

**Query Parameters:**

| Param | Default | Description |
|-------|---------|-------------|
| `tab` | `recent` | Feed filter: `recent` or `popular` |
| `search` | — | Full-text search string |
| `page` | `1` | Page number |
| `limit` | `20` | Results per page (max 50) |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "content": "Anyone else dealing with PCOS?",
      "image_url": null,
      "like_count": 12,
      "comment_count": 4,
      "is_liked_by_me": false,
      "created_at": "2024-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
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
  "data": { "id": "uuid", "content": "...", ... }
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
      "thread_id": "uuid",
      "user_id": "uuid",
      "content": "Me too!",
      "created_at": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```

---

### Add Comment

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
  "data": { "id": "uuid", "content": "Me too!", ... }
}
```

---

### Like Thread

```http
POST /threads/:id/like
```

**Headers:** `Authorization: Bearer <token>` (required)

**Response (200):**
```json
{
  "success": true,
  "message": "Thread liked",
  "data": { "like_count": 13, "is_liked_by_me": true }
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
  "data": { "like_count": 12, "is_liked_by_me": false }
}
```

---

### Get Notifications

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
      "thread_id": "uuid",
      "read": false,
      "created_at": "2024-01-15T12:00:00.000Z"
    }
  ]
}
```

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

| Phase | Description |
|-------|-------------|
| `menstrual` | Days 1-5: Period |
| `follicular` | Days 6-14: Pre-ovulation |
| `ovulation` | Days 14-16: Fertile window |
| `luteal` | Days 17-28: Post-ovulation |

### Flow Intensity

- `spotting`
- `light`
- `medium`
- `heavy`

### Symptom Categories

- `physical`
- `emotional`
- `pain`
- `digestive`
- `skin`
- `sleep`

### Mood Types

- `happy`
- `sad`
- `irritable`
- `anxious`
- `energetic`
- `tired`
- `calm`
- `stressed`
- `emotional`
- `confident`

### Privacy Levels

- `private` - Only user can see
- `friends` - Friends can see
- `public` - Everyone can see

---

## Error Codes

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/expired token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limited |
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

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| General API | 100 requests / 15 min |
| Authentication | 5 requests / 15 min |
| Password Reset | 3 requests / hour |
| Registration | 5 requests / hour |
| Sensitive Data | 30 requests / min |

---

## Notes for Mobile Developers

1. **Token Management**: Store tokens securely (Keychain/Keystore)
2. **Token Refresh**: Implement automatic token refresh before expiry
3. **Offline Support**: Cache cycle/health data locally
4. **Date Format**: Always use ISO 8601 format (`YYYY-MM-DD`)
5. **Timezone**: Server uses UTC; convert to user's timezone in app
6. **Encryption**: Health data is encrypted at rest; no client-side decryption needed
