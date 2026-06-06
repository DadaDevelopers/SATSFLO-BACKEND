// Unit tests for pure cycle calculation methods — no DB or network needed

// Mock the DB so importing cycle.service.js doesn't open a real connection
jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), http: jest.fn()
}));

// cycle.service exports a singleton instance, not the class
const service = require('../../src/services/cycle.service');

// ─── calculatePhase ──────────────────────────────────────────────────────────
describe('CycleService.calculatePhase', () => {
  // cycle=28, period=5, ovulationDay=14 (28-14)
  const C = 28, P = 5, OV = 14;

  test('day 1 → menstrual', () => {
    expect(service.calculatePhase(1, C, P, OV).name).toBe('menstrual');
  });

  test('day 5 → menstrual (last period day)', () => {
    expect(service.calculatePhase(5, C, P, OV).name).toBe('menstrual');
  });

  test('day 6 → follicular (first day after period)', () => {
    expect(service.calculatePhase(6, C, P, OV).name).toBe('follicular');
  });

  test('day 11 → follicular (day <= ovDay-2 = 12)', () => {
    expect(service.calculatePhase(11, C, P, OV).name).toBe('follicular');
  });

  test('day 12 → follicular (boundary: ovDay-2)', () => {
    expect(service.calculatePhase(12, C, P, OV).name).toBe('follicular');
  });

  test('day 13 → ovulation (day <= ovDay+2 = 16)', () => {
    expect(service.calculatePhase(13, C, P, OV).name).toBe('ovulation');
  });

  test('day 14 → ovulation', () => {
    expect(service.calculatePhase(14, C, P, OV).name).toBe('ovulation');
  });

  test('day 16 → ovulation (boundary: ovDay+2)', () => {
    expect(service.calculatePhase(16, C, P, OV).name).toBe('ovulation');
  });

  test('day 17 → luteal', () => {
    expect(service.calculatePhase(17, C, P, OV).name).toBe('luteal');
  });

  test('day 28 → luteal (last day of cycle)', () => {
    expect(service.calculatePhase(28, C, P, OV).name).toBe('luteal');
  });

  test('isFertile flag set only during ovulation phase', () => {
    expect(service.calculatePhase(14, C, P, OV).isFertile).toBe(true);
    expect(service.calculatePhase(5, C, P, OV).isFertile).toBeUndefined();
    expect(service.calculatePhase(20, C, P, OV).isFertile).toBeUndefined();
  });

  test('omitting ovulationDay falls back to cycleLength - 14', () => {
    // cycle=30, period=5, no ovulationDay → ovDay = 30-14 = 16
    expect(service.calculatePhase(16, 30, 5, undefined).name).toBe('ovulation');
    expect(service.calculatePhase(17, 30, 5, undefined).name).toBe('ovulation');
    expect(service.calculatePhase(18, 30, 5, undefined).name).toBe('ovulation');
    expect(service.calculatePhase(19, 30, 5, undefined).name).toBe('luteal');
  });

  test('longer luteal phase (16 days) shifts ovulation earlier', () => {
    // cycle=28, luteal=16 → ovDay=12; ovulation window: days 11-14 (ovDay-2 to ovDay+2)
    expect(service.calculatePhase(12, 28, 5, 12).name).toBe('ovulation');
    expect(service.calculatePhase(11, 28, 5, 12).name).toBe('ovulation'); // ovDay-1 is still in window
    expect(service.calculatePhase(10, 28, 5, 12).name).toBe('follicular'); // ovDay-2 boundary → follicular
  });
});

// ─── calculatePredictions ────────────────────────────────────────────────────
describe('CycleService.calculatePredictions', () => {
  const mkDate = (daysAgo) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d;
  };

  const today = (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; })();

  test('next period is exactly one cycle away', () => {
    // Period started 14 days ago, cycle=28, cyclesPassed=0
    const start = mkDate(14);
    const preds = service.calculatePredictions(start, 28, 5, 0, today);
    expect(preds.nextPeriod.daysUntil).toBe(14); // 28 - 14 days elapsed
  });

  test('daysUntil is non-negative when cycle has not yet overrun', () => {
    const start = mkDate(5);
    const preds = service.calculatePredictions(start, 28, 5, 0, today);
    expect(preds.nextPeriod.daysUntil).toBeGreaterThanOrEqual(0);
  });

  test('nextPeriod.endDate is periodLength-1 days after startDate', () => {
    const start = mkDate(0); // today
    const preds = service.calculatePredictions(start, 28, 5, 0, today);

    const startD = new Date(preds.nextPeriod.date);
    const endD   = new Date(preds.nextPeriod.endDate);
    const diff   = Math.round((endD - startD) / 86_400_000);
    expect(diff).toBe(4); // periodLength-1 = 5-1 = 4
  });

  test('ovulation date is 14 days before next period', () => {
    const start = mkDate(7);
    const preds = service.calculatePredictions(start, 28, 5, 0, today);

    const periodDate   = new Date(preds.nextPeriod.date);
    const ovulationDate = new Date(preds.ovulation.date);
    const diff = Math.round((periodDate - ovulationDate) / 86_400_000);
    expect(diff).toBe(14);
  });

  test('fertile window starts 5 days before ovulation and ends 1 day after', () => {
    const start = mkDate(7);
    const preds = service.calculatePredictions(start, 28, 5, 0, today);

    const ov    = new Date(preds.ovulation.date);
    const fStart = new Date(preds.fertileWindow.start);
    const fEnd   = new Date(preds.fertileWindow.end);

    expect(Math.round((ov - fStart) / 86_400_000)).toBe(5);
    expect(Math.round((fEnd - ov) / 86_400_000)).toBe(1);
  });

  test('multiple cycles passed still gives correct next-period date', () => {
    // Period started 70 days ago, cycle=28, cyclesPassed=2
    const start = mkDate(70);
    const preds = service.calculatePredictions(start, 28, 5, 2, today);
    // Next period = start + 3*28 = start + 84 days → 84-70 = 14 days from now
    expect(preds.nextPeriod.daysUntil).toBe(14);
  });

  test('output keys match the expected response shape', () => {
    const start = mkDate(10);
    const preds = service.calculatePredictions(start, 28, 5, 0, today);

    expect(preds).toHaveProperty('nextPeriod.date');
    expect(preds).toHaveProperty('nextPeriod.endDate');
    expect(preds).toHaveProperty('nextPeriod.daysUntil');
    expect(preds).toHaveProperty('ovulation.date');
    expect(preds).toHaveProperty('ovulation.daysUntil');
    expect(preds).toHaveProperty('fertileWindow.start');
    expect(preds).toHaveProperty('fertileWindow.end');
  });

  // ── Luteal phase bug (line 564 hardcodes -14) ──────────────────────────────
  // calculatePredictions needs a lutealPhaseLength param (6th arg) for these to pass.
  // Until then both tests fail — that's intentional: they document the required fix.

  test('ovulation uses luteal_phase_length, not hardcoded 14', () => {
    const startDate = new Date('2026-01-01T00:00:00Z');
    const fixedToday = new Date('2026-01-01T00:00:00Z');

    // luteal=16 → ovulation should be 16 days before next period (day 12 of cycle, not day 14)
    const result = service.calculatePredictions(startDate, 28, 5, 0, fixedToday, 16);

    const nextPeriod = new Date(result.nextPeriod.date);
    const ovulation  = new Date(result.ovulation.date);
    const daysBeforePeriod = (nextPeriod - ovulation) / (1000 * 60 * 60 * 24);
    expect(daysBeforePeriod).toBe(16);
  });

  test('hardcoded -14 bug: ovulation is wrong when luteal phase is not 14', () => {
    const startDate = new Date('2026-01-01T00:00:00Z');
    const fixedToday = new Date('2026-01-01T00:00:00Z');

    const result14 = service.calculatePredictions(startDate, 28, 5, 0, fixedToday, 14);
    const result16 = service.calculatePredictions(startDate, 28, 5, 0, fixedToday, 16);

    const ov14 = new Date(result14.ovulation.date);
    const ov16 = new Date(result16.ovulation.date);
    const diff = (ov14 - ov16) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(2); // fails until line 564 uses lutealPhaseLength instead of 14
  });
});
