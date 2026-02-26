'use strict';

const cycleProfileService = require('../services/cycleProfile.service');
const ApiResponse = require('../utils/response');

const CYCLE_DEFAULTS = { min: 21, max: 35 };
const PERIOD_DEFAULTS = { min: 3, max: 9 };

const cycleProfileController = {
  async create(req, res) {
    try {
      const { cycle_length, period_length, last_period_start } = req.body;

      if (!last_period_start) {
        return ApiResponse.validationError(res, [
          { field: 'last_period_start', message: 'last_period_start is required' },
        ]);
      }

      const cl = Number(cycle_length) || 28;
      const pl = Number(period_length) || 5;

      if (cl < CYCLE_DEFAULTS.min || cl > CYCLE_DEFAULTS.max) {
        return ApiResponse.validationError(res, [
          { field: 'cycle_length', message: `Must be between ${CYCLE_DEFAULTS.min} and ${CYCLE_DEFAULTS.max}` },
        ]);
      }

      if (pl < PERIOD_DEFAULTS.min || pl > PERIOD_DEFAULTS.max) {
        return ApiResponse.validationError(res, [
          { field: 'period_length', message: `Must be between ${PERIOD_DEFAULTS.min} and ${PERIOD_DEFAULTS.max}` },
        ]);
      }

      const profile = await cycleProfileService.upsert(req.user.id, {
        cycle_length: cl,
        period_length: pl,
        last_period_start,
      });

      return ApiResponse.created(res, profile, 'Cycle profile saved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async get(req, res) {
    try {
      const profile = await cycleProfileService.getWithCalculations(req.user.id);

      if (!profile) {
        return ApiResponse.notFound(res, 'No cycle profile found. Please create one first.');
      }

      return ApiResponse.success(res, profile, 'Cycle profile retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },
};

module.exports = cycleProfileController;
