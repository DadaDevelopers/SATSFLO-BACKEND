'use strict';

const { pool } = require('../config/database');

const TABLE = 'journal_entries';

class JournalService {
  // ── Cycle-day helper ────────────────────────────────────────────────────────

  async _cycleDay(userId, entryDate) {
    const cp = await pool.query(
      'SELECT last_period_start, cycle_length FROM cycle_profiles WHERE user_id = $1',
      [userId]
    );
    const profile = cp.rows[0];
    if (!profile?.last_period_start) return null;

    const cycleLength = profile.cycle_length || 28;
    const ed = new Date(entryDate);
    ed.setUTCHours(0, 0, 0, 0);
    const ps = new Date(profile.last_period_start);
    ps.setUTCHours(0, 0, 0, 0);
    const diff = Math.floor((ed - ps) / 86_400_000);
    return diff >= 0 ? (diff % cycleLength) + 1 : null;
  }

  async _cycleDayMap(userId) {
    const cp = await pool.query(
      'SELECT last_period_start, cycle_length FROM cycle_profiles WHERE user_id = $1',
      [userId]
    );
    const profile = cp.rows[0];
    if (!profile?.last_period_start) return () => null;

    const cycleLength = profile.cycle_length || 28;
    const ps = new Date(profile.last_period_start);
    ps.setUTCHours(0, 0, 0, 0);

    return (entryDate) => {
      const ed = new Date(entryDate);
      ed.setUTCHours(0, 0, 0, 0);
      const diff = Math.floor((ed - ps) / 86_400_000);
      return diff >= 0 ? (diff % cycleLength) + 1 : null;
    };
  }

  // ── Format a DB row into the frontend shape ─────────────────────────────────

  _format(entry, cycleDay = null) {
    const dateStr =
      entry.entry_date instanceof Date
        ? entry.entry_date.toISOString().split('T')[0]
        : String(entry.entry_date);

    return {
      id: entry.id,
      date: dateStr,
      title: entry.title ?? null,
      content: entry.content ?? null,
      mood: entry.mood ?? null,
      symptoms: entry.symptoms ?? [],
      images: entry.images ?? [],
      cycle_day: cycleDay,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  }

  // ── List for a month ────────────────────────────────────────────────────────

  async getByMonth(userId, month) {
    const start = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const nextMonth =
      mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    const [entriesResult, toCycleDay] = await Promise.all([
      pool.query(
        `SELECT * FROM ${TABLE}
         WHERE user_id = $1 AND entry_date >= $2 AND entry_date < $3
         ORDER BY entry_date DESC`,
        [userId, start, nextMonth]
      ),
      this._cycleDayMap(userId),
    ]);

    return entriesResult.rows.map((e) => this._format(e, toCycleDay(e.entry_date)));
  }

  // ── Search within a month ───────────────────────────────────────────────────

  async search(userId, { q, month }) {
    const conditions = ['user_id = $1', '(title ILIKE $2 OR content ILIKE $2)'];
    const values = [userId, `%${q}%`];

    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const start = `${month}-01`;
      const nextMonth =
        mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
      values.push(start, nextMonth);
      conditions.push(`entry_date >= $${values.length - 1}`);
      conditions.push(`entry_date < $${values.length}`);
    }

    const result = await pool.query(
      `SELECT * FROM ${TABLE} WHERE ${conditions.join(' AND ')} ORDER BY entry_date DESC LIMIT 50`,
      values
    );

    const toCycleDay = await this._cycleDayMap(userId);
    return result.rows.map((e) => this._format(e, toCycleDay(e.entry_date)));
  }

  // ── Single entry ────────────────────────────────────────────────────────────

  async getById(userId, entryId) {
    const result = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1 AND user_id = $2`, [
      entryId,
      userId,
    ]);
    if (!result.rows[0]) {
      const err = new Error('Journal entry not found');
      err.statusCode = 404;
      throw err;
    }
    const entry = result.rows[0];
    const cycleDay = await this._cycleDay(userId, entry.entry_date);
    return this._format(entry, cycleDay);
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(userId, { entry_date, content, title, mood, symptoms, images }) {
    const result = await pool.query(
      `INSERT INTO ${TABLE}
         (user_id, entry_date, content, title, mood, symptoms, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, entry_date, content ?? '', title ?? null, mood ?? null, symptoms ?? [], images ?? []]
    );
    const entry = result.rows[0];
    const cycleDay = await this._cycleDay(userId, entry.entry_date);
    return this._format(entry, cycleDay);
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async update(userId, entryId, updates) {
    const setClauses = ['updated_at = NOW()'];
    const values = [entryId, userId];

    const fields = ['content', 'title', 'mood', 'entry_date', 'symptoms', 'images'];
    for (const field of fields) {
      if (updates[field] !== undefined) {
        values.push(updates[field]);
        setClauses.push(`${field} = $${values.length}`);
      }
    }

    const result = await pool.query(
      `UPDATE ${TABLE} SET ${setClauses.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      values
    );
    if (!result.rows[0]) {
      const err = new Error('Journal entry not found');
      err.statusCode = 404;
      throw err;
    }
    const entry = result.rows[0];
    const cycleDay = await this._cycleDay(userId, entry.entry_date);
    return this._format(entry, cycleDay);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async delete(userId, entryId) {
    const result = await pool.query(
      `DELETE FROM ${TABLE} WHERE id = $1 AND user_id = $2 RETURNING id`,
      [entryId, userId]
    );
    if (!result.rows[0]) {
      const err = new Error('Journal entry not found');
      err.statusCode = 404;
      throw err;
    }
  }

  async deleteAll(userId) {
    const result = await pool.query(`DELETE FROM ${TABLE} WHERE user_id = $1`, [userId]);
    return result.rowCount;
  }
}

module.exports = new JournalService();
