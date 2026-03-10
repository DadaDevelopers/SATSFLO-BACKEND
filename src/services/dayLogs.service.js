'use strict';

const { pool } = require('../config/database');

const TABLE = 'day_logs';

class DayLogsService {
  /**
   * Get a single day log. Returns null if not found.
   */
  async getByDate(userId, date) {
    const result = await pool.query(
      `SELECT * FROM ${TABLE} WHERE user_id = $1 AND log_date = $2`,
      [userId, date]
    );
    return result.rows[0] || null;
  }

  /**
   * Upsert a day log (create or update).
   */
  async upsert(userId, date, fields) {
    const allFields = { user_id: userId, log_date: date, ...fields };
    const keys = Object.keys(allFields);
    const values = Object.values(allFields);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const cols = keys.join(', ');
    const updates = keys
      .filter(k => k !== 'user_id' && k !== 'log_date')
      .map(k => `${k} = EXCLUDED.${k}`)
      .join(', ');

    const result = await pool.query(
      `INSERT INTO ${TABLE} (${cols}) VALUES (${placeholders})
       ON CONFLICT (user_id, log_date) DO UPDATE SET ${updates}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Get all logs in a date range (inclusive).
   */
  async getRange(userId, from, to) {
    const result = await pool.query(
      `SELECT * FROM ${TABLE}
       WHERE user_id = $1 AND log_date >= $2 AND log_date <= $3
       ORDER BY log_date ASC`,
      [userId, from, to]
    );
    return result.rows;
  }
}

module.exports = new DayLogsService();
