/**
 * Cycle Validators
 *
 * Input validation rules for cycle tracking endpoints
 */

const { body, param, query } = require('express-validator');
const { FLOW_INTENSITY, CYCLE_DEFAULTS } = require('../utils/constants');

/**
 * Start period validation
 */
const startPeriodValidation = [
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
      // Don't allow dates more than 1 year in the past
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (date < oneYearAgo) {
        throw new Error('Date cannot be more than 1 year in the past');
      }
      return true;
    }),

  body('flowIntensity')
    .optional()
    .isIn(Object.values(FLOW_INTENSITY))
    .withMessage(`Flow intensity must be one of: ${Object.values(FLOW_INTENSITY).join(', ')}`),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),
];

/**
 * End period validation
 */
const endPeriodValidation = [
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
];

/**
 * Log daily entry validation
 */
const logDailyEntryValidation = [
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

  body('flowIntensity')
    .optional()
    .isIn([...Object.values(FLOW_INTENSITY), null])
    .withMessage(`Flow intensity must be one of: ${Object.values(FLOW_INTENSITY).join(', ')}`),

  body('temperature')
    .optional()
    .isFloat({ min: 35.0, max: 42.0 })
    .withMessage('Temperature must be between 35.0 and 42.0 °C'),

  body('cervicalMucus')
    .optional()
    .isIn(['dry', 'sticky', 'creamy', 'watery', 'egg_white'])
    .withMessage('Invalid cervical mucus type'),

  body('sexualActivity').optional().isBoolean().withMessage('Sexual activity must be a boolean'),

  body('contraceptionUsed')
    .optional()
    .isBoolean()
    .withMessage('Contraception used must be a boolean'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
];

/**
 * Update cycle validation
 */
const updateCycleValidation = [
  param('cycleId').isUUID().withMessage('Invalid cycle ID format'),

  body('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),

  body('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),

  body('periodEndDate')
    .optional()
    .isISO8601()
    .withMessage('Period end date must be a valid ISO 8601 date'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),
];

/**
 * Get cycles validation (pagination & filters)
 */
const getCyclesValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
];

/**
 * Cycle ID parameter validation
 */
const cycleIdParamValidation = [param('cycleId').isUUID().withMessage('Invalid cycle ID format')];

/**
 * Date parameter validation
 */
const dateParamValidation = [
  param('date').isISO8601().withMessage('Date must be a valid ISO 8601 date'),
];

/**
 * Import cycles validation (for data migration)
 */
const importCyclesValidation = [
  body('cycles')
    .isArray({ min: 1, max: 100 })
    .withMessage('Cycles must be an array with 1-100 entries'),

  body('cycles.*.startDate').isISO8601().withMessage('Each cycle must have a valid start date'),

  body('cycles.*.endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  body('cycles.*.periodEndDate')
    .optional()
    .isISO8601()
    .withMessage('Period end date must be a valid ISO 8601 date'),
];

module.exports = {
  startPeriodValidation,
  endPeriodValidation,
  logDailyEntryValidation,
  updateCycleValidation,
  getCyclesValidation,
  cycleIdParamValidation,
  dateParamValidation,
  importCyclesValidation,
};
