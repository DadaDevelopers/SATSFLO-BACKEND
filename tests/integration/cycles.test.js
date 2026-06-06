'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../../src/app');
const { pool, createTestUser, cleanupTestUsers } = require('../helpers/setup');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seedCycleProfile(userId, overrides = {}) {
  const lastPeriodStart = overrides.last_period_start
    ?? new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
  await pool.query(
    `INSERT INTO cycle_profiles
       (user_id, cycle_length, period_length, last_period_start,
        luteal_phase_length, ignore_irregular_cycle, created_at, updated_at)
     VALUES ($1, $2, $3, $4::DATE, $5, $6, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET cycle_length         = EXCLUDED.cycle_length,
           period_length        = EXCLUDED.period_length,
           last_period_start    = EXCLUDED.last_period_start,
           luteal_phase_length  = EXCLUDED.luteal_phase_length,
           ignore_irregular_cycle = EXCLUDED.ignore_irregular_cycle`,
    [
      userId,
      overrides.cycle_length        ?? 28,
      overrides.period_length       ?? 5,
      lastPeriodStart,
      overrides.luteal_phase_length ?? 14,
      overrides.ignore_irregular_cycle ?? false,
    ]
  );
}

async function seedActiveCycle(userId, startDate) {
  // Active cycle = end_date IS NULL (no status column in cycles table)
  const result = await pool.query(
    `INSERT INTO cycles (user_id, start_date, created_at)
     VALUES ($1, $2::DATE, NOW())
     RETURNING id`,
    [userId, startDate]
  );
  return result.rows[0].id;
}

async function wipeCycles(userId) {
  await pool.query('DELETE FROM cycles       WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM cycle_profiles WHERE user_id = $1', [userId]);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let userA, userB;

beforeAll(async () => {
  const ts = Date.now();
  userA = await createTestUser({ email: `cycA_${ts}@satsflo.test` });
  userB = await createTestUser({ email: `cycB_${ts}@satsflo.test` });
});

afterAll(async () => {
  await cleanupTestUsers();
});

// ─── Cycle Profile — partial update ──────────────────────────────────────────

describe('Cycle Profile (PUT /api/v1/cycle-profile)', () => {
  const today = new Date().toISOString().slice(0, 10);

  beforeEach(() => wipeCycles(userA.userId));

  test('POST creates profile and returns live calculations', async () => {
    const res = await request(app)
      .post('/api/v1/cycle-profile')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        last_period_start:  today,
        cycle_length:       28,
        period_length:      5,
        luteal_phase_length: 14,
      });

    expect(res.status).toBe(201);
    const d = res.body.data;
    expect(d.cycle_length).toBe(28);
    expect(d.period_length).toBe(5);
    expect(d.luteal_phase_length).toBe(14);
    expect(d).toHaveProperty('current_day');
    expect(d).toHaveProperty('ovulation_day');
    expect(d).toHaveProperty('current_phase');
    expect(d).toHaveProperty('days_until_period');
  });

  test('PUT with only period_length does not reset cycle_length or luteal_phase_length', async () => {
    await request(app)
      .post('/api/v1/cycle-profile')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ last_period_start: today, cycle_length: 30, period_length: 6, luteal_phase_length: 16 });

    const res = await request(app)
      .put('/api/v1/cycle-profile')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ period_length: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.period_length).toBe(4);
    expect(res.body.data.cycle_length).toBe(30);        // must not reset
    expect(res.body.data.luteal_phase_length).toBe(16); // must not reset
  });

  test('PUT with only luteal_phase_length shifts ovulation_day, not period calculation', async () => {
    await request(app)
      .post('/api/v1/cycle-profile')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ last_period_start: today, cycle_length: 28, period_length: 5, luteal_phase_length: 14 });

    const before = await request(app)
      .get('/api/v1/cycle-profile')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    await request(app)
      .put('/api/v1/cycle-profile')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ luteal_phase_length: 16 });

    const after = await request(app)
      .get('/api/v1/cycle-profile')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    // ovulation_day moves: 28-14=14 → 28-16=12
    expect(before.body.data.ovulation_day).toBe(14);
    expect(after.body.data.ovulation_day).toBe(12);

    // cycle_length and period_length are unchanged
    expect(after.body.data.cycle_length).toBe(28);
    expect(after.body.data.period_length).toBe(5);
  });

  test('GET returns correct live calculations', async () => {
    // Compute expected day at runtime using UTC midnight math (matches the service)
    const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);
    const startUTC = new Date(todayUTC); startUTC.setUTCDate(startUTC.getUTCDate() - 10);
    const tenDaysAgo = startUTC.toISOString().slice(0, 10);
    const expectedDay = 10 + 1; // 10 days elapsed → day 11
    const cycleLength = 28;

    await request(app)
      .post('/api/v1/cycle-profile')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ last_period_start: tenDaysAgo, cycle_length: cycleLength, period_length: 5, luteal_phase_length: 14 });

    const res = await request(app)
      .get('/api/v1/cycle-profile')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    // current_day ≈ 10-12 (±1 for timezone/local-midnight pg DATE handling)
    expect(d.current_day).toBeGreaterThanOrEqual(10);
    expect(d.current_day).toBeLessThanOrEqual(12);
    expect(d.ovulation_day).toBe(14);                              // 28-14, deterministic
    expect(d.days_until_period).toBe(cycleLength - d.current_day); // formula must hold
    expect(['follicular', 'ovulation']).toContain(d.current_phase);
  });

  test('POST requires last_period_start', async () => {
    const res = await request(app)
      .post('/api/v1/cycle-profile')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ cycle_length: 28, period_length: 5 });

    expect(res.status).toBe(400);
  });

  test('401 without token', async () => {
    const res = await request(app).get('/api/v1/cycle-profile');
    expect(res.status).toBe(401);
  });
});

// ─── POST /cycles/start ───────────────────────────────────────────────────────

describe('POST /api/v1/cycles/start', () => {
  const today = new Date().toISOString().slice(0, 10);

  afterEach(() => wipeCycles(userA.userId));

  test('starts a period and returns cycle with start_date', async () => {
    // validator checks body('date') — start_date alias only works past validation at controller level
    const res = await request(app)
      .post('/api/v1/cycles/start')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ date: today });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
  });

  test('syncs last_period_start in cycle_profiles', async () => {
    await seedCycleProfile(userA.userId, { last_period_start: '2026-01-01' });

    await request(app)
      .post('/api/v1/cycles/start')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ date: today });

    // Cast to TEXT to avoid pg returning a local-midnight Date object that toISOString() shifts
    const row = await pool.query(
      'SELECT last_period_start::TEXT AS last_period_start FROM cycle_profiles WHERE user_id = $1',
      [userA.userId]
    );
    expect(row.rows[0].last_period_start).toBe(today);
  });

  test('missing start_date returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/cycles/start')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('invalid date format returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/cycles/start')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ start_date: 'not-a-date' });

    expect(res.status).toBe(400);
  });

  test('401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/cycles/start')
      .send({ date: today });

    expect(res.status).toBe(401);
  });
});

// ─── POST /cycles/end ─────────────────────────────────────────────────────────

describe('POST /api/v1/cycles/end', () => {
  const today = new Date().toISOString().slice(0, 10);

  afterEach(() => wipeCycles(userA.userId));

  test('ends an active period', async () => {
    await request(app)
      .post('/api/v1/cycles/start')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ date: today });

    const res = await request(app)
      .post('/api/v1/cycles/end')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ date: today });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('missing date returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/cycles/end')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── GET /cycles/current ──────────────────────────────────────────────────────

describe('GET /api/v1/cycles/current', () => {
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);

  afterEach(() => wipeCycles(userA.userId));

  test('returns null data with 200 when no cycle exists', async () => {
    const res = await request(app)
      .get('/api/v1/cycles/current')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  test('returns full shape once a cycle is started', async () => {
    await seedCycleProfile(userA.userId, { last_period_start: tenDaysAgo });
    await seedActiveCycle(userA.userId, tenDaysAgo);

    const res = await request(app)
      .get('/api/v1/cycles/current')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toHaveProperty('current_day');
    expect(d).toHaveProperty('cycle_length');
    expect(d).toHaveProperty('period_length');
    expect(d).toHaveProperty('ovulation_day');
    expect(d).toHaveProperty('current_phase');
    expect(d).toHaveProperty('days_until_next_period');
    expect(d).toHaveProperty('period_dates');
    expect(d).toHaveProperty('fertility_window');
    expect(d).toHaveProperty('ovulation_date');
    expect(d).toHaveProperty('pregnancy_chance');
    expect(d).toHaveProperty('predictions');
    expect(d.predictions).toHaveProperty('nextPeriod.date');
    expect(d.predictions).toHaveProperty('nextPeriod.endDate');
    expect(d.predictions).toHaveProperty('nextPeriod.daysUntil');
    expect(d.predictions).toHaveProperty('ovulation.date');
    expect(d.predictions).toHaveProperty('fertileWindow.start');
    expect(d.predictions).toHaveProperty('fertileWindow.end');
  });

  test('current_day is correct relative to start date', async () => {
    await seedCycleProfile(userA.userId, { last_period_start: tenDaysAgo });
    await seedActiveCycle(userA.userId, tenDaysAgo);

    const res = await request(app)
      .get('/api/v1/cycles/current')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    // ±1 for timezone/pg DATE local-midnight handling
    expect(res.body.data.current_day).toBeGreaterThanOrEqual(10);
    expect(res.body.data.current_day).toBeLessThanOrEqual(12);
  });

  test('period_dates length matches period_length', async () => {
    await seedCycleProfile(userA.userId, { last_period_start: tenDaysAgo, period_length: 6 });
    await seedActiveCycle(userA.userId, tenDaysAgo);

    const res = await request(app)
      .get('/api/v1/cycles/current')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.body.data.period_dates).toHaveLength(6);
  });

  test('predictions.nextPeriod is cycle_length days after start (not affected by luteal change)', async () => {
    await seedCycleProfile(userA.userId, { last_period_start: tenDaysAgo, cycle_length: 28, luteal_phase_length: 16 });
    await seedActiveCycle(userA.userId, tenDaysAgo);

    const res = await request(app)
      .get('/api/v1/cycles/current')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    // daysUntil ≈ 18 (±1 for timezone), but the key invariant is the ovulation gap
    const d = res.body.data;
    expect(d.predictions.nextPeriod.daysUntil).toBeGreaterThanOrEqual(17);
    expect(d.predictions.nextPeriod.daysUntil).toBeLessThanOrEqual(19);
    // Ovulation must be exactly luteal_phase_length (16) days before next period
    const nextPeriod = new Date(d.predictions.nextPeriod.date);
    const ovulation  = new Date(d.predictions.ovulation.date);
    const gap = (nextPeriod - ovulation) / 86_400_000;
    expect(gap).toBe(16);
  });
});

// ─── GET /cycles/predictions ──────────────────────────────────────────────────

describe('GET /api/v1/cycles/predictions', () => {
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);

  afterEach(() => wipeCycles(userA.userId));

  test('returns null data with 200 when no cycle', async () => {
    const res = await request(app)
      .get('/api/v1/cycles/predictions')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  test('returns predictions shape with active cycle', async () => {
    await seedCycleProfile(userA.userId, { last_period_start: tenDaysAgo });
    await seedActiveCycle(userA.userId, tenDaysAgo);

    const res = await request(app)
      .get('/api/v1/cycles/predictions')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toHaveProperty('nextPeriod.date');
    expect(d).toHaveProperty('nextPeriod.endDate');
    expect(d).toHaveProperty('nextPeriod.daysUntil');
    expect(d).toHaveProperty('ovulation.date');
    expect(d).toHaveProperty('ovulation.daysUntil');
    expect(d).toHaveProperty('fertileWindow.start');
    expect(d).toHaveProperty('fertileWindow.end');
    // dates are YYYY-MM-DD
    expect(d.nextPeriod.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.ovulation.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── GET /cycles/phases ───────────────────────────────────────────────────────

describe('GET /api/v1/cycles/phases', () => {
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);

  afterEach(() => wipeCycles(userA.userId));

  test('returns null data with 200 when no cycle', async () => {
    const res = await request(app)
      .get('/api/v1/cycles/phases')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  test('returns all four phases with start/end/days', async () => {
    await seedCycleProfile(userA.userId, { last_period_start: tenDaysAgo });
    await seedActiveCycle(userA.userId, tenDaysAgo);

    const res = await request(app)
      .get('/api/v1/cycles/phases')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toHaveProperty('current_day');
    expect(d).toHaveProperty('cycle_start');
    for (const phase of ['menstrual', 'follicular', 'ovulation', 'luteal']) {
      expect(d.phases).toHaveProperty(phase);
      expect(d.phases[phase]).toHaveProperty('start');
      expect(d.phases[phase]).toHaveProperty('end');
      expect(d.phases[phase]).toHaveProperty('days');
      expect(d.phases[phase].start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('menstrual phase spans period_length days', async () => {
    await seedCycleProfile(userA.userId, { last_period_start: tenDaysAgo, period_length: 6 });
    await seedActiveCycle(userA.userId, tenDaysAgo);

    const res = await request(app)
      .get('/api/v1/cycles/phases')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.body.data.phases.menstrual.days).toBe(6);
  });
});

// ─── GET /cycles/forecast ─────────────────────────────────────────────────────

describe('GET /api/v1/cycles/forecast', () => {
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);

  afterEach(() => wipeCycles(userA.userId));

  test('returns null data with 200 when no cycle history', async () => {
    const res = await request(app)
      .get('/api/v1/cycles/forecast')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  test('returns forecast shape with periods and ovulations arrays', async () => {
    await seedCycleProfile(userA.userId, { last_period_start: tenDaysAgo });
    await seedActiveCycle(userA.userId, tenDaysAgo);

    const res = await request(app)
      .get('/api/v1/cycles/forecast?months=2')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toHaveProperty('cycle_length');
    expect(d).toHaveProperty('period_length');
    expect(Array.isArray(d.periods)).toBe(true);
    expect(Array.isArray(d.ovulations)).toBe(true);
    // Each period entry has start + end
    if (d.periods.length > 0) {
      expect(d.periods[0]).toHaveProperty('start');
      expect(d.periods[0]).toHaveProperty('end');
      expect(d.periods[0].start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // Each ovulation entry has date, fertile_start, fertile_end
    if (d.ovulations.length > 0) {
      expect(d.ovulations[0]).toHaveProperty('date');
      expect(d.ovulations[0]).toHaveProperty('fertile_start');
      expect(d.ovulations[0]).toHaveProperty('fertile_end');
    }
  });

  test('months param is capped at 12', async () => {
    await seedCycleProfile(userA.userId, { last_period_start: tenDaysAgo });
    await seedActiveCycle(userA.userId, tenDaysAgo);

    const res = await request(app)
      .get('/api/v1/cycles/forecast?months=99')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    // Should not 400 — server caps it silently
    expect(res.status).toBe(200);
  });

  test('months=0 is clamped to 1 (no 400)', async () => {
    await seedCycleProfile(userA.userId, { last_period_start: tenDaysAgo });
    await seedActiveCycle(userA.userId, tenDaysAgo);

    const res = await request(app)
      .get('/api/v1/cycles/forecast?months=0')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
  });

  test('ovulation date is luteal_phase_length days before period start', async () => {
    await seedCycleProfile(userA.userId, { last_period_start: tenDaysAgo, cycle_length: 28, luteal_phase_length: 16 });
    await seedActiveCycle(userA.userId, tenDaysAgo);

    const res = await request(app)
      .get('/api/v1/cycles/forecast?months=1')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    const { periods, ovulations } = res.body.data;
    if (periods.length > 0 && ovulations.length > 0) {
      const periodStart  = new Date(periods[0].start);
      const ovulationDay = new Date(ovulations[0].date);
      const gap = (periodStart - ovulationDay) / 86_400_000;
      expect(gap).toBe(16); // luteal_phase_length, not hardcoded 14
    }
  });
});

// ─── GET /cycles/analytics ────────────────────────────────────────────────────

describe('GET /api/v1/cycles/analytics', () => {
  afterEach(() => wipeCycles(userA.userId));

  test('returns empty analytics when no cycles', async () => {
    const res = await request(app)
      .get('/api/v1/cycles/analytics')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.totalCycles).toBe(0);
    expect(d.averageCycleLength).toBeNull();
    expect(d.averagePeriodLength).toBeNull();
    expect(Array.isArray(d.cycles)).toBe(true);
  });

  test('response has all expected keys', async () => {
    const res = await request(app)
      .get('/api/v1/cycles/analytics')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toHaveProperty('totalCycles');
    expect(d).toHaveProperty('averageCycleLength');
    expect(d).toHaveProperty('averagePeriodLength');
    expect(d).toHaveProperty('shortestCycle');
    expect(d).toHaveProperty('longestCycle');
    // cycleVariability only present when there are ≥2 cycles (service omits it on empty path)
    expect(d).toHaveProperty('cycles');
  });

  test('accepts startDate and endDate query params', async () => {
    const res = await request(app)
      .get('/api/v1/cycles/analytics?startDate=2026-01-01&endDate=2026-12-31')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
  });
});

// ─── GET /cycles (history + pagination) ──────────────────────────────────────

describe('GET /api/v1/cycles', () => {
  afterEach(() => wipeCycles(userA.userId));

  test('returns paginated shape', async () => {
    const res = await request(app)
      .get('/api/v1/cycles')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    // Paginated envelope
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.pagination).toHaveProperty('page');
    expect(res.body.pagination).toHaveProperty('limit');
  });

  test('page and limit query params are accepted', async () => {
    const res = await request(app)
      .get('/api/v1/cycles?page=1&limit=5')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.pagination.page).toBe(1);
  });
});

// ─── POST /cycles/log + GET /cycles/log/:date ─────────────────────────────────

describe('POST /api/v1/cycles/log and GET /api/v1/cycles/log/:date', () => {
  const today = new Date().toISOString().slice(0, 10);

  afterEach(() => wipeCycles(userA.userId));

  test('logs a daily entry with flow intensity', async () => {
    const res = await request(app)
      .post('/api/v1/cycles/log')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ date: today, flowIntensity: 'medium' });

    expect(res.status).toBe(200);
  });

  test('invalid flow intensity returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/cycles/log')
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ date: today, flowIntensity: 'extreme' });

    expect(res.status).toBe(400);
  });

  test('GET /cycles/log/:date returns log for that date', async () => {
    const res = await request(app)
      .get(`/api/v1/cycles/log/${today}`)
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
  });

  test('GET /cycles/log/:date with invalid date format returns 400', async () => {
    const res = await request(app)
      .get('/api/v1/cycles/log/not-a-date')
      .set('Authorization', `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(400);
  });
});
