'use strict';

const { pool } = require('../config/database');

const TABLE = 'cycle_profiles';

class CycleProfileService {
  /**
   * Calculate phase, current day, and days until period from profile data.
   */
  static _calculate(profile) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastPeriod = new Date(profile.last_period_start);
    lastPeriod.setHours(0, 0, 0, 0);

    const msPerDay = 86_400_000;
    const daysSince = Math.floor((today - lastPeriod) / msPerDay);

    const currentDay = (daysSince % profile.cycle_length) + 1;
    const daysUntilPeriod = profile.cycle_length - currentDay + 1;

    const ovulationDay = profile.cycle_length - 14;

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

    return { currentDay, daysUntilPeriod, phase };
  }

  /**
   * Create or replace a cycle profile for the authenticated user.
   */
  async upsert(userId, { cycle_length, period_length, last_period_start }) {
    const result = await pool.query(
      `INSERT INTO ${TABLE} (user_id, cycle_length, period_length, last_period_start)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         cycle_length       = EXCLUDED.cycle_length,
         period_length      = EXCLUDED.period_length,
         last_period_start  = EXCLUDED.last_period_start
       RETURNING *`,
      [userId, cycle_length, period_length, last_period_start]
    );

    return result.rows[0];
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

    const { currentDay, daysUntilPeriod, phase } = CycleProfileService._calculate(data);

    return {
      ...data,
      current_day: currentDay,
      days_until_period: daysUntilPeriod,
      current_phase: phase
    };
  }
}

module.exports = new CycleProfileService();
