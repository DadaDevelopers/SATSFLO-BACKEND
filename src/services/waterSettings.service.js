'use strict';

const { pool } = require('../config/database');

const TABLE = 'water_settings';

const DEFAULTS = {
  water_target: 2000,
  cup_capacity: 250,
  cup_style: 'standard'
};

class WaterSettingsService {
  /**
   * Fetch water settings; returns defaults when none exist yet.
   */
  async get(userId) {
    const result = await pool.query(
      `SELECT * FROM ${TABLE} WHERE user_id = $1`,
      [userId]
    );

    if (!result.rows[0]) {
      return { user_id: userId, ...DEFAULTS };
    }
    return result.rows[0];
  }

  /**
   * Create or update water settings for the user.
   */
  async upsert(userId, fields) {
    const allFields = { user_id: userId, ...fields };
    const keys = Object.keys(allFields);
    const values = Object.values(allFields);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const cols = keys.join(', ');
    const updates = keys
      .filter(k => k !== 'user_id')
      .map(k => `${k} = EXCLUDED.${k}`)
      .join(', ');

    const result = await pool.query(
      `INSERT INTO ${TABLE} (${cols}) VALUES (${placeholders})
       ON CONFLICT (user_id) DO UPDATE SET ${updates}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }
}

module.exports = new WaterSettingsService();
