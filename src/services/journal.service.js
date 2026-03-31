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
    return result.rows[0];
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
