'use strict';

const { pool } = require('../config/database');

const TABLE = 'cycle_profiles';

class CycleProfileService {
  /**
   * Calculate phase, current day, and days until period from profile data.
   */
  static _calculate(profile) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const lastPeriod = new Date(profile.last_period_start);
    lastPeriod.setUTCHours(0, 0, 0, 0);

    const msPerDay = 86_400_000;
    const daysSince = Math.max(0, Math.floor((today - lastPeriod) / msPerDay));

    const cycleLength = profile.cycle_length;
    const currentDay = (daysSince % cycleLength) + 1;
    const daysUntilPeriod = cycleLength - currentDay + 1;

    // ovulation is typically cycle_length - 14 days from start
    const ovulationDay = cycleLength - 14;
    const daysUntilOvulation = ovulationDay >= currentDay
      ? ovulationDay - currentDay
      : cycleLength - currentDay + ovulationDay;

    let phase;
    if (currentDay <= profile.period_length) {
      phase = 'menstrual';
    } else if (currentDay < ovulationDay - 1) {
      phase = 'follicular';
    } else if (currentDay <= ovulationDay + 1) {
      phase = 'ovulation';
    } else {
      phase = 'luteal';
    }

    return { currentDay, daysUntilPeriod, daysUntilOvulation, ovulationDay, phase };
  }

  /**
   * Create or replace a cycle profile for the authenticated user.
   */
  async upsert(userId, { cycle_length, period_length, last_period_start, luteal_phase_length, ignore_irregular_cycle }) {
    const result = await pool.query(
      `INSERT INTO ${TABLE} (user_id, cycle_length, period_length, last_period_start, luteal_phase_length, ignore_irregular_cycle)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         cycle_length            = EXCLUDED.cycle_length,
         period_length           = EXCLUDED.period_length,
         last_period_start       = EXCLUDED.last_period_start,
         luteal_phase_length     = EXCLUDED.luteal_phase_length,
         ignore_irregular_cycle  = EXCLUDED.ignore_irregular_cycle,
         updated_at              = NOW()
       RETURNING *`,
      [userId, cycle_length, period_length, last_period_start,
       luteal_phase_length ?? 14, ignore_irregular_cycle ?? false]
    );

    return result.rows[0];
  }

  /**
   * Partial update — only update fields that are provided.
   */
  async patch(userId, updates) {
    const allowed = ['cycle_length', 'period_length', 'last_period_start', 'luteal_phase_length', 'ignore_irregular_cycle'];
    const setClauses = ['updated_at = NOW()'];
    const values = [userId];

    for (const field of allowed) {
      if (updates[field] !== undefined) {
        values.push(updates[field]);
        setClauses.push(`${field} = $${values.length}`);
      }
    }

    const result = await pool.query(
      `UPDATE ${TABLE} SET ${setClauses.join(', ')} WHERE user_id = $1 RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Retrieve cycle profile with live calculations.
   */
  async getWithCalculations(userId) {
    const result = await pool.query(
      `SELECT * FROM ${TABLE} WHERE user_id = $1`,
      [userId]
    );
    const data = result.rows[0];

    if (!data) return null;

    const { currentDay, daysUntilPeriod, daysUntilOvulation, ovulationDay, phase } = CycleProfileService._calculate(data);

    return {
      ...data,
      current_day: currentDay,
      days_until_period: daysUntilPeriod,
      days_until_ovulation: daysUntilOvulation,
      ovulation_day: ovulationDay,
      current_phase: phase
    };
  }
}

module.exports = new CycleProfileService();
