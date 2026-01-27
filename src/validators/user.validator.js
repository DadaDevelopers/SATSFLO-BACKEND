/**
 * User Validators
 *
 * Input validation rules for user profile endpoints
 */

const { body, param, query } = require('express-validator');
const { PRIVACY_LEVELS } = require('../utils/constants');

/**
 * Update profile validation
 */
const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),

  body('timezone')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Invalid timezone'),

  body('language')
    .optional()
    .isIn(['en', 'sw', 'fr', 'es', 'pt'])
    .withMessage('Unsupported language'),

  body('avatarUrl')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
];

/**
 * Update health profile validation
 */
const updateHealthProfileValidation = [
  body('averageCycleLength')
    .optional()
    .isInt({ min: 21, max: 45 })
    .withMessage('Average cycle length must be between 21 and 45 days'),

  body('averagePeriodLength')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Average period length must be between 1 and 10 days'),

  body('birthControlMethod')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Birth control method must not exceed 100 characters'),

  body('healthConditions')
    .optional()
    .isArray()
    .withMessage('Health conditions must be an array'),

  body('healthConditions.*')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Each health condition must not exceed 100 characters'),

  body('medications')
    .optional()
    .isArray()
    .withMessage('Medications must be an array'),

  body('medications.*')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Each medication must not exceed 100 characters'),

  body('lastPeriodDate')
    .optional()
    .isISO8601()
    .withMessage('Last period date must be a valid date')
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error('Last period date cannot be in the future');
      }
      return true;
    }),

  body('isPregnant')
    .optional()
    .isBoolean()
    .withMessage('isPregnant must be a boolean'),

  body('isTryingToConceive')
    .optional()
    .isBoolean()
    .withMessage('isTryingToConceive must be a boolean')
];

/**
 * Update preferences validation
 */
const updatePreferencesValidation = [
  body('notifications')
    .optional()
    .isObject()
    .withMessage('Notifications must be an object'),

  body('notifications.periodReminder')
    .optional()
    .isBoolean()
    .withMessage('Period reminder must be a boolean'),

  body('notifications.ovulationReminder')
    .optional()
    .isBoolean()
    .withMessage('Ovulation reminder must be a boolean'),

  body('notifications.pillReminder')
    .optional()
    .isBoolean()
    .withMessage('Pill reminder must be a boolean'),

  body('notifications.dailyLogReminder')
    .optional()
    .isBoolean()
    .withMessage('Daily log reminder must be a boolean'),

  body('notifications.communityUpdates')
    .optional()
    .isBoolean()
    .withMessage('Community updates must be a boolean'),

  body('reminderTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Reminder time must be in HH:MM format'),

  body('privacy')
    .optional()
    .isIn(Object.values(PRIVACY_LEVELS))
    .withMessage('Invalid privacy level'),

  body('theme')
    .optional()
    .isIn(['light', 'dark', 'system'])
    .withMessage('Theme must be light, dark, or system'),

  body('units')
    .optional()
    .isIn(['metric', 'imperial'])
    .withMessage('Units must be metric or imperial')
];

/**
 * User ID parameter validation
 */
const userIdParamValidation = [
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID format')
];

/**
 * Search users validation
 */
const searchUsersValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

/**
 * Delete account validation
 */
const deleteAccountValidation = [
  body('password')
    .notEmpty()
    .withMessage('Password is required to delete account'),

  body('confirmation')
    .equals('DELETE')
    .withMessage('Please type DELETE to confirm account deletion')
];

module.exports = {
  updateProfileValidation,
  updateHealthProfileValidation,
  updatePreferencesValidation,
  userIdParamValidation,
  searchUsersValidation,
  deleteAccountValidation
};
