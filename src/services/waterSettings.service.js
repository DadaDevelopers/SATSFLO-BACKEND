'use strict';

const { supabaseAdmin } = require('../config/supabase');

const TABLE = 'water_settings';

const DEFAULTS = {
  water_target: 2000,
  cup_capacity: 250,
  cup_style: 'standard',
};

class WaterSettingsService {
  /**
   * Fetch water settings; returns defaults when none exist yet.
   */
  async get(userId) {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return { user_id: userId, ...DEFAULTS };
    }
    return data;
  }

  /**
   * Create or update water settings for the user.
   */
  async upsert(userId, fields) {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .upsert(
        { user_id: userId, ...fields },
        { onConflict: 'user_id', returning: 'representation' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new WaterSettingsService();
