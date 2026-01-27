/**
 * Health Controller
 *
 * Handles symptoms and mood tracking endpoints
 */

const healthService = require('../../services/health.service');
const ApiResponse = require('../../utils/response');
const logger = require('../../utils/logger');

// ==================== SYMPTOMS ====================

/**
 * Log a symptom
 * POST /api/v1/health/symptoms
 */
const logSymptom = async (req, res, next) => {
  try {
    const symptom = await healthService.logSymptom(req.user.id, req.body);
    return ApiResponse.created(res, symptom, 'Symptom logged');
  } catch (error) {
    next(error);
  }
};

/**
 * Log multiple symptoms
 * POST /api/v1/health/symptoms/batch
 */
const logMultipleSymptoms = async (req, res, next) => {
  try {
    const { date, symptoms } = req.body;
    const result = await healthService.logMultipleSymptoms(req.user.id, date, symptoms);
    return ApiResponse.created(res, result, `${result.length} symptoms logged`);
  } catch (error) {
    next(error);
  }
};

/**
 * Get symptoms
 * GET /api/v1/health/symptoms
 */
const getSymptoms = async (req, res, next) => {
  try {
    const { page, limit, startDate, endDate, category, symptom } = req.query;

    const result = await healthService.getSymptoms(req.user.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      startDate,
      endDate,
      category,
      symptom
    });

    return ApiResponse.paginated(res, result.symptoms, result.pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * Get symptoms for a date
 * GET /api/v1/health/symptoms/date/:date
 */
const getSymptomsByDate = async (req, res, next) => {
  try {
    const symptoms = await healthService.getSymptomsByDate(req.user.id, req.params.date);
    return ApiResponse.success(res, symptoms);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a symptom
 * PUT /api/v1/health/symptoms/:id
 */
const updateSymptom = async (req, res, next) => {
  try {
    const symptom = await healthService.updateSymptom(req.user.id, req.params.id, req.body);
    return ApiResponse.success(res, symptom, 'Symptom updated');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a symptom
 * DELETE /api/v1/health/symptoms/:id
 */
const deleteSymptom = async (req, res, next) => {
  try {
    const result = await healthService.deleteSymptom(req.user.id, req.params.id);
    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

// ==================== MOODS ====================

/**
 * Log a mood
 * POST /api/v1/health/moods
 */
const logMood = async (req, res, next) => {
  try {
    const mood = await healthService.logMood(req.user.id, req.body);
    return ApiResponse.created(res, mood, 'Mood logged');
  } catch (error) {
    next(error);
  }
};

/**
 * Log multiple moods
 * POST /api/v1/health/moods/batch
 */
const logMultipleMoods = async (req, res, next) => {
  try {
    const { date, moods } = req.body;
    const result = await healthService.logMultipleMoods(req.user.id, date, moods);
    return ApiResponse.created(res, result, `${result.length} moods logged`);
  } catch (error) {
    next(error);
  }
};

/**
 * Get moods
 * GET /api/v1/health/moods
 */
const getMoods = async (req, res, next) => {
  try {
    const { page, limit, startDate, endDate, mood } = req.query;

    const result = await healthService.getMoods(req.user.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      startDate,
      endDate,
      mood
    });

    return ApiResponse.paginated(res, result.moods, result.pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * Get moods for a date
 * GET /api/v1/health/moods/date/:date
 */
const getMoodsByDate = async (req, res, next) => {
  try {
    const moods = await healthService.getMoodsByDate(req.user.id, req.params.date);
    return ApiResponse.success(res, moods);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a mood
 * PUT /api/v1/health/moods/:id
 */
const updateMood = async (req, res, next) => {
  try {
    const mood = await healthService.updateMood(req.user.id, req.params.id, req.body);
    return ApiResponse.success(res, mood, 'Mood updated');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a mood
 * DELETE /api/v1/health/moods/:id
 */
const deleteMood = async (req, res, next) => {
  try {
    const result = await healthService.deleteMood(req.user.id, req.params.id);
    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

// ==================== ANALYTICS ====================

/**
 * Get symptom analytics
 * GET /api/v1/health/analytics/symptoms
 */
const getSymptomAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 3 months
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      return d.toISOString().split('T')[0];
    })();

    const analytics = await healthService.getSymptomAnalytics(req.user.id, {
      startDate: start,
      endDate: end
    });

    return ApiResponse.success(res, analytics);
  } catch (error) {
    next(error);
  }
};

/**
 * Get mood analytics
 * GET /api/v1/health/analytics/moods
 */
const getMoodAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      return d.toISOString().split('T')[0];
    })();

    const analytics = await healthService.getMoodAnalytics(req.user.id, {
      startDate: start,
      endDate: end
    });

    return ApiResponse.success(res, analytics);
  } catch (error) {
    next(error);
  }
};

/**
 * Get daily summary
 * GET /api/v1/health/summary/:date
 */
const getDailySummary = async (req, res, next) => {
  try {
    const summary = await healthService.getDailySummary(req.user.id, req.params.date);
    return ApiResponse.success(res, summary);
  } catch (error) {
    next(error);
  }
};

/**
 * Get health trends for a cycle
 * GET /api/v1/health/trends/:cycleId
 */
const getHealthTrends = async (req, res, next) => {
  try {
    const trends = await healthService.getHealthTrends(req.user.id, req.params.cycleId);
    return ApiResponse.success(res, trends);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Symptoms
  logSymptom,
  logMultipleSymptoms,
  getSymptoms,
  getSymptomsByDate,
  updateSymptom,
  deleteSymptom,

  // Moods
  logMood,
  logMultipleMoods,
  getMoods,
  getMoodsByDate,
  updateMood,
  deleteMood,

  // Analytics
  getSymptomAnalytics,
  getMoodAnalytics,
  getDailySummary,
  getHealthTrends
};
