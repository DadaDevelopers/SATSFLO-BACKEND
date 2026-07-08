/**
 * User Service
 *
 * Handles user profile, health profile, and preferences management
 */

const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const Encryption = require('../utils/encryption');
const logger = require('../utils/logger');

const ENCRYPTED_HEALTH_FIELDS = ['health_conditions', 'medications', 'notes'];

class UserService {
  /**
   * Get user profile
   */
  async getProfile(userId) {
    const result = await pool.query(
      `SELECT id, email, name, phone, date_of_birth, avatar_url, timezone, language,
              role, email_verified, created_at, last_login
       FROM users WHERE id = $1`,
      [userId]
    );
    const user = result.rows[0];

    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updates) {
    const allowedFields = ['name', 'phone', 'date_of_birth', 'avatar_url', 'timezone', 'language'];
    const setClauses = [];
    const values = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        values.push(updates[field]);
        setClauses.push(`${field} = $${values.length}`);
      }
    }

    if (setClauses.length === 0) {
      return this.getProfile(userId);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${values.length}
       RETURNING id, email, name, phone, date_of_birth, avatar_url, timezone, language`,
      values
    );

    logger.info('Profile updated', { userId });
    return result.rows[0];
  }

  /**
   * Get health profile (with decrypted sensitive fields)
   */
  async getHealthProfile(userId) {
    const result = await pool.query('SELECT * FROM health_profiles WHERE user_id = $1', [userId]);
    const profile = result.rows[0];

    if (!profile) {
      return this.createHealthProfile(userId);
    }

    return this.decryptHealthProfile(profile);
  }

  /**
   * Create default health profile
   */
  async createHealthProfile(userId) {
    const result = await pool.query(
      `INSERT INTO health_profiles (user_id, average_cycle_length, average_period_length, created_at)
       VALUES ($1, 28, 5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [userId]
    );
    return result.rows[0];
  }

  /**
   * Update health profile (with encryption for sensitive fields)
   */
  async updateHealthProfile(userId, updates) {
    await this.getHealthProfile(userId);

    const allowedFields = [
      'average_cycle_length',
      'average_period_length',
      'birth_control_method',
      'health_conditions',
      'medications',
      'last_period_date',
      'is_pregnant',
      'is_trying_to_conceive',
      'notes',
    ];

    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey) && value !== undefined) {
        if (ENCRYPTED_HEALTH_FIELDS.includes(snakeKey)) {
          const valueToEncrypt = typeof value === 'object' ? JSON.stringify(value) : value;
          values.push(Encryption.encrypt(valueToEncrypt));
        } else {
          values.push(value);
        }
        setClauses.push(`${snakeKey} = $${values.length}`);
      }
    }

    if (setClauses.length === 0) {
      return this.getHealthProfile(userId);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await pool.query(
      `UPDATE health_profiles SET ${setClauses.join(', ')} WHERE user_id = $${values.length}
       RETURNING *`,
      values
    );

    logger.info('Health profile updated', { userId });
    return this.decryptHealthProfile(result.rows[0]);
  }

  /**
   * Decrypt health profile sensitive fields
   */
  decryptHealthProfile(profile) {
    const decrypted = { ...profile };

    for (const field of ENCRYPTED_HEALTH_FIELDS) {
      if (decrypted[field]) {
        try {
          const decryptedValue = Encryption.decrypt(decrypted[field]);
          try {
            decrypted[field] = JSON.parse(decryptedValue);
          } catch {
            decrypted[field] = decryptedValue;
          }
        } catch (err) {
          logger.warn('Failed to decrypt field', { field, userId: profile.user_id });
          decrypted[field] = null;
        }
      }
    }

    return decrypted;
  }

  /**
   * Get user preferences
   * Returns the reminders sub-object in the exact shape the frontend expects.
   */
  async getPreferences(userId) {
    const result = await pool.query('SELECT preferences FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];

    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const prefs = user.preferences || {};
    return this.formatPreferences(prefs);
  }

  /**
   * Update user preferences.
   * Accepts { reminders: { periodStarts, periodEnds, fertility, ovulation, medicine } }
   * and deep-merges into the stored JSONB.
   */
  async updatePreferences(userId, incoming) {
    const currentPrefs = await pool.query('SELECT preferences FROM users WHERE id = $1', [userId]);
    const stored = currentPrefs.rows[0]?.preferences || {};

    // Merge reminders key
    const merged = {
      ...stored,
    };
    if (incoming.reminders) {
      merged.reminders = {
        ...(stored.reminders || this.defaultReminders()),
        ...incoming.reminders,
      };
    }
    // Allow other top-level keys to pass through (theme, units, etc.)
    for (const key of Object.keys(incoming)) {
      if (key !== 'reminders') merged[key] = incoming[key];
    }

    const result = await pool.query(
      `UPDATE users SET preferences = $1, updated_at = NOW() WHERE id = $2
       RETURNING preferences`,
      [merged, userId]
    );

    logger.info('Preferences updated', { userId });
    return this.formatPreferences(result.rows[0].preferences);
  }

  /**
   * Default reminder toggles
   */
  defaultReminders() {
    return {
      periodStarts: true,
      periodEnds: true,
      fertility: false,
      ovulation: false,
      medicine: false,
    };
  }

  /**
   * Format raw JSONB preferences into the shape the frontend expects
   */
  formatPreferences(prefs) {
    return {
      reminders: {
        ...this.defaultReminders(),
        ...(prefs.reminders || {}),
      },
    };
  }

  /**
   * Store avatar (base64 data URL or remote URL) in avatar_url column
   */
  async updateAvatar(userId, avatarData) {
    const result = await pool.query(
      `UPDATE users SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, avatar_url`,
      [avatarData, userId]
    );
    if (!result.rows[0]) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return result.rows[0];
  }

  /**
   * Delete user account (soft delete)
   */
  async deleteAccount(userId, password) {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      const error = new Error('Invalid password');
      error.statusCode = 401;
      throw error;
    }

    await pool.query(
      `UPDATE users
       SET status = 'deleted', email = $1, name = 'Deleted User', deleted_at = NOW()
       WHERE id = $2`,
      [`deleted_${userId}@deleted.local`, userId]
    );

    await pool.query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [userId]);

    logger.info('Account deleted', { userId });
    return { message: 'Account deleted successfully' };
  }

  /**
   * Export user data (GDPR compliance)
   */
  async exportUserData(userId) {
    const [userResult, healthResult, cyclesResult, symptomsResult, moodsResult] = await Promise.all(
      [
        pool.query(
          'SELECT id, email, name, date_of_birth, timezone, language, created_at FROM users WHERE id = $1',
          [userId]
        ),
        pool.query('SELECT * FROM health_profiles WHERE user_id = $1', [userId]),
        pool.query('SELECT * FROM cycles WHERE user_id = $1 ORDER BY start_date DESC', [userId]),
        pool.query('SELECT * FROM symptoms WHERE user_id = $1 ORDER BY date DESC', [userId]),
        pool.query('SELECT * FROM moods WHERE user_id = $1 ORDER BY date DESC', [userId]),
      ]
    );

    return {
      exportDate: new Date().toISOString(),
      user: userResult.rows[0],
      healthProfile: healthResult.rows[0] ? this.decryptHealthProfile(healthResult.rows[0]) : null,
      cycles: cyclesResult.rows,
      symptoms: symptomsResult.rows,
      moods: moodsResult.rows,
    };
  }

  /**
   * Get user by ID (admin)
   */
  async getUserById(userId) {
    const result = await pool.query(
      `SELECT id, email, name, role, status, email_verified, created_at, last_login
       FROM users WHERE id = $1`,
      [userId]
    );
    const user = result.rows[0];

    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    return user;
  }

  /**
   * Save / update FCM device token
   */
  async saveDeviceToken(userId, token, platform) {
    await pool.query(
      `UPDATE users SET fcm_token = $1, fcm_platform = $2, updated_at = NOW() WHERE id = $3`,
      [token, platform, userId]
    );
  }

  /**
   * Search users (admin)
   */
  async searchUsers({ query, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const values = [];
    let whereClause = '';

    if (query) {
      values.push(`%${query}%`);
      whereClause = `WHERE (email ILIKE $1 OR name ILIKE $1)`;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM users ${whereClause}`, values);

    const dataValues = [...values, limit, offset];
    const result = await pool.query(
      `SELECT id, email, name, role, status, created_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    );

    return {
      users: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
      },
    };
  }
}

module.exports = new UserService();
