'use strict';

const { pool } = require('../config/database');

const TABLE = 'journal_entries';

class JournalService {
  /**
   * Fetch cycle_profiles + day_logs symptoms for a date range, return helpers.
   */
  async _cycleContext(userId, startDate, endDate) {
    const [cpResult, logsResult] = await Promise.all([
      pool.query(
        'SELECT last_period_start, cycle_length FROM cycle_profiles WHERE user_id = $1',
        [userId]
      ),
      pool.query(
        'SELECT date, symptoms FROM day_logs WHERE user_id = $1 AND date >= $2 AND date <= $3',
        [userId, startDate, endDate]
      ),
    ]);

    const cp = cpResult.rows[0];
    const cycleLength = cp?.cycle_length || 28;
    const lastPeriodStart = cp?.last_period_start ?? null;

    const symptomsMap = {};
    for (const row of logsResult.rows) {
      const key = row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : String(row.date);
      symptomsMap[key] = Array.isArray(row.symptoms) ? row.symptoms : (row.symptoms ? [row.symptoms] : []);
    }

    const toCycleDay = (entryDate) => {
      if (!lastPeriodStart) return null;
      const ed = new Date(entryDate); ed.setUTCHours(0, 0, 0, 0);
      const ps = new Date(lastPeriodStart); ps.setUTCHours(0, 0, 0, 0);
      const diff = Math.floor((ed - ps) / 86_400_000);
      return diff >= 0 ? (diff % cycleLength) + 1 : null;
    };

    return { symptomsMap, toCycleDay };
  }

  _annotate(entry, symptomsMap, toCycleDay) {
    const key = entry.entry_date instanceof Date
      ? entry.entry_date.toISOString().split('T')[0]
      : String(entry.entry_date);
    return {
      ...entry,
      cycle_day: toCycleDay(entry.entry_date),
      symptoms:  symptomsMap[key] ?? [],
    };
  }

  /**
   * Return all journal entries for a given month (YYYY-MM).
   */
  async getByMonth(userId, month) {
    const start = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const nextMonth =
      mon === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
    // end date for day_logs query (last day of month)
    const endDate = new Date(nextMonth);
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    const endStr = endDate.toISOString().split('T')[0];

    const [entriesResult, { symptomsMap, toCycleDay }] = await Promise.all([
      pool.query(
        `SELECT * FROM ${TABLE}
         WHERE user_id = $1 AND entry_date >= $2 AND entry_date < $3
         ORDER BY entry_date DESC`,
        [userId, start, nextMonth]
      ),
      this._cycleContext(userId, start, endStr),
    ]);

    return entriesResult.rows.map(e => this._annotate(e, symptomsMap, toCycleDay));
  }

  /**
   * Get a single journal entry by ID.
   */
  async getById(userId, entryId) {
    const result = await pool.query(
      `SELECT * FROM ${TABLE} WHERE id = $1 AND user_id = $2`,
      [entryId, userId]
    );
    if (!result.rows[0]) {
      const err = new Error('Journal entry not found'); err.statusCode = 404; throw err;
    }
    const entry = result.rows[0];
    const dateStr = entry.entry_date instanceof Date
      ? entry.entry_date.toISOString().split('T')[0]
      : String(entry.entry_date);
    const { symptomsMap, toCycleDay } = await this._cycleContext(userId, dateStr, dateStr);
    return this._annotate(entry, symptomsMap, toCycleDay);
  }

  /**
   * Create a new journal entry.
   */
  async create(userId, { entry_date, content, title, mood }) {
    const result = await pool.query(
      `INSERT INTO ${TABLE} (user_id, entry_date, content, title, mood)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, entry_date, content, title ?? null, mood ?? null]
    );

    return result.rows[0];
  }

  async update(userId, entryId, { content, title, mood, entry_date }) {
    const setClauses = ['updated_at = NOW()'];
    const values = [entryId, userId];

    if (content !== undefined)    { values.push(content);    setClauses.push(`content = $${values.length}`); }
    if (title !== undefined)      { values.push(title);      setClauses.push(`title = $${values.length}`); }
    if (mood !== undefined)       { values.push(mood);       setClauses.push(`mood = $${values.length}`); }
    if (entry_date !== undefined) { values.push(entry_date); setClauses.push(`entry_date = $${values.length}`); }

    const result = await pool.query(
      `UPDATE ${TABLE} SET ${setClauses.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      values
    );
    if (!result.rows[0]) {
      const err = new Error('Journal entry not found'); err.statusCode = 404; throw err;
    }
    return result.rows[0];
  }

  async delete(userId, entryId) {
    const result = await pool.query(
      `DELETE FROM ${TABLE} WHERE id = $1 AND user_id = $2 RETURNING id`,
      [entryId, userId]
    );
    if (!result.rows[0]) {
      const err = new Error('Journal entry not found'); err.statusCode = 404; throw err;
    }
  }
}

module.exports = new JournalService();
