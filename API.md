# Satsflow API Documentation

Complete API reference for the Satsflow mobile application backend.

**Base URL**: `http://localhost:3000/api/v1`

**Content-Type**: `application/json`

---

## Table of Contents

1. [Authentication](#authentication)
2. [User Management](#user-management)
3. [Cycle Tracking](#cycle-tracking)
4. [Health (Symptoms & Moods)](#health-symptoms--moods)
5. [Constants & Enums](#constants--enums)
6. [Error Codes](#error-codes)

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
