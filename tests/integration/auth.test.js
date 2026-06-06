const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../../src/app');
const { pool, createTestUser, cleanupUser, cleanupTestUsers } = require('../helpers/setup');

afterAll(async () => {
  await cleanupTestUsers();
});

// ─── Register ────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
  let email;

  beforeEach(() => { email = `reg_${Date.now()}@satsflo.test`; });
  afterEach(async () => { await cleanupUser(email); });

  test('creates user and returns tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test User', email, password: 'Test1234!', confirm_password: 'Test1234!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.emailVerified).toBe(false);
  });

  test('duplicate email returns 409', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'First', email, password: 'Test1234!', confirm_password: 'Test1234!' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Second', email, password: 'Test1234!', confirm_password: 'Test1234!' });

    expect(res.status).toBe(409);
  });

  test('weak password (no uppercase/number/special) returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email, password: 'weakpassword', confirm_password: 'weakpassword' });

    expect(res.status).toBe(400);
  });

  test('mismatched passwords returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email, password: 'Test1234!', confirm_password: 'Different1!' });

    expect(res.status).toBe(400);
  });

  test('missing email returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test', password: 'Test1234!', confirm_password: 'Test1234!' });

    expect(res.status).toBe(400);
  });

  test('invalid email format returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email: 'notanemail', password: 'Test1234!', confirm_password: 'Test1234!' });

    expect(res.status).toBe(400);
  });
});

// ─── Login ───────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/login', () => {
  let user;
  const email = `login_${Date.now()}@satsflo.test`;

  beforeAll(async () => { user = await createTestUser({ email }); });
  afterAll(async () => { await cleanupUser(email); });

  test('correct credentials return tokens and expiresIn', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data).toHaveProperty('expiresIn');
  });

  test('wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'WrongPass1!' });

    expect(res.status).toBe(401);
  });

  test('nonexistent email returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'Test1234!' });

    expect(res.status).toBe(401);
  });

  test('missing password returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email });

    expect(res.status).toBe(400);
  });
});

// ─── Token Refresh ───────────────────────────────────────────────────────────
describe('POST /api/v1/auth/refresh', () => {
  let refreshToken;
  const email = `refresh_${Date.now()}@satsflo.test`;

  beforeAll(async () => {
    await createTestUser({ email });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Test1234!' });
    refreshToken = res.body.data.refreshToken;
  });

  afterAll(async () => { await cleanupUser(email); });

  test('valid refresh token returns new token pair', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    // New refresh token should be different (rotation)
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
  });

  test('syntactically valid but wrong-secret refresh token returns 401', async () => {
    const jwt = require('jsonwebtoken');
    const fakeToken = jwt.sign({ userId: 'fake-id' }, 'wrong-secret', { expiresIn: '7d' });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: fakeToken });

    expect(res.status).toBe(401);
  });

  test('missing refresh token returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({});

    expect([400, 401]).toContain(res.status);
  });
});

// ─── Logout ──────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/logout', () => {
  const email = `logout_${Date.now()}@satsflo.test`;
  let accessToken, refreshToken;

  beforeAll(async () => {
    await createTestUser({ email });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Test1234!' });
    accessToken  = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  afterAll(async () => { await cleanupUser(email); });

  test('logout succeeds with valid token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
  });

  test('revoked refresh token cannot be reused', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });
});

// ─── Forgot Password ─────────────────────────────────────────────────────────
describe('POST /api/v1/auth/forgot-password', () => {
  test('always returns 200 (no email enumeration)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nonexistent@nowhere.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('missing email returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── Verify OTP ───────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/verify-otp', () => {
  test('wrong OTP returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email: 'nobody@nowhere.com', otp: '000000' });

    expect([400, 401]).toContain(res.status);
  });

  test('malformed OTP (not 6 digits) returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email: 'test@example.com', otp: '12' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
describe('GET /api/v1/auth/me', () => {
  const email = `me_${Date.now()}@satsflo.test`;
  let user;

  beforeAll(async () => { user = await createTestUser({ email }); });
  afterAll(async () => { await cleanupUser(email); });

  test('returns current user with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(email);
  });

  test('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
