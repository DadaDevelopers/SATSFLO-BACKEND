'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../../src/app');
const { pool, createTestUser, cleanupTestUsers } = require('../helpers/setup');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Insert an active partnership directly — faster than running the full
 * invite-accept flow in every test that just needs a paired state.
 */
async function createPartnership(userAId, userBId, overrides = {}) {
  const result = await pool.query(
    `INSERT INTO partnerships
       (user_a_id, user_b_id,
        a_share_period_dates, a_share_fertile_window, a_share_symptoms_moods,
        a_share_cycle_insights, a_share_sex_drive,
        b_share_period_dates, b_share_fertile_window, b_share_symptoms_moods,
        b_share_cycle_insights, b_share_sex_drive,
        status)
     VALUES ($1, $2,
       $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12,
       'active')
     RETURNING id`,
    [
      userAId, userBId,
      overrides.a_share_period_dates   ?? true,
      overrides.a_share_fertile_window ?? true,
      overrides.a_share_symptoms_moods ?? false,
      overrides.a_share_cycle_insights ?? false,
      overrides.a_share_sex_drive      ?? false,
      overrides.b_share_period_dates   ?? true,
      overrides.b_share_fertile_window ?? true,
      overrides.b_share_symptoms_moods ?? false,
      overrides.b_share_cycle_insights ?? false,
      overrides.b_share_sex_drive      ?? false,
    ]
  );
  return result.rows[0].id;
}

async function createCycleProfile(userId, overrides = {}) {
  await pool.query(
    `INSERT INTO cycle_profiles
       (user_id, cycle_length, period_length, last_period_start,
        luteal_phase_length, created_at, updated_at)
     VALUES ($1, $2, $3, $4::DATE, $5, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET cycle_length      = EXCLUDED.cycle_length,
           period_length     = EXCLUDED.period_length,
           last_period_start = EXCLUDED.last_period_start,
           luteal_phase_length = EXCLUDED.luteal_phase_length`,
    [
      userId,
      overrides.cycle_length       ?? 28,
      overrides.period_length      ?? 5,
      overrides.last_period_start  ?? new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10),
      overrides.luteal_phase_length ?? 14,
    ]
  );
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let userA, userB, userC;

beforeAll(async () => {
  const ts = Date.now();
  userA = await createTestUser({ email: `pA_${ts}@satsflo.test`, name: 'Alice' });
  userB = await createTestUser({ email: `pB_${ts}@satsflo.test`, name: 'Bob' });
  userC = await createTestUser({ email: `pC_${ts}@satsflo.test`, name: 'Carol' });
});

afterAll(async () => {
  await cleanupTestUsers();
  await pool.end();
});

// Clean partnership/invite tables between test groups so they don't bleed.
async function wipePairings() {
  await pool.query(
    `DELETE FROM partnerships WHERE user_a_id IN ($1,$2,$3) OR user_b_id IN ($1,$2,$3)`,
    [userA.userId, userB.userId, userC.userId]
  );
  await pool.query(
    `DELETE FROM partner_invites WHERE sender_id IN ($1,$2,$3)`,
    [userA.userId, userB.userId, userC.userId]
  );
}

// ─── Auth guards ──────────────────────────────────────────────────────────────

describe('Partner routes require auth token', () => {
  const routes = [
    ['POST',   '/api/v1/partner/invite'],
    ['GET',    '/api/v1/partner/invite/status'],
    ['POST',   '/api/v1/partner/accept'],
    ['GET',    '/api/v1/partner'],
    ['DELETE', '/api/v1/partner'],
    ['PUT',    '/api/v1/partner/nickname'],
    ['GET',    '/api/v1/partner/settings'],
    ['PUT',    '/api/v1/partner/settings'],
    ['PUT',    '/api/v1/partner/mode'],
    ['GET',    '/api/v1/partner/cycle'],
    ['GET',    '/api/v1/partner/calendar'],
  ];

  test.each(routes)('%s %s → 401 without token', async (method, route) => {
    const res = await request(app)[method.toLowerCase()](route);
    expect(res.status).toBe(401);
  });
});

// ─── Invite flow ──────────────────────────────────────────────────────────────

describe('POST /api/v1/partner/invite', () => {
  afterEach(wipePairings);

  test('generates invite code and share_url', async () => {
    const res = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('invite_code');
    expect(res.body.data.invite_code).toHaveLength(6);
    expect(res.body.data).toHaveProperty('share_url');
    expect(res.body.data.share_url).toContain(res.body.data.invite_code);
    expect(res.body.data).toHaveProperty('expires_at');
  });

  test('default sharing flags are returned', async () => {
    const res = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.share_period_dates).toBe(true);
    expect(res.body.data.share_fertile_window).toBe(true);
    expect(res.body.data.share_symptoms_moods).toBe(false);
    expect(res.body.data.share_cycle_insights).toBe(false);
    expect(res.body.data.share_sex_drive).toBe(false);
  });

  test('custom sharing flags are respected', async () => {
    const res = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ share_symptoms_moods: true, share_sex_drive: true });

    expect(res.status).toBe(201);
    expect(res.body.data.share_symptoms_moods).toBe(true);
    expect(res.body.data.share_sex_drive).toBe(true);
  });

  test('second invite expires the first (replaces pending)', async () => {
    const first = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});
    const firstCode = first.body.data.invite_code;

    const second = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});

    expect(second.status).toBe(201);
    expect(second.body.data.invite_code).not.toBe(firstCode);

    // First code should now be expired in DB
    const check = await pool.query(
      `SELECT status FROM partner_invites WHERE invite_code = $1`,
      [firstCode]
    );
    expect(check.rows[0]?.status).toBe('expired');
  });

  test('returns 409 if user already has an active partner', async () => {
    await createPartnership(userA.userId, userB.userId);

    const res = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});

    expect(res.status).toBe(409);
  });
});

// ─── Invite status ────────────────────────────────────────────────────────────

describe('GET /api/v1/partner/invite/status', () => {
  afterEach(wipePairings);

  test('returns "none" when no invite exists', async () => {
    const res = await request(app)
      .get('/api/v1/partner/invite/status')
      .set('Authorization', `Bearer ${userC.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('none');
  });

  test('returns pending invite after generating one', async () => {
    await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});

    const res = await request(app)
      .get('/api/v1/partner/invite/status')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data).toHaveProperty('invite_code');
    expect(res.body.data).toHaveProperty('expires_at');
  });
});

// ─── Accept invite ────────────────────────────────────────────────────────────

describe('POST /api/v1/partner/accept', () => {
  afterEach(wipePairings);

  test('happy path: B accepts A\'s invite → 201 with partnership_id + partner', async () => {
    const inviteRes = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});
    const { invite_code } = inviteRes.body.data;

    const res = await request(app)
      .post('/api/v1/partner/accept')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ invite_code });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('partnership_id');
    expect(res.body.data.partner).toHaveProperty('id', userA.userId);
    expect(res.body.data.partner).toHaveProperty('name', 'Alice');
  });

  test('invite code is case-insensitive', async () => {
    const inviteRes = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});
    const code = inviteRes.body.data.invite_code.toLowerCase();

    const res = await request(app)
      .post('/api/v1/partner/accept')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ invite_code: code });

    expect(res.status).toBe(201);
  });

  test('invalid/nonexistent code returns 404', async () => {
    const res = await request(app)
      .post('/api/v1/partner/accept')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ invite_code: 'ZZZZZZ' });

    expect(res.status).toBe(404);
  });

  test('accepting own invite returns 400', async () => {
    const inviteRes = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});
    const { invite_code } = inviteRes.body.data;

    const res = await request(app)
      .post('/api/v1/partner/accept')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ invite_code });

    expect(res.status).toBe(400);
  });

  test('receiver already has a partner returns 409', async () => {
    await createPartnership(userB.userId, userC.userId);

    const inviteRes = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});
    const { invite_code } = inviteRes.body.data;

    const res = await request(app)
      .post('/api/v1/partner/accept')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ invite_code });

    expect(res.status).toBe(409);
  });

  test('missing invite_code returns 422', async () => {
    const res = await request(app)
      .post('/api/v1/partner/accept')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({});

    expect([400, 422]).toContain(res.status);
  });

  test('invite is marked accepted after successful pairing', async () => {
    const inviteRes = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});
    const { invite_code } = inviteRes.body.data;

    await request(app)
      .post('/api/v1/partner/accept')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ invite_code });

    const row = await pool.query(
      `SELECT status FROM partner_invites WHERE invite_code = $1`,
      [invite_code.toUpperCase()]
    );
    expect(row.rows[0]?.status).toBe('accepted');
  });

  test('accepted code cannot be reused by a third user', async () => {
    const inviteRes = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});
    const { invite_code } = inviteRes.body.data;

    await request(app)
      .post('/api/v1/partner/accept')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ invite_code });

    const res = await request(app)
      .post('/api/v1/partner/accept')
      .set('Authorization', `Bearer ${userC.accessToken}`)
      .send({ invite_code });

    expect(res.status).toBe(404);
  });
});

// ─── GET /partner ─────────────────────────────────────────────────────────────

describe('GET /api/v1/partner', () => {
  afterEach(wipePairings);

  test('404 when no active partner', async () => {
    const res = await request(app)
      .get('/api/v1/partner')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(404);
  });

  test('returns partner info, nickname fields, and sharing settings', async () => {
    await createPartnership(userA.userId, userB.userId);

    const res = await request(app)
      .get('/api/v1/partner')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('partnership_id');
    expect(res.body.data.partner.id).toBe(userB.userId);
    expect(res.body.data.partner.name).toBe('Bob');
    expect(res.body.data).toHaveProperty('my_nickname');
    expect(res.body.data).toHaveProperty('partner_nickname');
    expect(res.body.data).toHaveProperty('partner_mode_enabled');
    expect(res.body.data).toHaveProperty('connected_since');
    expect(res.body.data).toHaveProperty('my_sharing');
    expect(res.body.data.my_sharing).toHaveProperty('share_period_dates');
  });

  test('both users see each other as partner', async () => {
    await createPartnership(userA.userId, userB.userId);

    const [resA, resB] = await Promise.all([
      request(app).get('/api/v1/partner').set('Authorization', `Bearer ${userA.accessToken}`),
      request(app).get('/api/v1/partner').set('Authorization', `Bearer ${userB.accessToken}`),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.data.partner.id).toBe(userB.userId);
    expect(resB.body.data.partner.id).toBe(userA.userId);
  });
});

// ─── DELETE /partner (unpair) ─────────────────────────────────────────────────

describe('DELETE /api/v1/partner', () => {
  afterEach(wipePairings);

  test('404 when no active partner', async () => {
    const res = await request(app)
      .delete('/api/v1/partner')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(404);
  });

  test('unpairs successfully and both sides lose the partner', async () => {
    await createPartnership(userA.userId, userB.userId);

    const unpairRes = await request(app)
      .delete('/api/v1/partner')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(unpairRes.status).toBe(200);
    expect(unpairRes.body.data.unlinked).toBe(true);

    // Both users should now get 404
    const [checkA, checkB] = await Promise.all([
      request(app).get('/api/v1/partner').set('Authorization', `Bearer ${userA.accessToken}`),
      request(app).get('/api/v1/partner').set('Authorization', `Bearer ${userB.accessToken}`),
    ]);
    expect(checkA.status).toBe(404);
    expect(checkB.status).toBe(404);
  });

  test('after unpairing, either user can pair with someone else', async () => {
    await createPartnership(userA.userId, userB.userId);

    await request(app)
      .delete('/api/v1/partner')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    // userA can now generate a new invite
    const res = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});
    expect(res.status).toBe(201);
  });
});

// ─── PUT /partner/nickname ────────────────────────────────────────────────────

describe('PUT /api/v1/partner/nickname', () => {
  afterEach(wipePairings);

  test('404 when no active partner', async () => {
    const res = await request(app)
      .put('/api/v1/partner/nickname')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ my_nickname: 'Ali' });

    expect(res.status).toBe(404);
  });

  test('400 when no nickname fields provided', async () => {
    await createPartnership(userA.userId, userB.userId);

    const res = await request(app)
      .put('/api/v1/partner/nickname')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('updates my_nickname only', async () => {
    await createPartnership(userA.userId, userB.userId);

    const res = await request(app)
      .put('/api/v1/partner/nickname')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ my_nickname: 'Allie' });

    expect(res.status).toBe(200);
    expect(res.body.data.my_nickname).toBe('Allie');
  });

  test('updates partner_nickname only', async () => {
    await createPartnership(userA.userId, userB.userId);

    const res = await request(app)
      .put('/api/v1/partner/nickname')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ partner_nickname: 'Bobby' });

    expect(res.status).toBe(200);
    expect(res.body.data.partner_nickname).toBe('Bobby');
  });

  test('updates both nicknames in a single request', async () => {
    await createPartnership(userA.userId, userB.userId);

    const res = await request(app)
      .put('/api/v1/partner/nickname')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ my_nickname: 'Allie', partner_nickname: 'Bobby' });

    expect(res.status).toBe(200);
    expect(res.body.data.my_nickname).toBe('Allie');
    expect(res.body.data.partner_nickname).toBe('Bobby');
  });

  test("A's nickname updates do not affect B's view", async () => {
    await createPartnership(userA.userId, userB.userId);

    await request(app)
      .put('/api/v1/partner/nickname')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ my_nickname: 'Allie', partner_nickname: 'Bobby' });

    const resB = await request(app)
      .get('/api/v1/partner')
      .set('Authorization', `Bearer ${userB.accessToken}`);

    // B's own nickname perspective should still be unset
    expect(resB.body.data.my_nickname).toBeFalsy();
    expect(resB.body.data.partner_nickname).toBeFalsy();
  });
});

// ─── Sharing settings ─────────────────────────────────────────────────────────

describe('GET /api/v1/partner/settings', () => {
  afterEach(wipePairings);

  test('404 when no active partner', async () => {
    const res = await request(app)
      .get('/api/v1/partner/settings')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(404);
  });

  test('returns all five sharing fields', async () => {
    await createPartnership(userA.userId, userB.userId);

    const res = await request(app)
      .get('/api/v1/partner/settings')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toHaveProperty('share_period_dates');
    expect(d).toHaveProperty('share_fertile_window');
    expect(d).toHaveProperty('share_symptoms_moods');
    expect(d).toHaveProperty('share_cycle_insights');
    expect(d).toHaveProperty('share_sex_drive');
  });
});

describe('PUT /api/v1/partner/settings', () => {
  afterEach(wipePairings);

  test('404 when no active partner', async () => {
    const res = await request(app)
      .put('/api/v1/partner/settings')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ share_symptoms_moods: true });

    expect(res.status).toBe(404);
  });

  test('400 when no known fields sent', async () => {
    await createPartnership(userA.userId, userB.userId);

    const res = await request(app)
      .put('/api/v1/partner/settings')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ unknown_field: true });

    expect(res.status).toBe(400);
  });

  test('updates sharing flags and returns new values', async () => {
    await createPartnership(userA.userId, userB.userId);

    const res = await request(app)
      .put('/api/v1/partner/settings')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ share_symptoms_moods: true, share_cycle_insights: true });

    expect(res.status).toBe(200);
    expect(res.body.data.share_symptoms_moods).toBe(true);
    expect(res.body.data.share_cycle_insights).toBe(true);
    // Untouched defaults remain
    expect(res.body.data.share_period_dates).toBe(true);
  });

  test("A's settings change does not alter B's settings", async () => {
    await createPartnership(userA.userId, userB.userId);

    await request(app)
      .put('/api/v1/partner/settings')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ share_symptoms_moods: true });

    const resB = await request(app)
      .get('/api/v1/partner/settings')
      .set('Authorization', `Bearer ${userB.accessToken}`);

    expect(resB.status).toBe(200);
    expect(resB.body.data.share_symptoms_moods).toBe(false);
  });
});

// ─── Partner mode ─────────────────────────────────────────────────────────────

describe('PUT /api/v1/partner/mode', () => {
  afterEach(wipePairings);

  test('400 when partner_mode_enabled is missing', async () => {
    await createPartnership(userA.userId, userB.userId);

    const res = await request(app)
      .put('/api/v1/partner/mode')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('404 when no active partner', async () => {
    const res = await request(app)
      .put('/api/v1/partner/mode')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ partner_mode_enabled: true });

    expect(res.status).toBe(404);
  });

  test('enables partner mode', async () => {
    await createPartnership(userA.userId, userB.userId);

    const res = await request(app)
      .put('/api/v1/partner/mode')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ partner_mode_enabled: true });

    expect(res.status).toBe(200);
    expect(res.body.data.partner_mode_enabled).toBe(true);
  });

  test('disables partner mode', async () => {
    await createPartnership(userA.userId, userB.userId);

    await request(app)
      .put('/api/v1/partner/mode')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ partner_mode_enabled: true });

    const res = await request(app)
      .put('/api/v1/partner/mode')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ partner_mode_enabled: false });

    expect(res.status).toBe(200);
    expect(res.body.data.partner_mode_enabled).toBe(false);
  });
});

// ─── Partner cycle data ───────────────────────────────────────────────────────

describe('GET /api/v1/partner/cycle', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM cycle_profiles WHERE user_id IN ($1,$2,$3)', [
      userA.userId, userB.userId, userC.userId,
    ]);
    await wipePairings();
  });

  test('404 when no active partner', async () => {
    const res = await request(app)
      .get('/api/v1/partner/cycle')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(404);
  });

  test('404 when partner has no cycle profile', async () => {
    await createPartnership(userA.userId, userB.userId);

    const res = await request(app)
      .get('/api/v1/partner/cycle')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(404);
  });

  test('returns cycle phase data when partner has profile', async () => {
    await createPartnership(userA.userId, userB.userId);
    await createCycleProfile(userB.userId);

    const res = await request(app)
      .get('/api/v1/partner/cycle')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toHaveProperty('cycle_day');
    expect(d).toHaveProperty('cycle_phase');
    expect(['menstrual', 'follicular', 'ovulation', 'luteal']).toContain(d.cycle_phase);
    expect(d).toHaveProperty('phase_description');
    expect(d).toHaveProperty('next_period_days');
    expect(d).toHaveProperty('next_ovulation_days');
    expect(d).toHaveProperty('pregnancy_chance');
    expect(d.partner_name).toBe('Bob');
  });

  test('symptoms/moods are null when share_symptoms_moods is false (default)', async () => {
    // Default: a_share_symptoms_moods = false — so B does not share with A
    await createPartnership(userA.userId, userB.userId);
    await createCycleProfile(userB.userId);

    const res = await request(app)
      .get('/api/v1/partner/cycle')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.todays_symptoms).toBeNull();
    expect(res.body.data.moods).toBeNull();
  });

  test('symptoms/moods are visible when share_symptoms_moods is true', async () => {
    await createPartnership(userA.userId, userB.userId, { b_share_symptoms_moods: true });
    await createCycleProfile(userB.userId);

    const res = await request(app)
      .get('/api/v1/partner/cycle')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    // May be empty array (no log today) but should be an array, not null
    expect(Array.isArray(res.body.data.todays_symptoms)).toBe(true);
    expect(Array.isArray(res.body.data.moods)).toBe(true);
  });
});

// ─── Partner calendar data ────────────────────────────────────────────────────

describe('GET /api/v1/partner/calendar', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM cycle_profiles WHERE user_id IN ($1,$2,$3)', [
      userA.userId, userB.userId, userC.userId,
    ]);
    await wipePairings();
  });

  test('404 when no active partner', async () => {
    const res = await request(app)
      .get('/api/v1/partner/calendar')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(404);
  });

  test('403 when partner has disabled both period and fertile sharing', async () => {
    await createPartnership(userA.userId, userB.userId, {
      b_share_period_dates:   false,
      b_share_fertile_window: false,
    });
    await createCycleProfile(userB.userId);

    const res = await request(app)
      .get('/api/v1/partner/calendar')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(403);
  });

  test('404 when partner has no cycle profile', async () => {
    await createPartnership(userA.userId, userB.userId);
    // No cycle profile inserted for B

    const res = await request(app)
      .get('/api/v1/partner/calendar')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(404);
  });

  test('returns period_days and fertility_window when both are shared (default)', async () => {
    await createPartnership(userA.userId, userB.userId);
    await createCycleProfile(userB.userId);

    const res = await request(app)
      .get('/api/v1/partner/calendar')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(Array.isArray(d.period_days)).toBe(true);
    expect(d.period_days.length).toBe(5); // default period_length = 5
    expect(Array.isArray(d.fertility_window)).toBe(true);
    expect(d.fertility_window.length).toBe(6);
    expect(d).toHaveProperty('ovulation_day');
    expect(d).toHaveProperty('cycle_count');
    // Dates should be ISO strings
    expect(d.period_days[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('period_days is null when share_period_dates is false', async () => {
    await createPartnership(userA.userId, userB.userId, {
      b_share_period_dates:   false,
      b_share_fertile_window: true,
    });
    await createCycleProfile(userB.userId);

    const res = await request(app)
      .get('/api/v1/partner/calendar')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.period_days).toBeNull();
    expect(Array.isArray(res.body.data.fertility_window)).toBe(true);
  });

  test('fertility_window is null when share_fertile_window is false', async () => {
    await createPartnership(userA.userId, userB.userId, {
      b_share_period_dates:   true,
      b_share_fertile_window: false,
    });
    await createCycleProfile(userB.userId);

    const res = await request(app)
      .get('/api/v1/partner/calendar')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.period_days)).toBe(true);
    expect(res.body.data.fertility_window).toBeNull();
    expect(res.body.data.ovulation_day).toBeNull();
  });
});

// ─── Full invite-accept-cycle-unpair flow ─────────────────────────────────────

describe('Full partner lifecycle (invite → accept → cycle view → unpair)', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM cycle_profiles WHERE user_id IN ($1,$2,$3)', [
      userA.userId, userB.userId, userC.userId,
    ]);
    await wipePairings();
  });

  test('end-to-end: invite, accept, view cycle, unpair, re-invite', async () => {
    // 1. A invites B
    const inviteRes = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ share_symptoms_moods: true });
    expect(inviteRes.status).toBe(201);
    const { invite_code } = inviteRes.body.data;

    // 2. B accepts
    const acceptRes = await request(app)
      .post('/api/v1/partner/accept')
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ invite_code });
    expect(acceptRes.status).toBe(201);

    // 3. Both can see each other
    const [pa, pb] = await Promise.all([
      request(app).get('/api/v1/partner').set('Authorization', `Bearer ${userA.accessToken}`),
      request(app).get('/api/v1/partner').set('Authorization', `Bearer ${userB.accessToken}`),
    ]);
    expect(pa.body.data.partner.id).toBe(userB.userId);
    expect(pb.body.data.partner.id).toBe(userA.userId);

    // 4. B sets a cycle profile
    await createCycleProfile(userB.userId);

    // 5. A can view B's cycle (invite had share_symptoms_moods: true for A's sharing,
    //    but what A sees is B's permissions — B defaults share_symptoms_moods=false,
    //    so symptoms null is still correct behaviour)
    const cycleRes = await request(app)
      .get('/api/v1/partner/cycle')
      .set('Authorization', `Bearer ${userA.accessToken}`);
    expect(cycleRes.status).toBe(200);
    expect(cycleRes.body.data).toHaveProperty('cycle_phase');

    // 6. A unpairs
    const unpairRes = await request(app)
      .delete('/api/v1/partner')
      .set('Authorization', `Bearer ${userA.accessToken}`);
    expect(unpairRes.status).toBe(200);

    // 7. Both see 404
    const [na, nb] = await Promise.all([
      request(app).get('/api/v1/partner').set('Authorization', `Bearer ${userA.accessToken}`),
      request(app).get('/api/v1/partner').set('Authorization', `Bearer ${userB.accessToken}`),
    ]);
    expect(na.status).toBe(404);
    expect(nb.status).toBe(404);

    // 8. A can immediately re-invite C
    const reInvite = await request(app)
      .post('/api/v1/partner/invite')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});
    expect(reInvite.status).toBe(201);
    expect(reInvite.body.data.invite_code).toHaveLength(6);
  });
});
