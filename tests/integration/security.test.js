const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { pool, createTestUser, cleanupTestUsers } = require('../helpers/setup');

let user1, user2;

beforeAll(async () => {
  user1 = await createTestUser({ email: `sec1_${Date.now()}@satsflo.test` });
  user2 = await createTestUser({ email: `sec2_${Date.now()}@satsflo.test` });
});

afterAll(async () => {
  await cleanupTestUsers();
  await pool.end();
});

// ─── Auth Guards ─────────────────────────────────────────────────────────────
describe('Protected routes require auth token', () => {
  const routes = [
    ['GET',    '/api/v1/cycles/current'],
    ['GET',    '/api/v1/cycle-profile'],
    ['GET',    '/api/v1/users/profile'],
    ['GET',    '/api/v1/notifications'],
    ['GET',    '/api/v1/journal'],
    ['GET',    '/api/v1/partner'],
    ['GET',    '/api/v1/payments/history'],
    ['GET',    '/api/v1/water-settings'],
    ['GET',    '/api/v1/logs'],
    ['GET',    '/api/v1/lightning/wallet'],
  ];

  test.each(routes)('%s %s → 401 without token', async (method, route) => {
    const res = await request(app)[method.toLowerCase()](route);
    expect(res.status).toBe(401);
  });
});

// ─── JWT Integrity ───────────────────────────────────────────────────────────
describe('JWT tampering', () => {
  test('payload tampered (role escalation) returns 401', async () => {
    const [header, payload, sig] = user1.accessToken.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    decoded.role = 'admin';
    const fakePayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    const tamperedToken = `${header}.${fakePayload}.${sig}`;

    const res = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(res.status).toBe(401);
  });

  test('expired token returns 401', async () => {
    const expiredToken = jwt.sign(
      { userId: user1.userId, email: user1.email, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  test('token signed with wrong secret returns 401', async () => {
    const fakeToken = jwt.sign(
      { userId: user1.userId, email: user1.email, role: 'user' },
      'completely-wrong-secret',
      { expiresIn: '15m' }
    );

    const res = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${fakeToken}`);

    expect(res.status).toBe(401);
  });

  test('malformed Bearer token returns 401', async () => {
    const res = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', 'Bearer notavalidtoken');

    expect(res.status).toBe(401);
  });

  test('missing Bearer prefix returns 401', async () => {
    const res = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', user1.accessToken); // no "Bearer " prefix

    expect(res.status).toBe(401);
  });
});

// ─── Input Validation ────────────────────────────────────────────────────────
describe('Input validation', () => {
  test('SQL injection in login email returns 400 (not 500)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: "' OR 1=1; DROP TABLE users;--", password: 'anything' });

    expect(res.status).toBe(400);
  });

  test('XSS in registration name is blocked or sanitized', async () => {
    const xssEmail = `xss_${Date.now()}@satsflo.test`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: '<script>alert("xss")</script>',
        email: xssEmail,
        password: 'Test1234!',
        confirm_password: 'Test1234!'
      });

    if (res.status === 201) {
      // Allowed through — name must be sanitized
      expect(res.body.data.user.name).not.toContain('<script>');
      await pool.query('DELETE FROM users WHERE email = $1', [xssEmail]);
    } else {
      expect(res.status).toBe(400);
    }
  });

  test('oversized name (10 000 chars) returns 400 or 413', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'A'.repeat(10000),
        email: `big_${Date.now()}@satsflo.test`,
        password: 'Test1234!',
        confirm_password: 'Test1234!'
      });

    expect([400, 413]).toContain(res.status);
  });

  test('empty body to login returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── Response Shape Contracts ─────────────────────────────────────────────────
// These tests catch silent breaking changes when services are refactored.
describe('Response shape contracts', () => {
  test('GET /notifications has required fields', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${user1.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);

    if (res.body.data.length > 0) {
      const n = res.body.data[0];
      expect(n).toHaveProperty('id');
      expect(n).toHaveProperty('type');
      expect(n).toHaveProperty('message');
      expect(n).toHaveProperty('is_read');
      expect(n).toHaveProperty('created_at');
      // Frontend reads both 'read' and 'is_read' aliases
      expect(n).toHaveProperty('read');
    }
  });

  test('GET /cycles/current has correct predictions shape (or 404 if no cycle)', async () => {
    const res = await request(app)
      .get('/api/v1/cycles/current')
      .set('Authorization', `Bearer ${user1.accessToken}`);

    expect([200, 404]).toContain(res.status);

    if (res.status === 200) {
      const d = res.body.data;
      expect(d).toHaveProperty('dayOfCycle');
      expect(d).toHaveProperty('cycleLength');
      expect(d).toHaveProperty('phase');
      expect(d).toHaveProperty('predictions');
      // Frontend reads predictions.nextPeriod.daysUntil — NOT predictions.daysUntilPeriod
      expect(d.predictions).toHaveProperty('nextPeriod');
      expect(d.predictions.nextPeriod).toHaveProperty('daysUntil');
      expect(d.predictions.nextPeriod).toHaveProperty('date');
      expect(d.predictions).toHaveProperty('ovulation');
      expect(d.predictions).toHaveProperty('fertileWindow');
    }
  });

  test('GET /users/profile has required fields', async () => {
    const res = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${user1.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('email');
    expect(res.body.data).toHaveProperty('name');
  });

  test('GET /water-settings has required fields', async () => {
    const res = await request(app)
      .get('/api/v1/water-settings')
      .set('Authorization', `Bearer ${user1.accessToken}`);

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.data).toHaveProperty('daily_goal_ml');
    }
  });
});

// ─── Data Isolation ───────────────────────────────────────────────────────────
describe('Data isolation between users', () => {
  test('user profile only returns own data', async () => {
    const [res1, res2] = await Promise.all([
      request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${user1.accessToken}`),
      request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${user2.accessToken}`)
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.data.id).toBe(user1.userId);
    expect(res2.body.data.id).toBe(user2.userId);
    expect(res1.body.data.id).not.toBe(res2.body.data.id);
  });
});
