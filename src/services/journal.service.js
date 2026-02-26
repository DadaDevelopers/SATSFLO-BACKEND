'use strict';

const { supabaseAdmin } = require('../config/supabase');

const TABLE = 'journal_entries';

class JournalService {
  /**
   * Return all journal entries for a given month (YYYY-MM).
   */
  async getByMonth(userId, month) {
    // month format: YYYY-MM  →  range [YYYY-MM-01, YYYY-MM-last]
    const start = `${month}-01`;
    // End of month: next month minus 1 day via DB range with lte on the last possible date
    const [year, mon] = month.split('-').map(Number);
    const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .gte('entry_date', start)
      .lt('entry_date', nextMonth)
      .order('entry_date', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Create a new journal entry.
   */
  async create(userId, { entry_date, content }) {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .insert({ user_id: userId, entry_date, content })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new JournalService();
