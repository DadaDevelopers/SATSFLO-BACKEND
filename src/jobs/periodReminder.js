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

const DEFAULT_REMINDERS = {
  periodStarts: true,
  periodEnds: true,
  fertility: false,
  ovulation: false,
  medicine: false,
};

function normalizeReminders(preferences) {
  const reminders = preferences?.reminders || {};
  return {
    ...DEFAULT_REMINDERS,
    ...reminders,
  };
}

async function runPeriodReminders() {
  logger.info('Period reminder job started');

  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.fcm_token,
         u.preferences,
         cp.cycle_length,
         cp.period_length,
         cp.luteal_phase_length,
         ((CURRENT_DATE - cp.last_period_start) % cp.cycle_length) + 1 AS current_day,
         (cp.cycle_length - (((CURRENT_DATE - cp.last_period_start) % cp.cycle_length) + 1)) AS days_until_period
       FROM users u
       JOIN cycle_profiles cp ON cp.user_id = u.id
       WHERE u.fcm_token IS NOT NULL
         AND u.status = 'active'
         AND cp.last_period_start IS NOT NULL`
    );

    logger.info(`Period reminder: ${result.rows.length} user(s) evaluated`);

    for (const user of result.rows) {
      const preferences = normalizeReminders(user.preferences || {});
      const currentDay = Number(user.current_day);
      const cycleLength = Number(user.cycle_length);
      const periodLength = Number(user.period_length) || 5;
      const lutealPhaseLength = Number(user.luteal_phase_length) || 14;
      const daysUntilPeriod = Number(user.days_until_period);
      const ovulationDay = cycleLength - lutealPhaseLength;
      const daysUntilOvulation =
        ovulationDay >= currentDay
          ? ovulationDay - currentDay
          : cycleLength - currentDay + ovulationDay;

      const notifications = [];

      if (REMINDER_DAYS.includes(daysUntilPeriod)) {
        notifications.push({
          title: 'Period reminder',
          body: MESSAGES[daysUntilPeriod],
          data: { type: 'period_reminder', days_until_period: String(daysUntilPeriod) },
        });
      }

      if (preferences.periodStarts && daysUntilPeriod === 0) {
        notifications.push({
          title: 'Period starts today',
          body: 'Your period starts today. Be ready and take care of yourself.',
          data: { type: 'period_starts', days_until_period: '0' },
        });
      }

      if (preferences.periodEnds && currentDay === periodLength) {
        notifications.push({
          title: 'Period ending soon',
          body: 'Today is the expected last day of your period. Remember to log the end when it finishes.',
          data: {
            type: 'period_ends',
            current_day: String(currentDay),
            period_length: String(periodLength),
          },
        });
      }

      if (preferences.fertility && daysUntilOvulation === 5) {
        notifications.push({
          title: 'Fertility window starting',
          body: 'Your fertile window begins in 5 days. Stay aware and plan accordingly.',
          data: { type: 'fertility_reminder', days_until_ovulation: String(daysUntilOvulation) },
        });
      }

      if (preferences.ovulation && daysUntilOvulation === 0) {
        notifications.push({
          title: 'Ovulation starts today',
          body: 'Your ovulation starts today. Track symptoms or fertility activity as needed.',
          data: { type: 'ovulation_reminder', days_until_ovulation: '0' },
        });
      }

      if (preferences.medicine) {
        notifications.push({
          title: 'Medicine reminder',
          body: 'Don’t forget to take your pills today.',
          data: { type: 'medicine_reminder' },
        });
      }

      if (notifications.length === 0) {
        continue;
      }

      for (const notification of notifications) {
        try {
          await firebase.sendPush(
            user.fcm_token,
            notification.title,
            notification.body,
            notification.data
          );
          logger.info('Push sent', {
            userId: user.id,
            type: notification.data.type,
            days_until_period: notification.data.days_until_period,
            days_until_ovulation: notification.data.days_until_ovulation,
          });
        } catch (err) {
          if (
            err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token'
          ) {
            await pool.query(
              'UPDATE users SET fcm_token = NULL, fcm_platform = NULL WHERE id = $1',
              [user.id]
            );
            logger.info('Cleared stale FCM token', { userId: user.id });
          }
          // Skip DB insert if push failed
          continue;
        }

        // Persist to notifications table so it appears in the in-app list
        await pool.query(
          `INSERT INTO notifications (user_id, type, message, is_read, created_at)
           VALUES ($1, $2, $3, false, NOW())`,
          [user.id, notification.data.type, notification.body]
        );
      }
    }
  } catch (err) {
    logger.error('Period reminder job failed', { error: err.message });
  }

  logger.info('Period reminder job finished');
}

function start() {
  cron.schedule('0 9 * * *', runPeriodReminders);
  logger.info('Period reminder cron scheduled (daily 09:00)');
}

module.exports = { start, runPeriodReminders };
