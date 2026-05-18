'use strict';

const cron = require('node-cron');
const { pool } = require('../config/database');
const firebase = require('../services/firebase.service');
const logger = require('../utils/logger');

// Query users whose period is in exactly 1, 3, or 5 days.
// days_until_period = cycle_length - current_day
// current_day       = ((today - last_period_start) % cycle_length) + 1
const REMINDER_DAYS = [1, 3, 5];

const MESSAGES = {
  1: 'Your period starts tomorrow. Stay prepared!',
  3: 'Your period is in 3 days. Time to stock up.',
  5: 'Your period is coming up in 5 days. Heads up!',
};

async function runPeriodReminders() {
  logger.info('Period reminder job started');

  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.fcm_token,
         (cp.cycle_length - (((CURRENT_DATE - cp.last_period_start) % cp.cycle_length) + 1)) AS days_until_period
       FROM users u
       JOIN cycle_profiles cp ON cp.user_id = u.id
       WHERE u.fcm_token IS NOT NULL
         AND u.status = 'active'
         AND cp.last_period_start IS NOT NULL
         AND (cp.cycle_length - (((CURRENT_DATE - cp.last_period_start) % cp.cycle_length) + 1))
             = ANY($1::int[])`,
      [REMINDER_DAYS]
    );

    logger.info(`Period reminder: ${result.rows.length} user(s) to notify`);

    for (const user of result.rows) {
      const days = Number(user.days_until_period);
      const body = MESSAGES[days] ?? `Your period is in ${days} day(s).`;

      try {
        await firebase.sendPush(
          user.fcm_token,
          'Period reminder',
          body,
          { type: 'period_reminder', days_until_period: String(days) }
        );
        logger.info('Push sent', { userId: user.id, days });
      } catch (err) {
        // If token is invalid, clear it so we don't keep trying
        if (err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token') {
          await pool.query(
            'UPDATE users SET fcm_token = NULL, fcm_platform = NULL WHERE id = $1',
            [user.id]
          );
          logger.info('Cleared stale FCM token', { userId: user.id });
        }
      }
    }
  } catch (err) {
    logger.error('Period reminder job failed', { error: err.message });
  }

  logger.info('Period reminder job finished');
}

// Run daily at 9:00 AM server time
function start() {
  cron.schedule('0 9 * * *', runPeriodReminders);
  logger.info('Period reminder cron scheduled (daily 09:00)');
}

module.exports = { start, runPeriodReminders };
