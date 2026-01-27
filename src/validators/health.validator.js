/**
 * Health Validators
 *
 * Input validation rules for symptoms and mood tracking
 */

const { body, param, query } = require('express-validator');
const { SYMPTOM_CATEGORIES, MOOD_TYPES, SEVERITY_LEVELS, SYMPTOMS } = require('../utils/constants');

/**
 * Log symptom validation
 */
const logSymptomValidation = [
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date')
    .custom((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (date > today) {
        throw new Error('Date cannot be in the future');
      }
      return true;
    }),

  body('symptom')
    .notEmpty()
    .withMessage('Symptom is required')
    .isString()
    .isLength({ max: 100 })
    .withMessage('Symptom must not exceed 100 characters'),

  body('category')
    .optional()
    .isIn(Object.values(SYMPTOM_CATEGORIES))
    .withMessage(`Category must be one of: ${Object.values(SYMPTOM_CATEGORIES).join(', ')}`),

  body('severity')
    .optional()
    .isInt({ min: 1, max: 3 })
    .withMessage('Severity must be between 1 (mild) and 3 (severe)'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),

  body('timeOfDay')
    .optional()
    .isIn(['morning', 'afternoon', 'evening', 'night', 'all_day'])
    .withMessage('Invalid time of day')
];

/**
 * Log multiple symptoms validation
 */
const logMultipleSymptomsValidation = [
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),

  body('symptoms')
    .isArray({ min: 1, max: 20 })
    .withMessage('Symptoms must be an array with 1-20 entries'),

  body('symptoms.*.symptom')
    .notEmpty()
    .withMessage('Each symptom entry must have a symptom name')
    .isString()
    .isLength({ max: 100 }),

  body('symptoms.*.severity')
    .optional()
    .isInt({ min: 1, max: 3 }),

  body('symptoms.*.category')
    .optional()
    .isIn(Object.values(SYMPTOM_CATEGORIES))
];

/**
 * Log mood validation
 */
const logMoodValidation = [
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date')
    .custom((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (date > today) {
        throw new Error('Date cannot be in the future');
      }
      return true;
    }),

  body('mood')
    .notEmpty()
    .withMessage('Mood is required')
    .isIn(Object.values(MOOD_TYPES))
    .withMessage(`Mood must be one of: ${Object.values(MOOD_TYPES).join(', ')}`),

  body('intensity')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Intensity must be between 1 and 5'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),

  body('triggers')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Triggers must be an array with max 10 entries'),

  body('triggers.*')
    .optional()
    .isString()
    .isLength({ max: 100 })
];

/**
 * Log multiple moods validation
 */
const logMultipleMoodsValidation = [
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),

  body('moods')
    .isArray({ min: 1, max: 10 })
    .withMessage('Moods must be an array with 1-10 entries'),

  body('moods.*.mood')
    .notEmpty()
    .withMessage('Each mood entry must have a mood type')
    .isIn(Object.values(MOOD_TYPES)),

  body('moods.*.intensity')
    .optional()
    .isInt({ min: 1, max: 5 })
];

/**
 * Get symptoms/moods validation (pagination & filters)
 */
const getHealthLogsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  query('category')
    .optional()
    .isIn(Object.values(SYMPTOM_CATEGORIES))
    .withMessage('Invalid symptom category'),

  query('symptom')
    .optional()
    .isString()
    .isLength({ max: 100 }),

  query('mood')
    .optional()
    .isIn(Object.values(MOOD_TYPES))
    .withMessage('Invalid mood type')
];

/**
 * Symptom/Mood ID parameter validation
 */
const healthLogIdParamValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format')
];

/**
 * Update symptom validation
 */
const updateSymptomValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid symptom ID format'),

  body('severity')
    .optional()
    .isInt({ min: 1, max: 3 })
    .withMessage('Severity must be between 1 and 3'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters')
];

/**
 * Update mood validation
 */
const updateMoodValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid mood ID format'),

  body('intensity')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Intensity must be between 1 and 5'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters')
];

/**
 * Date range validation for analytics
 */
const dateRangeValidation = [
  query('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

module.exports = {
  logSymptomValidation,
  logMultipleSymptomsValidation,
  logMoodValidation,
  logMultipleMoodsValidation,
  getHealthLogsValidation,
  healthLogIdParamValidation,
  updateSymptomValidation,
  updateMoodValidation,
  dateRangeValidation
};
