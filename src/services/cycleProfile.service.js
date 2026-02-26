'use strict';

const { supabaseAdmin } = require('../config/supabase');

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

    // current_day is 1-indexed (day 1 = start of period)
    const currentDay = (daysSince % profile.cycle_length) + 1;
    const daysUntilPeriod = profile.cycle_length - currentDay + 1;

    // Ovulation typically 14 days before next period
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
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .upsert(
        { user_id: userId, cycle_length, period_length, last_period_start },
        { onConflict: 'user_id', returning: 'representation' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Retrieve cycle profile with live calculations.
   */
  async getWithCalculations(userId) {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const { currentDay, daysUntilPeriod, phase } = CycleProfileService._calculate(data);

    return {
      ...data,
      current_day: currentDay,
      days_until_period: daysUntilPeriod,
      current_phase: phase,
    };
  }
}

module.exports = new CycleProfileService();
