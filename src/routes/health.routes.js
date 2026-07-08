/**
 * Health Routes
 *
 * Symptoms and mood tracking endpoints
 */

const express = require('express');
const router = express.Router();

const healthController = require('../controllers/health/health.controller');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { sensitiveDataLimiter } = require('../middleware/rateLimiter');
const {
  logSymptomValidation,
  logMultipleSymptomsValidation,
  logMoodValidation,
  logMultipleMoodsValidation,
  getHealthLogsValidation,
  healthLogIdParamValidation,
  updateSymptomValidation,
  updateMoodValidation,
  dateRangeValidation,
} = require('../validators/health.validator');
const { logFlow, logMedicine, logWeight, getWeightHistory, logTemperature, getTemperatureHistory } =
  healthController;
const { dateParamValidation } = require('../validators/cycle.validator');

// All routes require authentication
router.use(authenticateToken);
router.use(sensitiveDataLimiter);

// ==================== SYMPTOMS ====================

/**
 * @route   POST /api/v1/health/symptoms
 * @desc    Log a symptom
 * @access  Private
 */
router.post('/symptoms', logSymptomValidation, validate, healthController.logSymptom);

/**
 * @route   POST /api/v1/health/symptoms/batch
 * @desc    Log multiple symptoms at once
 * @access  Private
 */
router.post(
  '/symptoms/batch',
  logMultipleSymptomsValidation,
  validate,
  healthController.logMultipleSymptoms
);

/**
 * @route   GET /api/v1/health/symptoms
 * @desc    Get symptoms with filters
 * @access  Private
 */
router.get('/symptoms', getHealthLogsValidation, validate, healthController.getSymptoms);

/**
 * @route   GET /api/v1/health/symptoms/date/:date
 * @desc    Get symptoms for a specific date
 * @access  Private
 */
router.get(
  '/symptoms/date/:date',
  dateParamValidation,
  validate,
  healthController.getSymptomsByDate
);

/**
 * @route   PUT /api/v1/health/symptoms/:id
 * @desc    Update a symptom
 * @access  Private
 */
router.put('/symptoms/:id', updateSymptomValidation, validate, healthController.updateSymptom);

/**
 * @route   DELETE /api/v1/health/symptoms/:id
 * @desc    Delete a symptom
 * @access  Private
 */
router.delete(
  '/symptoms/:id',
  healthLogIdParamValidation,
  validate,
  healthController.deleteSymptom
);

// ==================== MOODS ====================

/**
 * @route   POST /api/v1/health/moods
 * @desc    Log a mood
 * @access  Private
 */
router.post('/moods', logMoodValidation, validate, healthController.logMood);

/**
 * @route   POST /api/v1/health/moods/batch
 * @desc    Log multiple moods at once
 * @access  Private
 */
router.post(
  '/moods/batch',
  logMultipleMoodsValidation,
  validate,
  healthController.logMultipleMoods
);

/**
 * @route   GET /api/v1/health/moods
 * @desc    Get moods with filters
 * @access  Private
 */
router.get('/moods', getHealthLogsValidation, validate, healthController.getMoods);

/**
 * @route   GET /api/v1/health/moods/date/:date
 * @desc    Get moods for a specific date
 * @access  Private
 */
router.get('/moods/date/:date', dateParamValidation, validate, healthController.getMoodsByDate);

/**
 * @route   PUT /api/v1/health/moods/:id
 * @desc    Update a mood
 * @access  Private
 */
router.put('/moods/:id', updateMoodValidation, validate, healthController.updateMood);

/**
 * @route   DELETE /api/v1/health/moods/:id
 * @desc    Delete a mood
 * @access  Private
 */
router.delete('/moods/:id', healthLogIdParamValidation, validate, healthController.deleteMood);

// ==================== FLOW ====================

// POST /api/v1/health/flow  — log flow level (spotting/light/medium/heavy/very_heavy)
// PUT  /api/v1/health/flow  — update flow level for a date
router.post('/flow', logFlow);
router.put('/flow', logFlow);

// ==================== MEDICINE ====================

// POST /api/v1/health/medicine  — log contraception used
// PUT  /api/v1/health/medicine  — update contraception for a date
router.post('/medicine', logMedicine);
router.put('/medicine', logMedicine);

// ==================== WEIGHT ====================

// POST /api/v1/health/weight  — log weight for today (or provided date)
// PUT  /api/v1/health/weight  — update weight (same upsert behaviour)
router.post('/weight', logWeight);
router.put('/weight', logWeight);

// GET /api/v1/health/weight?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/weight', getWeightHistory);

// ==================== TEMPERATURE ====================

// POST /api/v1/health/temperature  — log BBT for today (or provided date)
// PUT  /api/v1/health/temperature  — update temperature (same upsert behaviour)
router.post('/temperature', logTemperature);
router.put('/temperature', logTemperature);

// GET /api/v1/health/temperature?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/temperature', getTemperatureHistory);

// ==================== ANALYTICS ====================

/**
 * @route   GET /api/v1/health/analytics/symptoms
 * @desc    Get symptom analytics
 * @access  Private
 */
router.get('/analytics/symptoms', healthController.getSymptomAnalytics);

/**
 * @route   GET /api/v1/health/analytics/moods
 * @desc    Get mood analytics
 * @access  Private
 */
router.get('/analytics/moods', healthController.getMoodAnalytics);

// ==================== SUMMARIES ====================

/**
 * @route   GET /api/v1/health/summary/:date
 * @desc    Get daily health summary
 * @access  Private
 */
router.get('/summary/:date', dateParamValidation, validate, healthController.getDailySummary);

/**
 * @route   GET /api/v1/health/trends/:cycleId
 * @desc    Get health trends for a specific cycle
 * @access  Private
 */
router.get('/trends/:cycleId', healthController.getHealthTrends);

module.exports = router;
