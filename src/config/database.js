/**
 * Database Configuration
 *
 * Exports the pg pool and centralized table names
 */

const pool = require('./db');

const dbConfig = {
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
    LIGHTNING_WALLETS: 'lightning_wallets',
    LIGHTNING_TRANSACTIONS: 'lightning_transactions',
    REWARD_LEDGER: 'reward_ledger',
    GIFT_TRANSACTIONS: 'gift_transactions',
    WALLETS: 'wallets',
    REWARDS: 'rewards',
    MESSAGES: 'messages',
    FORUMS: 'forums',
    FORUM_POSTS: 'forum_posts'
  },

  errors: {
    DUPLICATE_KEY: '23505',
    FOREIGN_KEY_VIOLATION: '23503',
    NOT_NULL_VIOLATION: '23502',
    CHECK_VIOLATION: '23514',
    UNIQUE_VIOLATION: '23505'
  }
};

module.exports = { pool, dbConfig };
