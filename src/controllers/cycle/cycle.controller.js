/**
 * Cycle Controller
 *
 * Handles period tracking and cycle management endpoints
 */

const cycleService = require('../../services/cycle.service');
const ApiResponse = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Start a new period
 * POST /api/v1/cycles/start
 */
const startPeriod = async (req, res, next) => {
  try {
    // Accept both start_date (frontend) and date (legacy)
    const date = req.body.start_date ?? req.body.date;
    const { flowIntensity, notes } = req.body;

    const cycle = await cycleService.startPeriod(req.user.id, {
      date,
      flowIntensity,
      notes,
    });

    return ApiResponse.created(res, cycle, 'Period started');
  } catch (error) {
    next(error);
  }
};

/**
 * End current period
 * POST /api/v1/cycles/end
 */
const endPeriod = async (req, res, next) => {
  try {
    const date = req.body.end_date ?? req.body.date;

    const cycle = await cycleService.endPeriod(req.user.id, { date });

    return ApiResponse.success(res, cycle, 'Period ended');
  } catch (error) {
    next(error);
  }
};

/**
 * Update period start date on current active cycle
 * PUT /api/v1/cycles/start
 */
const updatePeriodStart = async (req, res, next) => {
  try {
    const date = req.body.start_date ?? req.body.date;
    const cycle = await cycleService.updatePeriodStart(req.user.id, { date });
    return ApiResponse.success(res, cycle, 'Period start date updated');
  } catch (error) {
    next(error);
  }
};

/**
 * Update period end date on current active cycle
 * PUT /api/v1/cycles/end
 */
const updatePeriodEnd = async (req, res, next) => {
  try {
    const date = req.body.end_date ?? req.body.date;
    const cycle = await cycleService.updatePeriodEnd(req.user.id, { date });
    return ApiResponse.success(res, cycle, 'Period end date updated');
  } catch (error) {
    next(error);
  }
};

/**
 * Log daily entry
 * POST /api/v1/cycles/log
 */
const logDailyEntry = async (req, res, next) => {
  try {
    const entry = await cycleService.logDailyEntry(req.user.id, req.body);

    return ApiResponse.success(res, entry, 'Daily entry logged');
  } catch (error) {
    next(error);
  }
};

/**
 * Get current cycle status
 * GET /api/v1/cycles/current
 */
const getCurrentCycle = async (req, res, next) => {
  try {
    const cycle = await cycleService.getCurrentCycle(req.user.id);

    if (!cycle) {
      return ApiResponse.success(res, null, 'No active cycle found');
    }

    // Add snake_case aliases for frontend compatibility
    return ApiResponse.success(res, {
      ...cycle,
      current_day: cycle.dayOfCycle,
      cycle_length: cycle.cycleLength,
      period_length: cycle.periodLength,
      ovulation_day: cycle.ovulationDay,
      current_phase: cycle.phase?.name ?? null,
      days_until_next_period: cycle.predictions?.nextPeriod?.daysUntil ?? null,
      last_period_start: cycle.startDate ?? null,
      period_dates: cycle.period_dates ?? [],
      fertility_window: cycle.fertility_window ?? [],
      ovulation_date: cycle.ovulation_date ?? null,
      pregnancy_chance: cycle.pregnancy_chance ?? null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get cycle history
 * GET /api/v1/cycles
 */
const getCycles = async (req, res, next) => {
  try {
    const { page, limit, startDate, endDate } = req.query;

    const result = await cycleService.getCycles(req.user.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      startDate,
      endDate,
    });

    return ApiResponse.paginated(res, result.cycles, result.pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * Get cycle by ID
 * GET /api/v1/cycles/:cycleId
 */
const getCycleById = async (req, res, next) => {
  try {
    const cycle = await cycleService.getCycleById(req.user.id, req.params.cycleId);

    return ApiResponse.success(res, cycle);
  } catch (error) {
    next(error);
  }
};

/**
 * Update cycle
 * PUT /api/v1/cycles/:cycleId
 */
const updateCycle = async (req, res, next) => {
  try {
    const cycle = await cycleService.updateCycle(req.user.id, req.params.cycleId, req.body);

    return ApiResponse.success(res, cycle, 'Cycle updated');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete cycle
 * DELETE /api/v1/cycles/:cycleId
 */
const deleteCycle = async (req, res, next) => {
  try {
    const result = await cycleService.deleteCycle(req.user.id, req.params.cycleId);

    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get daily log for specific date
 * GET /api/v1/cycles/log/:date
 */
const getDailyLog = async (req, res, next) => {
  try {
    const log = await cycleService.getDailyLog(req.user.id, req.params.date);

    return ApiResponse.success(res, log);
  } catch (error) {
    next(error);
  }
};

/**
 * Get cycle analytics
 * GET /api/v1/cycles/analytics
 */
const getAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 6 months if no dates provided
    const end = endDate || new Date().toISOString().split('T')[0];
    const start =
      startDate ||
      (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 6);
        return d.toISOString().split('T')[0];
      })();

    const analytics = await cycleService.getAnalytics(req.user.id, {
      startDate: start,
      endDate: end,
    });

    return ApiResponse.success(res, analytics);
  } catch (error) {
    next(error);
  }
};

/**
 * Get predictions
 * GET /api/v1/cycles/predictions
 */
const getPredictions = async (req, res, next) => {
  try {
    const cycle = await cycleService.getCurrentCycle(req.user.id);

    if (!cycle || !cycle.predictions) {
      return ApiResponse.success(res, null, 'Not enough data for predictions');
    }

    return ApiResponse.success(res, cycle.predictions);
  } catch (error) {
    next(error);
  }
};

/**
 * Get phase date ranges for wheel segments
 * GET /api/v1/cycles/phases
 */
const getPhases = async (req, res, next) => {
  try {
    const phases = await cycleService.getPhases(req.user.id);
    if (!phases) return ApiResponse.success(res, null, 'No cycle data found');
    return ApiResponse.success(res, phases, 'Cycle phases retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * Get multi-month period + ovulation forecast
 * GET /api/v1/cycles/forecast?months=3
 */
const getForecast = async (req, res, next) => {
  try {
    const months = Math.min(12, Math.max(1, parseInt(req.query.months) || 3));
    const forecast = await cycleService.getForecast(req.user.id, months);
    if (!forecast) return ApiResponse.success(res, null, 'No cycle data found');
    return ApiResponse.success(res, forecast, 'Forecast retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * Add log to a specific cycle
 * POST /api/v1/cycles/:cycleId/logs
 */
const addCycleLog = async (req, res, next) => {
  try {
    const entry = await cycleService.logDailyEntry(req.user.id, {
      ...req.body,
      cycleId: req.params.cycleId,
    });

    return ApiResponse.success(res, entry, 'Cycle log added');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startPeriod,
  endPeriod,
  updatePeriodStart,
  updatePeriodEnd,
  logDailyEntry,
  addCycleLog,
  getCurrentCycle,
  getCycles,
  getCycleById,
  updateCycle,
  deleteCycle,
  getDailyLog,
  getAnalytics,
  getPredictions,
  getPhases,
  getForecast,
};
