'use strict';

const { pool } = require('../config/database');

const TABLE = 'journal_entries';

class JournalService {
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

    const result = await pool.query(
      `SELECT * FROM ${TABLE}
       WHERE user_id = $1 AND entry_date >= $2 AND entry_date < $3
       ORDER BY entry_date DESC`,
      [userId, start, nextMonth]
    );

    return result.rows;
  }

  /**
   * Create a new journal entry.
   */
  async create(userId, { entry_date, content }) {
    const result = await pool.query(
      `INSERT INTO ${TABLE} (user_id, entry_date, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, entry_date, content]
    );

    return result.rows[0];
  }
}

module.exports = new JournalService();
