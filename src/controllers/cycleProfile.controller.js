'use strict';

const cycleProfileService = require('../services/cycleProfile.service');
const ApiResponse = require('../utils/response');

const CYCLE_DEFAULTS = { min: 21, max: 35 };
const PERIOD_DEFAULTS = { min: 3, max: 9 };

function validateLengths(cycle_length, period_length, luteal_phase_length) {
  if (cycle_length !== undefined) {
    const cl = Number(cycle_length);
    if (cl < CYCLE_DEFAULTS.min || cl > CYCLE_DEFAULTS.max) {
      return { field: 'cycle_length', message: `Must be between ${CYCLE_DEFAULTS.min} and ${CYCLE_DEFAULTS.max}` };
    }
  }
  if (period_length !== undefined) {
    const pl = Number(period_length);
    if (pl < PERIOD_DEFAULTS.min || pl > PERIOD_DEFAULTS.max) {
      return { field: 'period_length', message: `Must be between ${PERIOD_DEFAULTS.min} and ${PERIOD_DEFAULTS.max}` };
    }
  }
  if (luteal_phase_length !== undefined) {
    const ll = Number(luteal_phase_length);
    if (ll < 7 || ll > 21) {
      return { field: 'luteal_phase_length', message: 'Must be between 7 and 21' };
    }
  }
  return null;
}

const cycleProfileController = {
  async create(req, res) {
    try {
      // Accept both snake_case and camelCase from the frontend
      const cycle_length       = req.body.cycle_length       ?? req.body.cycleLength;
      const period_length      = req.body.period_length      ?? req.body.periodLength;
      const last_period_start  = req.body.last_period_start  ?? req.body.lastPeriodStart;
      const luteal_phase_length = req.body.luteal_phase_length ?? req.body.lutealPhaseLength;
      const ignore_irregular_cycle = req.body.ignore_irregular_cycle ?? req.body.ignoreIrregularCycle;

      if (!last_period_start) {
        return ApiResponse.validationError(res, [
          { field: 'last_period_start', message: 'last_period_start (or lastPeriodStart) is required' },
        ]);
      }

      const cl = Number(cycle_length) || 28;
      const pl = Number(period_length) || 5;
      const ll = luteal_phase_length !== undefined ? Number(luteal_phase_length) : 14;

      const validationError = validateLengths(cl, pl, ll);
      if (validationError) return ApiResponse.validationError(res, [validationError]);

      const profile = await cycleProfileService.upsert(req.user.id, {
        cycle_length: cl,
        period_length: pl,
        last_period_start,
        luteal_phase_length: ll,
        ignore_irregular_cycle: ignore_irregular_cycle ?? false,
      });

      return ApiResponse.created(res, profile, 'Cycle profile saved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async update(req, res) {
    try {
      // Accept both snake_case and camelCase
      const cycle_length       = req.body.cycle_length       ?? req.body.cycleLength;
      const period_length      = req.body.period_length      ?? req.body.periodLength;
      const last_period_start  = req.body.last_period_start  ?? req.body.lastPeriodStart;
      const luteal_phase_length = req.body.luteal_phase_length ?? req.body.lutealPhaseLength;
      const ignore_irregular_cycle = req.body.ignore_irregular_cycle ?? req.body.ignoreIrregularCycle;

      const validationError = validateLengths(cycle_length, period_length, luteal_phase_length);
      if (validationError) return ApiResponse.validationError(res, [validationError]);

      const updates = {};
      if (cycle_length !== undefined)         updates.cycle_length = Number(cycle_length);
      if (period_length !== undefined)        updates.period_length = Number(period_length);
      if (last_period_start !== undefined)    updates.last_period_start = last_period_start;
      if (luteal_phase_length !== undefined)  updates.luteal_phase_length = Number(luteal_phase_length);
      if (ignore_irregular_cycle !== undefined) updates.ignore_irregular_cycle = ignore_irregular_cycle;

      const profile = await cycleProfileService.patch(req.user.id, updates);
      if (!profile) {
        return ApiResponse.notFound(res, 'No cycle profile found. Use POST to create one first.');
      }

      return ApiResponse.success(res, profile, 'Cycle profile updated');
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
