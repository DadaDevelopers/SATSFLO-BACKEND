'use strict';

const { supabaseAdmin } = require('../config/supabase');

const TABLE = 'day_logs';

class DayLogsService {
  /**
   * Get a single day log. Returns null if not found.
   */
  async getByDate(userId, date) {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', date)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Upsert a day log (create or update).
   */
  async upsert(userId, date, fields) {
    const payload = {
      user_id: userId,
      log_date: date,
      ...fields,
    };

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .upsert(payload, { onConflict: 'user_id,log_date', returning: 'representation' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get all logs in a date range (inclusive).
   */
  async getRange(userId, from, to) {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .gte('log_date', from)
      .lte('log_date', to)
      .order('log_date', { ascending: true });

    if (error) throw error;
    return data;
  }
}

module.exports = new DayLogsService();
