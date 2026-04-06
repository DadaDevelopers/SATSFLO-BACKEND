/**
 * Cycle Routes
 *
 * Period tracking and cycle management endpoints
 */

const express = require('express');
const router = express.Router();

const cycleController = require('../controllers/cycle/cycle.controller');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { sensitiveDataLimiter } = require('../middleware/rateLimiter');
const {
  startPeriodValidation,
  endPeriodValidation,
  logDailyEntryValidation,
  updateCycleValidation,
  getCyclesValidation,
  cycleIdParamValidation,
  dateParamValidation
} = require('../validators/cycle.validator');
const { updatePeriodStart, updatePeriodEnd } = cycleController;

// All routes require authentication
router.use(authenticateToken);
router.use(sensitiveDataLimiter);

// ==================== PERIOD TRACKING ====================

/**
 * @route   POST /api/v1/cycles/start
 * @desc    Start a new period
 * @access  Private
 */
router.post(
  '/start',
  startPeriodValidation,
  validate,
  cycleController.startPeriod
);

/**
 * @route   POST /api/v1/cycles/end
 * @desc    End current period
 * @access  Private
 */
router.post(
  '/end',
  endPeriodValidation,
  validate,
  cycleController.endPeriod
);

/**
 * @route   PUT /api/v1/cycles/start
 * @desc    Correct/update the start date of the current active period
 * @access  Private
 */
router.put('/start', startPeriodValidation, validate, updatePeriodStart);

/**
 * @route   PUT /api/v1/cycles/end
 * @desc    Correct/update the end date of the current active period
 * @access  Private
 */
router.put('/end', endPeriodValidation, validate, updatePeriodEnd);

/**
 * @route   POST /api/v1/cycles/log
 * @desc    Log daily entry
 * @access  Private
 */
router.post(
  '/log',
  logDailyEntryValidation,
  validate,
  cycleController.logDailyEntry
);

// ==================== CURRENT STATUS ====================

/**
 * @route   GET /api/v1/cycles/current
 * @desc    Get current cycle status with predictions
 * @access  Private
 */
router.get('/current', cycleController.getCurrentCycle);

/**
 * @route   GET /api/v1/cycles/predictions
 * @desc    Get next period/ovulation predictions
 * @access  Private
 */
router.get('/predictions', cycleController.getPredictions);

// ==================== ANALYTICS ====================

/**
 * @route   GET /api/v1/cycles/analytics
 * @desc    Get cycle analytics and insights
 * @access  Private
 */
router.get('/analytics', cycleController.getAnalytics);

// ==================== DAILY LOGS ====================

/**
 * @route   GET /api/v1/cycles/log/:date
 * @desc    Get daily log for specific date
 * @access  Private
 */
router.get(
  '/log/:date',
  dateParamValidation,
  validate,
  cycleController.getDailyLog
);

// ==================== CYCLE LOGS (nested) ====================

/**
 * @route   POST /api/v1/cycles/:cycleId/logs
 * @desc    Add a daily log to a specific cycle
 * @access  Private
 */
router.post(
  '/:cycleId/logs',
  cycleIdParamValidation,
  logDailyEntryValidation,
  validate,
  cycleController.addCycleLog
);

// ==================== CYCLE HISTORY ====================

/**
 * @route   GET /api/v1/cycles
 * @desc    Get cycle history
 * @access  Private
 */
router.get(
  '/',
  getCyclesValidation,
  validate,
  cycleController.getCycles
);

/**
 * @route   GET /api/v1/cycles/:cycleId
 * @desc    Get cycle by ID with daily logs
 * @access  Private
 */
router.get(
  '/:cycleId',
  cycleIdParamValidation,
  validate,
  cycleController.getCycleById
);

/**
 * @route   PUT /api/v1/cycles/:cycleId
 * @desc    Update cycle
 * @access  Private
 */
router.put(
  '/:cycleId',
  updateCycleValidation,
  validate,
  cycleController.updateCycle
);

/**
 * @route   DELETE /api/v1/cycles/:cycleId
 * @desc    Delete cycle
 * @access  Private
 */
router.delete(
  '/:cycleId',
  cycleIdParamValidation,
  validate,
  cycleController.deleteCycle
);

module.exports = router;
