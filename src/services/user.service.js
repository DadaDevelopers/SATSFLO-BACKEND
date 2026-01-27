/**
 * User Service
 *
 * Handles user profile, health profile, and preferences management
 */

const bcrypt = require('bcrypt');
const { supabaseAdmin, dbConfig } = require('../config/database');
const Encryption = require('../utils/encryption');
const logger = require('../utils/logger');

// Fields that should be encrypted in health profile
const ENCRYPTED_HEALTH_FIELDS = ['health_conditions', 'medications', 'notes'];

class UserService {
  /**
   * Get user profile
   */
  async getProfile(userId) {
    const { data: user, error } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .select(`
        id,
        email,
        name,
        date_of_birth,
        avatar_url,
        timezone,
        language,
        role,
        email_verified,
        created_at,
        last_login
      `)
      .eq('id', userId)
      .single();

    if (error || !user) {
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
    const allowedFields = ['name', 'date_of_birth', 'avatar_url', 'timezone', 'language'];
    const sanitizedUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        // Convert camelCase to snake_case
        const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        sanitizedUpdates[snakeField] = updates[field];
      }
    }

    sanitizedUpdates.updated_at = new Date().toISOString();

    const { data: user, error } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .update(sanitizedUpdates)
      .eq('id', userId)
      .select('id, email, name, date_of_birth, avatar_url, timezone, language')
      .single();

    if (error) {
      logger.error('Profile update failed', error);
      throw error;
    }

    logger.info('Profile updated', { userId });
    return user;
  }

  /**
   * Get health profile (with decrypted sensitive fields)
   */
  async getHealthProfile(userId) {
    const { data: profile, error } = await supabaseAdmin
      .from(dbConfig.tables.HEALTH_PROFILES)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      // Create default profile if not exists
      return this.createHealthProfile(userId);
    }

    // Decrypt sensitive fields
    return this.decryptHealthProfile(profile);
  }

  /**
   * Create default health profile
   */
  async createHealthProfile(userId) {
    const { data: profile, error } = await supabaseAdmin
      .from(dbConfig.tables.HEALTH_PROFILES)
      .insert({
        user_id: userId,
        average_cycle_length: 28,
        average_period_length: 5,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      logger.error('Health profile creation failed', error);
      throw error;
    }

    return profile;
  }

  /**
   * Update health profile (with encryption for sensitive fields)
   */
  async updateHealthProfile(userId, updates) {
    // Ensure profile exists
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
      'notes'
    ];

    const sanitizedUpdates = {};

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey) && value !== undefined) {
        // Encrypt sensitive fields
        if (ENCRYPTED_HEALTH_FIELDS.includes(snakeKey)) {
          const valueToEncrypt = typeof value === 'object' ? JSON.stringify(value) : value;
          sanitizedUpdates[snakeKey] = Encryption.encrypt(valueToEncrypt);
        } else {
          sanitizedUpdates[snakeKey] = value;
        }
      }
    }

    sanitizedUpdates.updated_at = new Date().toISOString();

    const { data: profile, error } = await supabaseAdmin
      .from(dbConfig.tables.HEALTH_PROFILES)
      .update(sanitizedUpdates)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      logger.error('Health profile update failed', error);
      throw error;
    }

    logger.info('Health profile updated', { userId });
    return this.decryptHealthProfile(profile);
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
          // Try to parse JSON for array fields
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
   */
  async getPreferences(userId) {
    const { data: user, error } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .select('preferences')
      .eq('id', userId)
      .single();

    if (error || !user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    // Return default preferences if none set
    return user.preferences || this.getDefaultPreferences();
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId, preferences) {
    // Get current preferences
    const currentPrefs = await this.getPreferences(userId);

    // Merge with new preferences
    const mergedPreferences = {
      ...currentPrefs,
      ...preferences,
      notifications: {
        ...currentPrefs.notifications,
        ...(preferences.notifications || {})
      }
    };

    const { data: user, error } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .update({
        preferences: mergedPreferences,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('preferences')
      .single();

    if (error) {
      logger.error('Preferences update failed', error);
      throw error;
    }

    logger.info('Preferences updated', { userId });
    return user.preferences;
  }

  /**
   * Get default preferences
   */
  getDefaultPreferences() {
    return {
      notifications: {
        periodReminder: true,
        ovulationReminder: true,
        pillReminder: false,
        dailyLogReminder: false,
        communityUpdates: true
      },
      reminderTime: '09:00',
      privacy: 'private',
      theme: 'system',
      units: 'metric'
    };
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId, password) {
    // Verify password
    const { data: user } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .select('password_hash')
      .eq('id', userId)
      .single();

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

    // Soft delete - mark as deleted
    await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .update({
        status: 'deleted',
        email: `deleted_${userId}@deleted.local`,
        name: 'Deleted User',
        deleted_at: new Date().toISOString()
      })
      .eq('id', userId);

    // Revoke all refresh tokens
    await supabaseAdmin
      .from(dbConfig.tables.REFRESH_TOKENS)
      .update({ revoked: true })
      .eq('user_id', userId);

    logger.info('Account deleted', { userId });
    return { message: 'Account deleted successfully' };
  }

  /**
   * Export user data (GDPR compliance)
   */
  async exportUserData(userId) {
    const [
      { data: user },
      { data: healthProfile },
      { data: cycles },
      { data: symptoms },
      { data: moods }
    ] = await Promise.all([
      supabaseAdmin
        .from(dbConfig.tables.USERS)
        .select('id, email, name, date_of_birth, timezone, language, created_at')
        .eq('id', userId)
        .single(),
      supabaseAdmin
        .from(dbConfig.tables.HEALTH_PROFILES)
        .select('*')
        .eq('user_id', userId)
        .single(),
      supabaseAdmin
        .from(dbConfig.tables.CYCLES)
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false }),
      supabaseAdmin
        .from(dbConfig.tables.SYMPTOMS)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false }),
      supabaseAdmin
        .from(dbConfig.tables.MOODS)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
    ]);

    return {
      exportDate: new Date().toISOString(),
      user,
      healthProfile: healthProfile ? this.decryptHealthProfile(healthProfile) : null,
      cycles: cycles || [],
      symptoms: symptoms || [],
      moods: moods || []
    };
  }

  /**
   * Get user by ID (admin)
   */
  async getUserById(userId) {
    const { data: user, error } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .select('id, email, name, role, status, email_verified, created_at, last_login')
      .eq('id', userId)
      .single();

    if (error || !user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    return user;
  }

  /**
   * Search users (admin)
   */
  async searchUsers({ query, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;

    let queryBuilder = supabaseAdmin
      .from(dbConfig.tables.USERS)
      .select('id, email, name, role, status, created_at', { count: 'exact' });

    if (query) {
      queryBuilder = queryBuilder.or(`email.ilike.%${query}%,name.ilike.%${query}%`);
    }

    const { data: users, count, error } = await queryBuilder
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      users,
      pagination: {
        page,
        limit,
        total: count
      }
    };
  }
}

module.exports = new UserService();
