/**
 * Database Configuration
 *
 * Centralizes table names and error codes for Supabase
 */

const { supabase, supabaseAdmin } = require('./supabase');

const dbConfig = {
  // Table names - centralized for easy refactoring
  tables: {
    USERS: 'users',
    HEALTH_PROFILES: 'health_profiles',
    CYCLES: 'cycles',
    SYMPTOMS: 'symptoms',
    MOODS: 'moods',
    CYCLE_LOGS: 'cycle_logs',
    PREDICTIONS: 'predictions',
    REFRESH_TOKENS: 'refresh_tokens',
    PASSWORD_RESETS: 'password_resets',
    // Reserved for Isabellah (Lightning/Chat features)
    WALLETS: 'wallets',
    REWARDS: 'rewards',
    MESSAGES: 'messages',
    FORUMS: 'forums',
    FORUM_POSTS: 'forum_posts'
  },

  // PostgreSQL error codes
  errors: {
    DUPLICATE_KEY: '23505',
    FOREIGN_KEY_VIOLATION: '23503',
    NOT_NULL_VIOLATION: '23502',
    CHECK_VIOLATION: '23514',
    UNIQUE_VIOLATION: '23505'
  }
};

module.exports = {
  supabase,
  supabaseAdmin,
  dbConfig
};
