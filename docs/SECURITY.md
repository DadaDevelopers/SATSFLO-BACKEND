# Security

## Auth Flow

### Registration

1. Validate input (see password requirements below)
2. Strip HTML tags from `name` field
3. Hash password with bcrypt (12 rounds)
4. Insert user with `email_verified = false`
5. Generate 24 h verification token → send verification email (non-blocking)
6. Issue access token (15 m) + refresh token (7 d)
7. Store refresh token in `refresh_tokens` table

### Login

1. Fetch user by email
2. Check account status (suspended → 403, deleted → 404)
3. `bcrypt.compare(password, password_hash)` — returns generic 401 on failure (no enumeration)
4. Issue new token pair
5. Store refresh token

### Google Sign-In

1. Receive `idToken` from mobile Google Sign-In SDK
2. `client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })` via `google-auth-library`
3. Extract `{ sub, email, name, picture, email_verified }` from verified payload
4. Find user by `google_id` OR `email`:
   - Not found → create account (`email_verified = true`, no password)
   - Found by email but no `google_id` → link Google ID to existing account
5. Issue token pair

### Token Architecture

| Token | Lifetime | Payload | Secret |
|-------|----------|---------|--------|
| Access | 15 m | `{ userId, email, role }` | `JWT_SECRET` |
| Refresh | 7 d | `{ userId, jti }` | `JWT_REFRESH_SECRET` |

- `jti` (JWT ID) is `crypto.randomBytes(16).toString('hex')` — unique per issuance
- `issuer: 'satsflow-api'`, `audience: 'satsflow-mobile-app'` validated on every verify
- Refresh tokens are stored in the database; revocation is immediate
- Token rotation: every `POST /auth/refresh` revokes the used token and issues a new pair
- Password reset revokes all refresh tokens (all devices)

### Token Verification Middleware

`src/middleware/auth.js — authenticateToken`

1. Extract `Authorization: Bearer <token>` header
2. `jwt.verify(token, jwtConfig.secret, { issuer, audience })`
3. Attaches `req.user = { id, email, role }`
4. Returns 401 if missing, expired, or tampered

### Logout

- Single device: marks one refresh token `revoked = true`
- All devices: marks all user's refresh tokens `revoked = true`

---

## Password Requirements

| Rule | Value |
|------|-------|
| Minimum length | 8 characters |
| Maximum length | 128 characters |
| Requires uppercase | yes |
| Requires lowercase | yes |
| Requires digit | yes |
| Requires special char | no |
| Hashing algorithm | bcrypt |
| Salt rounds | 12 |

---

## Rate Limiting

All rate limits use `express-rate-limit` with `X-RateLimit-*` standard headers.

| Limiter | Endpoint(s) | Window | Max | Notes |
|---------|------------|--------|-----|-------|
| Global API | `/api/*` | 15 min | 100 req | skipped for `/health` and `NODE_ENV=test` |
| Auth | `/auth/login`, `/auth/google`, `/auth/verify-otp` | 15 min | 5 failures | `skipSuccessfulRequests: true` |
| Password reset | `/auth/forgot-password` | 1 hour | 3 req | per IP |
| Registration | `/auth/register` | 1 hour | 5 accounts | per IP |
| Resend verification | `/auth/resend-verification` | 1 hour | 3 emails | per authenticated user |
| Sensitive data | `/cycles/*`, `/health/*`, `/users/health-profile` | 1 min | 30 req | protects encrypted health data |

**In-memory rate limits** (inside `auth.service.js`, single-instance only):

| Limit | Window | Max |
|-------|--------|-----|
| OTP requests per email | 1 hour | 3 |
| Resend verification per user | 1 hour | 3 |

---

## Input Validation & Sanitisation

All body data passes through `sanitizeBody` middleware before reaching validators:
- Strips `undefined` and `null` values
- Trims whitespace from all strings

Per-endpoint validation uses `express-validator`. Errors return 400 with field-level messages.

Specific sanitisation:
- `name` field on registration: HTML tags stripped via `.replace(/<[^>]*>/g, '')` (XSS prevention)
- `email` fields: `normalizeEmail()` applied
- All SQL queries use parameterised values (`$1, $2`) — no string interpolation

---

## Security Headers (Helmet)

`helmet()` with defaults applied globally:

| Header | Value |
|--------|-------|
| Content-Security-Policy | default Helmet policy |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| X-XSS-Protection | `1; mode=block` |
| Referrer-Policy | `no-referrer` |
| Strict-Transport-Security | enforces HTTPS |
| Permissions-Policy | browser feature restrictions |
| Cross-Origin-Opener-Policy | window isolation |

---

## CORS

```js
origin:          ALLOWED_ORIGINS env (comma-separated) or '*'
methods:         GET, POST, PUT, DELETE, PATCH, OPTIONS
allowedHeaders:  Content-Type, Authorization, X-Requested-With
credentials:     true
maxAge:          86400 (24 h — preflight cached)
```

In production, set `ALLOWED_ORIGINS` to your specific frontend domain(s):

```
ALLOWED_ORIGINS=https://satsflo.app,https://app.satsflo.app
```

---

## Role-Based Access Control

Three roles: `user`, `admin`, `moderator`.

`authorize(...roles)` middleware checks `req.user.role` after `authenticateToken`. Example:

```js
router.get('/users', authenticateToken, authorize('admin'), controller.listUsers);
```

`verifyOwnership(getResourceUserId)` ensures a user can only modify their own data (admins bypass):

```js
if (req.user.role !== 'admin' && resourceOwnerId !== req.user.id) → 403
```

---

## Forgot Password — OTP Flow

1. `POST /auth/forgot-password` — rate-limited (3/hour per email)
2. Generate `crypto.randomInt(100000, 999999)` — 6-digit, cryptographically secure
3. Store `email_otp` + `email_otp_expires` (10 min) on user row
4. Send OTP email — **if email delivery fails, OTP is rolled back** (prevents undelivered OTPs persisting in DB)
5. `POST /auth/verify-otp` — validates OTP, clears it from DB, issues 15 min `reset_token`
6. `POST /auth/reset-password/:token` — validates token, hashes new password, marks token `used`, revokes all refresh tokens

---

## Data Encryption

Sensitive fields are encrypted at rest using AES-256-GCM (`ENCRYPTION_KEY` env var).

`src/utils/encryption.js` provides:
- `encrypt(text)` → `"iv:authTag:ciphertext"`
- `decrypt(str)` → plaintext
- `encryptFields(obj, fields)` / `decryptFields(obj, fields)` for bulk field operations

Generate a key: `npm run generate-key`

---

## Trust Proxy

```js
app.set('trust proxy', 1);
```

Required on Render (behind a load balancer) so rate limiters read `X-Forwarded-For` for the real client IP rather than the load balancer address.

---

## Webhook Security

`POST /payments/webhook` validates the `x-webhook-secret` header against the `WEBHOOK_SECRET` environment variable. If the env var is not set, the check is skipped (useful for local development). Set it in production.

---

## What Is Not Handled Here (Frontend Responsibility)

- Certificate pinning
- Biometric / device lock before app open
- Secure storage of tokens on device (use `expo-secure-store` or equivalent)
- Clipboard clearance after OTP paste
