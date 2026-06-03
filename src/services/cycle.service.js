/**
 * Cycle Service
 *
 * Handles period tracking, cycle management, and predictions
 */

const { pool } = require('../config/database');
const Encryption = require('../utils/encryption');
const logger = require('../utils/logger');
const { CYCLE_PHASES, CYCLE_DEFAULTS } = require('../utils/constants');

class CycleService {
  /**
   * Start a new period (creates new cycle)
   */
  async startPeriod(userId, { date, flowIntensity, notes }) {
    // Check for existing active cycle
    const activeResult = await pool.query(
      `SELECT id FROM cycles
       WHERE user_id = $1 AND end_date IS NULL
       ORDER BY start_date DESC LIMIT 1`,
      [userId]
    );
    const activeCycle = activeResult.rows[0];

    if (activeCycle) {
      const previousDay = new Date(date);
      previousDay.setDate(previousDay.getDate() - 1);

      await pool.query(
        'UPDATE cycles SET end_date = $1 WHERE id = $2',
        [previousDay.toISOString().split('T')[0], activeCycle.id]
      );
    }

    const result = await pool.query(
      `INSERT INTO cycles (user_id, start_date, notes, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [userId, date, notes ? Encryption.encrypt(notes) : null]
    );
    const cycle = result.rows[0];

    if (!cycle) {
      throw new Error('Failed to start period');
    }

    // Log first day entry
    await this.logDailyEntry(userId, {
      date,
      cycleId: cycle.id,
      flowIntensity: flowIntensity || 'medium',
      isFirstDay: true
    });

    // Update health profile with last period date
    await pool.query(
      'UPDATE health_profiles SET last_period_date = $1 WHERE user_id = $2',
      [date, userId]
    );

    // Keep cycle_profiles in sync so GET /cycle-profile calculations stay accurate
    await pool.query(
      'UPDATE cycle_profiles SET last_period_start = $1, updated_at = NOW() WHERE user_id = $2',
      [date, userId]
    );

    logger.info('Period started', { userId, cycleId: cycle.id });
    return this.formatCycle(cycle);
  }

  /**
   * End current period
   */
  async endPeriod(userId, { date }) {
    const result = await pool.query(
      `SELECT * FROM cycles
       WHERE user_id = $1 AND end_date IS NULL
       ORDER BY start_date DESC LIMIT 1`,
      [userId]
    );
    const cycle = result.rows[0];

    if (!cycle) {
      const error = new Error('No active period found');
      error.statusCode = 404;
      throw error;
    }

    if (new Date(date) < new Date(cycle.start_date)) {
      const error = new Error('End date cannot be before start date');
      error.statusCode = 400;
      throw error;
    }

    const startDate = new Date(cycle.start_date);
    const endDate = new Date(date);
    const periodLength = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    const updated = await pool.query(
      `UPDATE cycles
       SET period_end_date = $1, period_length = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [date, periodLength, cycle.id]
    );

    await this.updateAverages(userId);

    logger.info('Period ended', { userId, cycleId: cycle.id, periodLength });
    return this.formatCycle(updated.rows[0]);
  }

  /**
   * Update start date of current active cycle
   */
  async updatePeriodStart(userId, { date }) {
    const result = await pool.query(
      `UPDATE cycles SET start_date = $1, updated_at = NOW()
       WHERE user_id = $2 AND end_date IS NULL
       RETURNING *`,
      [date, userId]
    );
    if (!result.rows[0]) {
      const error = new Error('No active period found');
      error.statusCode = 404;
      throw error;
    }
    // Keep cycle_profiles in sync
    await pool.query(
      'UPDATE cycle_profiles SET last_period_start = $1, updated_at = NOW() WHERE user_id = $2',
      [date, userId]
    );
    await pool.query(
      'UPDATE health_profiles SET last_period_date = $1 WHERE user_id = $2',
      [date, userId]
    );
    logger.info('Period start date updated', { userId, date });
    return this.formatCycle(result.rows[0]);
  }

  /**
   * Update end date of current active cycle's period
   */
  async updatePeriodEnd(userId, { date }) {
    const cycleResult = await pool.query(
      `SELECT * FROM cycles WHERE user_id = $1 AND end_date IS NULL ORDER BY start_date DESC LIMIT 1`,
      [userId]
    );
    const cycle = cycleResult.rows[0];
    if (!cycle) {
      const error = new Error('No active period found');
      error.statusCode = 404;
      throw error;
    }
    if (new Date(date) < new Date(cycle.start_date)) {
      const error = new Error('End date cannot be before start date');
      error.statusCode = 400;
      throw error;
    }
    const periodLength = Math.ceil(
      (new Date(date) - new Date(cycle.start_date)) / (1000 * 60 * 60 * 24)
    ) + 1;
    const updated = await pool.query(
      `UPDATE cycles SET period_end_date = $1, period_length = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [date, periodLength, cycle.id]
    );
    await this.updateAverages(userId);
    logger.info('Period end date updated', { userId, date });
    return this.formatCycle(updated.rows[0]);
  }

  /**
   * Log daily entry for cycle
   */
  async logDailyEntry(userId, data) {
    const {
      date,
      cycleId,
      flowIntensity,
      temperature,
      cervicalMucus,
      sexualActivity,
      contraceptionUsed,
      notes,
      isFirstDay = false
    } = data;

    // Get cycle ID if not provided
    let targetCycleId = cycleId;
    if (!targetCycleId) {
      const cycleResult = await pool.query(
        `SELECT id FROM cycles
         WHERE user_id = $1 AND start_date <= $2
         ORDER BY start_date DESC LIMIT 1`,
        [userId, date]
      );
      targetCycleId = cycleResult.rows[0]?.id;
    }

    // Check if entry exists for this date
    const existingResult = await pool.query(
      'SELECT id FROM cycle_logs WHERE user_id = $1 AND date = $2',
      [userId, date]
    );
    const existingEntry = existingResult.rows[0];

    const encryptedNotes = notes ? Encryption.encrypt(notes) : null;

    let result;
    if (existingEntry) {
      result = await pool.query(
        `UPDATE cycle_logs
         SET cycle_id = $1, flow_intensity = $2, temperature = $3,
             cervical_mucus = $4, sexual_activity = $5, contraception_used = $6,
             notes = $7, updated_at = NOW()
         WHERE id = $8
         RETURNING *`,
        [targetCycleId, flowIntensity, temperature, cervicalMucus,
         sexualActivity, contraceptionUsed, encryptedNotes, existingEntry.id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO cycle_logs
           (user_id, cycle_id, date, flow_intensity, temperature,
            cervical_mucus, sexual_activity, contraception_used, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [userId, targetCycleId, date, flowIntensity, temperature,
         cervicalMucus, sexualActivity, contraceptionUsed, encryptedNotes]
      );
    }

    return this.formatCycleLog(result.rows[0]);
  }

  /**
   * Get current cycle status
   */
  async getCurrentCycle(userId) {
    const result = await pool.query(
      'SELECT * FROM cycles WHERE user_id = $1 ORDER BY start_date DESC LIMIT 1',
      [userId]
    );
    const cycle = result.rows[0];

    if (!cycle) return null;

    // UTC date math to avoid timezone drift
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startDate = new Date(cycle.start_date);
    startDate.setUTCHours(0, 0, 0, 0);

    // Prefer user-saved cycle_profiles settings over computed health_profiles averages
    const [cpResult, hpResult] = await Promise.all([
      pool.query(
        'SELECT cycle_length, period_length, luteal_phase_length FROM cycle_profiles WHERE user_id = $1',
        [userId]
      ),
      pool.query(
        'SELECT average_cycle_length, average_period_length FROM health_profiles WHERE user_id = $1',
        [userId]
      ),
    ]);
    const cp = cpResult.rows[0];
    const hp = hpResult.rows[0];

    const cycleLength    = cp?.cycle_length    || hp?.average_cycle_length    || CYCLE_DEFAULTS.AVERAGE_CYCLE_LENGTH;
    const periodLength   = cp?.period_length   || hp?.average_period_length   || CYCLE_DEFAULTS.AVERAGE_PERIOD_LENGTH;
    const lutealLength   = cp?.luteal_phase_length ?? 14;
    const ovulationDay   = cycleLength - lutealLength;

    // Use modulo so dayOfCycle stays within [1, cycleLength] across multiple cycles
    const daysSinceStart = Math.floor((today - startDate) / 86_400_000);
    const cyclesPassed   = Math.floor(daysSinceStart / cycleLength);
    const dayOfCycle     = (daysSinceStart % cycleLength) + 1;

    const phase       = this.calculatePhase(dayOfCycle, cycleLength, periodLength, ovulationDay);
    const predictions = this.calculatePredictions(startDate, cycleLength, periodLength, cyclesPassed, today);

    const addDays = (base, n) => {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().split('T')[0];
    };

    // Current cycle started at: startDate + cyclesPassed * cycleLength
    const currentCycleStart = new Date(startDate);
    currentCycleStart.setUTCDate(currentCycleStart.getUTCDate() + cyclesPassed * cycleLength);

    // period_dates: current cycle start through + periodLength - 1
    const period_dates = Array.from({ length: periodLength }, (_, i) => addDays(currentCycleStart, i));

    // ovulation_date and fertility_window relative to current cycle start
    const ovulation_date    = addDays(currentCycleStart, ovulationDay - 1);
    const fertility_window  = Array.from({ length: 5 }, (_, i) =>
      addDays(currentCycleStart, ovulationDay - 6 + i)
    );

    // pregnancy_chance based on position in current cycle
    let pregnancy_chance;
    if (dayOfCycle >= ovulationDay - 5 && dayOfCycle <= ovulationDay + 1) {
      pregnancy_chance = 'High';
    } else if (dayOfCycle >= ovulationDay - 7 && dayOfCycle <= ovulationDay + 3) {
      pregnancy_chance = 'Medium';
    } else {
      pregnancy_chance = 'Low';
    }

    return {
      ...this.formatCycle(cycle),
      dayOfCycle,
      cycleLength,
      periodLength,
      ovulationDay,
      phase,
      predictions,
      period_dates,
      fertility_window,
      ovulation_date,
      pregnancy_chance,
    };
  }

  /**
   * Get cycle history
   */
  async getCycles(userId, { page = 1, limit = 20, startDate, endDate }) {
    const offset = (page - 1) * limit;
    const conditions = ['user_id = $1'];
    const values = [userId];

    if (startDate) {
      values.push(startDate);
      conditions.push(`start_date >= $${values.length}`);
    }
    if (endDate) {
      values.push(endDate);
      conditions.push(`start_date <= $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM cycles ${whereClause}`,
      values
    );

    const dataValues = [...values, limit, offset];
    const result = await pool.query(
      `SELECT * FROM cycles ${whereClause}
       ORDER BY start_date DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    );

    return {
      cycles: result.rows.map(c => this.formatCycle(c)),
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count)
      }
    };
  }

  /**
   * Get cycle by ID
   */
  async getCycleById(userId, cycleId) {
    const result = await pool.query(
      'SELECT * FROM cycles WHERE id = $1 AND user_id = $2',
      [cycleId, userId]
    );
    const cycle = result.rows[0];

    if (!cycle) {
      const err = new Error('Cycle not found');
      err.statusCode = 404;
      throw err;
    }

    const logsResult = await pool.query(
      'SELECT * FROM cycle_logs WHERE cycle_id = $1 ORDER BY date ASC',
      [cycleId]
    );

    return {
      ...this.formatCycle(cycle),
      logs: logsResult.rows.map(l => this.formatCycleLog(l))
    };
  }

  /**
   * Update cycle
   */
  async updateCycle(userId, cycleId, updates) {
    const allowedFields = ['start_date', 'end_date', 'period_end_date', 'notes'];
    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        if (snakeKey === 'notes') {
          values.push(value ? Encryption.encrypt(value) : null);
        } else {
          values.push(value);
        }
        setClauses.push(`${snakeKey} = $${values.length}`);
      }
    }

    if (setClauses.length === 0) {
      return this.getCycleById(userId, cycleId);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(cycleId, userId);

    const result = await pool.query(
      `UPDATE cycles SET ${setClauses.join(', ')}
       WHERE id = $${values.length - 1} AND user_id = $${values.length}
       RETURNING *`,
      values
    );

    await this.updateAverages(userId);
    return this.formatCycle(result.rows[0]);
  }

  /**
   * Delete cycle
   */
  async deleteCycle(userId, cycleId) {
    await pool.query('DELETE FROM cycle_logs WHERE cycle_id = $1', [cycleId]);

    await pool.query(
      'DELETE FROM cycles WHERE id = $1 AND user_id = $2',
      [cycleId, userId]
    );

    await this.updateAverages(userId);

    logger.info('Cycle deleted', { userId, cycleId });
    return { message: 'Cycle deleted successfully' };
  }

  /**
   * Get daily log for a specific date
   */
  async getDailyLog(userId, date) {
    const result = await pool.query(
      'SELECT * FROM cycle_logs WHERE user_id = $1 AND date = $2',
      [userId, date]
    );
    const log = result.rows[0];

    if (!log) return null;
    return this.formatCycleLog(log);
  }

  /**
   * Get analytics/insights
   */
  async getAnalytics(userId, { startDate, endDate }) {
    const result = await pool.query(
      `SELECT * FROM cycles
       WHERE user_id = $1 AND start_date >= $2 AND start_date <= $3
       ORDER BY start_date ASC`,
      [userId, startDate, endDate]
    );
    const cycles = result.rows;

    if (!cycles || cycles.length === 0) {
      return {
        totalCycles: 0,
        averageCycleLength: null,
        averagePeriodLength: null,
        shortestCycle: null,
        longestCycle: null,
        cycles: []
      };
    }

    const cycleLengths = [];
    const periodLengths = [];

    for (let i = 0; i < cycles.length - 1; i++) {
      const start = new Date(cycles[i].start_date);
      const nextStart = new Date(cycles[i + 1].start_date);
      const length = Math.ceil((nextStart - start) / (1000 * 60 * 60 * 24));
      if (length >= CYCLE_DEFAULTS.MIN_CYCLE_LENGTH && length <= CYCLE_DEFAULTS.MAX_CYCLE_LENGTH) {
        cycleLengths.push(length);
      }
    }

    for (const cycle of cycles) {
      if (cycle.period_length) {
        periodLengths.push(cycle.period_length);
      }
    }

    const avgCycleLength = cycleLengths.length > 0
      ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
      : null;

    const avgPeriodLength = periodLengths.length > 0
      ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)
      : null;

    return {
      totalCycles: cycles.length,
      averageCycleLength: avgCycleLength,
      averagePeriodLength: avgPeriodLength,
      shortestCycle: cycleLengths.length > 0 ? Math.min(...cycleLengths) : null,
      longestCycle: cycleLengths.length > 0 ? Math.max(...cycleLengths) : null,
      cycleVariability: this.calculateVariability(cycleLengths),
      cycles: cycles.map(c => this.formatCycle(c))
    };
  }

  /**
   * Calculate current cycle phase
   */
  // ovulationDay = cycle_length - luteal_phase_length (passed in, not re-derived here)
  calculatePhase(dayOfCycle, cycleLength, periodLength, ovulationDay) {
    // Derive ovulationDay from cycleLength if not supplied (fallback for callers that
    // don't yet pass it — default 14-day luteal phase)
    const ovDay = ovulationDay ?? (cycleLength - 14);

    if (dayOfCycle <= periodLength) {
      return { name: CYCLE_PHASES.MENSTRUAL,  day: dayOfCycle, description: 'Menstrual phase - Period days' };
    }
    if (dayOfCycle <= ovDay - 2) {
      return { name: CYCLE_PHASES.FOLLICULAR, day: dayOfCycle, description: 'Follicular phase - Building up to ovulation' };
    }
    if (dayOfCycle <= ovDay + 2) {
      return { name: CYCLE_PHASES.OVULATION,  day: dayOfCycle, description: 'Ovulation phase - Most fertile window', isFertile: true };
    }
    return { name: CYCLE_PHASES.LUTEAL, day: dayOfCycle, description: 'Luteal phase - Post-ovulation' };
  }

  /**
   * Calculate predictions for next period/ovulation.
   * startDate and today are pre-normalised Date objects (UTC midnight).
   * cyclesPassed is how many full cycles have elapsed since startDate.
   */
  calculatePredictions(startDate, avgCycleLength, avgPeriodLength, cyclesPassed, today) {
    const addDays = (base, n) => {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + n);
      return d;
    };

    // Next period starts at beginning of next cycle
    const nextPeriodDate    = addDays(startDate, (cyclesPassed + 1) * avgCycleLength);
    const nextPeriodEndDate = addDays(nextPeriodDate, avgPeriodLength - 1);
    const daysUntilPeriod   = Math.round((nextPeriodDate - today) / 86_400_000);

    // Ovulation for the NEXT cycle = next period start - 14 days
    const ovulationDate      = addDays(nextPeriodDate, -14);
    const daysUntilOvulation = Math.round((ovulationDate - today) / 86_400_000);

    const fertileStart = addDays(ovulationDate, -5);
    const fertileEnd   = addDays(ovulationDate, 1);

    const fmt = d => d.toISOString().split('T')[0];

    return {
      nextPeriod: {
        date:     fmt(nextPeriodDate),
        endDate:  fmt(nextPeriodEndDate),
        daysUntil: daysUntilPeriod,
      },
      ovulation: {
        date:     fmt(ovulationDate),
        daysUntil: daysUntilOvulation,
      },
      fertileWindow: {
        start: fmt(fertileStart),
        end:   fmt(fertileEnd),
      },
    };
  }

  /**
   * Return phase date ranges for the current cycle (for the wheel segments).
   */
  async getPhases(userId) {
    const current = await this.getCurrentCycle(userId);
    if (!current) return null;

    const { cycleLength, periodLength, ovulationDay, dayOfCycle } = current;

    // Rebuild current cycle start from the last recorded cycle + cyclesPassed
    const lastCycle = await pool.query(
      'SELECT start_date FROM cycles WHERE user_id = $1 ORDER BY start_date DESC LIMIT 1',
      [userId]
    );
    const startDate = new Date(lastCycle.rows[0].start_date);
    startDate.setUTCHours(0, 0, 0, 0);
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const daysSince   = Math.floor((today - startDate) / 86_400_000);
    const cyclesPassed = Math.floor(daysSince / cycleLength);

    const cycleStart = new Date(startDate);
    cycleStart.setUTCDate(cycleStart.getUTCDate() + cyclesPassed * cycleLength);

    const addDays = (n) => {
      const d = new Date(cycleStart);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().split('T')[0];
    };

    return {
      current_day: dayOfCycle,
      cycle_start: cycleStart.toISOString().split('T')[0],
      phases: {
        menstrual:  { start: addDays(0),             end: addDays(periodLength - 1),  days: periodLength },
        follicular: { start: addDays(periodLength),   end: addDays(ovulationDay - 3),  days: ovulationDay - 2 - periodLength },
        ovulation:  { start: addDays(ovulationDay - 2), end: addDays(ovulationDay + 2), days: 5 },
        luteal:     { start: addDays(ovulationDay + 3), end: addDays(cycleLength - 1),  days: cycleLength - ovulationDay - 3 },
      },
    };
  }

  /**
   * Return upcoming period + ovulation predictions for N months.
   */
  async getForecast(userId, months = 3) {
    const lastCycle = await pool.query(
      'SELECT start_date FROM cycles WHERE user_id = $1 ORDER BY start_date DESC LIMIT 1',
      [userId]
    );
    if (!lastCycle.rows[0]) return null;

    const [cpResult, hpResult] = await Promise.all([
      pool.query('SELECT cycle_length, period_length, luteal_phase_length FROM cycle_profiles WHERE user_id = $1', [userId]),
      pool.query('SELECT average_cycle_length, average_period_length FROM health_profiles WHERE user_id = $1', [userId]),
    ]);
    const cp = cpResult.rows[0];
    const hp = hpResult.rows[0];
    const cycleLength  = cp?.cycle_length  || hp?.average_cycle_length  || CYCLE_DEFAULTS.AVERAGE_CYCLE_LENGTH;
    const periodLength = cp?.period_length || hp?.average_period_length || CYCLE_DEFAULTS.AVERAGE_PERIOD_LENGTH;
    const lutealLength = cp?.luteal_phase_length ?? 14;

    const startDate = new Date(lastCycle.rows[0].start_date);
    startDate.setUTCHours(0, 0, 0, 0);
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const daysSince    = Math.floor((today - startDate) / 86_400_000);
    const cyclesPassed = Math.floor(daysSince / cycleLength);

    const addDays = (base, n) => {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().split('T')[0];
    };

    const cutoff = new Date(today);
    cutoff.setUTCMonth(cutoff.getUTCMonth() + months);

    const periods = [];
    const ovulations = [];

    for (let i = cyclesPassed + 1; ; i++) {
      const periodStart = new Date(startDate);
      periodStart.setUTCDate(periodStart.getUTCDate() + i * cycleLength);
      if (periodStart > cutoff) break;

      const fmt = d => (d instanceof Date ? d : new Date(d)).toISOString().split('T')[0];
      const periodEnd  = new Date(periodStart); periodEnd.setUTCDate(periodEnd.getUTCDate() + periodLength - 1);
      const ovulation  = new Date(periodStart); ovulation.setUTCDate(ovulation.getUTCDate() - lutealLength);
      const fertStart  = new Date(ovulation);   fertStart.setUTCDate(fertStart.getUTCDate() - 5);
      const fertEnd    = new Date(ovulation);   fertEnd.setUTCDate(fertEnd.getUTCDate() + 1);

      periods.push({ start: fmt(periodStart), end: fmt(periodEnd) });
      ovulations.push({ date: fmt(ovulation), fertile_start: fmt(fertStart), fertile_end: fmt(fertEnd) });
    }

    return { cycle_length: cycleLength, period_length: periodLength, periods, ovulations };
  }

  /**
   * Update user's average cycle/period length
   */
  async updateAverages(userId) {
    const result = await pool.query(
      `SELECT start_date, period_length FROM cycles
       WHERE user_id = $1
       ORDER BY start_date ASC LIMIT 12`,
      [userId]
    );
    const cycles = result.rows;

    if (!cycles || cycles.length < 2) return;

    const cycleLengths = [];
    for (let i = 0; i < cycles.length - 1; i++) {
      const start = new Date(cycles[i].start_date);
      const nextStart = new Date(cycles[i + 1].start_date);
      const length = Math.ceil((nextStart - start) / (1000 * 60 * 60 * 24));
      if (length >= CYCLE_DEFAULTS.MIN_CYCLE_LENGTH && length <= CYCLE_DEFAULTS.MAX_CYCLE_LENGTH) {
        cycleLengths.push(length);
      }
    }

    const periodLengths = cycles.filter(c => c.period_length).map(c => c.period_length);

    const setClauses = [];
    const values = [];

    if (cycleLengths.length > 0) {
      const avg = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length);
      values.push(avg);
      setClauses.push(`average_cycle_length = $${values.length}`);
    }
    if (periodLengths.length > 0) {
      const avg = Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length);
      values.push(avg);
      setClauses.push(`average_period_length = $${values.length}`);
    }

    if (setClauses.length > 0) {
      values.push(userId);
      await pool.query(
        `UPDATE health_profiles SET ${setClauses.join(', ')} WHERE user_id = $${values.length}`,
        values
      );
    }
  }

  /**
   * Calculate cycle variability
   */
  calculateVariability(lengths) {
    if (lengths.length < 2) return null;

    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const squaredDiffs = lengths.map(l => Math.pow(l - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / lengths.length;

    return Math.round(Math.sqrt(avgSquaredDiff) * 10) / 10;
  }

  /**
   * Format cycle for response
   */
  formatCycle(cycle) {
    return {
      id: cycle.id,
      startDate: cycle.start_date,
      endDate: cycle.end_date,
      periodEndDate: cycle.period_end_date,
      periodLength: cycle.period_length,
      cycleLength: cycle.cycle_length,
      notes: cycle.notes ? Encryption.decrypt(cycle.notes) : null,
      createdAt: cycle.created_at,
      updatedAt: cycle.updated_at
    };
  }

  /**
   * Format cycle log for response
   */
  formatCycleLog(log) {
    return {
      id: log.id,
      date: log.date,
      flowIntensity: log.flow_intensity,
      temperature: log.temperature,
      cervicalMucus: log.cervical_mucus,
      sexualActivity: log.sexual_activity,
      contraceptionUsed: log.contraception_used,
      notes: log.notes ? Encryption.decrypt(log.notes) : null,
      createdAt: log.created_at
    };
  }
}

module.exports = new CycleService();
