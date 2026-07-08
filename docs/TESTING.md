# Testing

## Stack

| Tool | Purpose |
|------|---------|
| Jest 30 | Test runner, assertions |
| Supertest | HTTP integration testing against the live Express app |
| pg (real DB) | Tests run against a real PostgreSQL database — no mocks |

Tests run sequentially (`maxWorkers: 1`) because they share a database.

## Running Tests

```bash
npm test                    # full suite
npm run test:watch          # watch mode
npm run test:coverage       # coverage report in coverage/
npm run test:auth           # auth tests only
npm run test:cycle          # cycle unit tests only
npm run test:security       # security tests only

# Single file
jest tests/integration/partner.test.js

# Match test name
jest --testNamePattern="invite"

# Debug
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Test Database Setup

Tests require a running PostgreSQL instance with migrations applied:

```bash
# Create the test database (once)
createdb satsflo_test

# Apply migrations
npm run migrate

# Run tests
npm test
```

Minimum env vars for tests:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=satsflo_test
DB_USER=satsflo
DB_PASSWORD=satsflo_pass
DB_SSL=false
JWT_SECRET=<any-32-char-string>
JWT_REFRESH_SECRET=<any-32-char-string>
NODE_ENV=test
```

## Test Files

```
tests/
├── unit/
│   └── cycle.test.js          # pure calculation logic (no DB)
├── integration/
│   ├── auth.test.js           # authentication flows
│   ├── cycles.test.js         # cycle tracking API
│   ├── partner.test.js        # partner pairing & sharing
│   └── security.test.js       # security guards & data isolation
└── helpers/
    ├── setup.js               # createTestUser, cleanupUser, pool
    └── globalTeardown.js      # closes DB pool after all tests
```

## What Each File Covers

### `tests/unit/cycle.test.js` — 21 tests

Pure function tests, no database.

- **`calculatePhase()`** — determines cycle phase (menstrual / follicular / ovulation / luteal) including boundary conditions at the ovulation window (ovDay ± 2) and the `isFertile` flag
- **`calculatePredictions()`** — next period date, ovulation date, fertile window; tests multi-cycle rollover

> **Known issue documented in tests:** `calculatePredictions()` currently hardcodes `-14` instead of using the `lutealPhaseLength` parameter (cycle.service.js line ~564). Tests 160–184 demonstrate the incorrect behaviour and serve as a specification for the fix.

### `tests/integration/auth.test.js` — 27 tests

| Group | Count | What it checks |
|-------|-------|---------------|
| POST /auth/register | 6 | creates account, duplicate email (409), weak password (400), mismatched passwords, missing fields |
| POST /auth/login | 4 | valid credentials, wrong password (401), unknown email (401), missing password (400) |
| POST /auth/refresh | 3 | token rotation, wrong-secret token (401), missing token (400) |
| POST /auth/logout | 2 | revokes token, prevents reuse |
| POST /auth/forgot-password | 2 | always 200 (no enumeration), missing email (400) |
| POST /auth/verify-otp | 2 | wrong OTP (400), malformed OTP (400) |
| GET /auth/me | 2 | returns user, 401 without token |
| POST /auth/google | 6 | new user, returning user, account linking, suspended (403), missing token (400), invalid token (401/500) |

Google auth tests mock `verifyGoogleToken` from `src/config/google.js` via `jest.mock`.

### `tests/integration/cycles.test.js` — ~40 tests

| Group | Endpoint | What it checks |
|-------|----------|---------------|
| Cycle Profile | POST/PUT/GET /cycle-profile | create, partial update, live calculations, auth required |
| Start/End Period | POST /cycles/start, /cycles/end | starts cycle, syncs `last_period_start`, invalid dates (400) |
| Current Cycle | GET /cycles/current | null when no cycle, full shape with active cycle, `current_day` accuracy |
| Predictions | GET /cycles/predictions | null when no history, full shape (nextPeriod, ovulation, fertileWindow) |
| Phases | GET /cycles/phases | null when no history, all 4 phases with start/end/days |
| Forecast | GET /cycles/forecast | shape, `months` capped at 12, luteal_phase_length bug documented |
| Analytics | GET /cycles/analytics | empty when no cycles, shape, date range params |
| History | GET /cycles | pagination shape |
| Daily Log | POST /cycles/log, GET /cycles/log/:date | log flow intensity, invalid intensity (400), fetch by date |

### `tests/integration/security.test.js` — ~24 tests

| Group | What it checks |
|-------|---------------|
| Auth guards | 10+ protected routes return 401 without token |
| JWT tampering | payload modification blocked, expired tokens (401), wrong secret (401), malformed header (401) |
| Input validation | SQL injection in email (400), XSS in name sanitized, 10k-char name (400/413), empty body (400) |
| Response contracts | Notifications, cycle/current, users/profile, water-settings have required fields |
| Data isolation | Two users get separate data; neither can read the other's records |

### `tests/integration/partner.test.js` — ~60 tests

| Group | Count | What it checks |
|-------|-------|---------------|
| Auth guards | 11 | all partner routes require token |
| Invite generation | 5 | 6-char code, share_url, expiry, default flags, duplicate invite expires first, 409 if already partnered |
| Accept invite | 7 | happy path (201), case-insensitive, invalid code (404), self-accept (400), receiver already partnered (409) |
| Get partner | 3 | 404 when no partner, partner info + nicknames + sharing, both users see each other |
| Unpair | 3 | 404 when no partner, unpair, both get 404 after |
| Nicknames | 7 | 404/400 guards, update individual fields, A's changes don't affect B |
| Sharing settings | 4 | all 5 flags returned, update, A's changes don't affect B's |
| Partner mode | 4 | requires field (400), 404 when no partner, enable/disable |
| Partner cycle | 6 | 404 guards, cycle phase data, symptoms null (share=false), visible when share=true |
| Partner calendar | 6 | 403 when both flags disabled, period_days, fertility_window, null when not shared |
| Full lifecycle | 1 | invite → accept → view cycle → unpair → re-invite |

## Test Helpers

### `tests/helpers/setup.js`

```js
createTestUser({ email, password = 'Test1234!', name = 'Test User' })
// → { userId, accessToken, email, password }

cleanupUser(email)        // DELETE FROM users WHERE email = $1
cleanupTestUsers()        // DELETE FROM users WHERE email LIKE '%@satsflo.test'
pool                      // direct pg pool for fixture queries
```

All test emails use the `@satsflo.test` suffix for batch cleanup.

### Test isolation pattern

```js
const email = `myfeature_${Date.now()}@satsflo.test`;
beforeAll(async () => { user = await createTestUser({ email }); });
afterAll(async () => { await cleanupUser(email); });
```

## Adding Tests

1. Integration tests go in `tests/integration/<domain>.test.js`
2. Use `createTestUser` for auth — never hardcode JWTs
3. Use timestamp in email to avoid collisions: `` `${feature}_${Date.now()}@satsflo.test` ``
4. Always add an `afterAll` (or `afterEach`) cleanup
5. Every new endpoint needs at minimum: happy path + one 4xx case
6. Use `jest.mock('../../src/config/google')` for any code that calls external APIs

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR:

1. **Lint** — ESLint + Prettier check
2. **Test** — spins up a Postgres 15 service container, runs `npm run migrate`, then `npm test`

Tests must pass before a PR can merge.
