'use strict';

const dayLogsService = require('../services/dayLogs.service');
const ApiResponse = require('../utils/response');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(str) {
  if (!DATE_RE.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

const dayLogsController = {
  async getByDate(req, res) {
    try {
      const { date } = req.query;

      if (!date || !isValidDate(date)) {
        return ApiResponse.validationError(res, [
          { field: 'date', message: 'Query param ?date=YYYY-MM-DD is required' },
        ]);
      }

      const log = await dayLogsService.getByDate(req.user.id, date);
      return ApiResponse.success(res, log, 'Day log retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async upsert(req, res) {
    try {
      const { date } = req.params;

      if (!isValidDate(date)) {
        return ApiResponse.validationError(res, [
          { field: 'date', message: 'URL param :date must be YYYY-MM-DD' },
        ]);
      }

      const allowed = [
        'period_start', 'period_end', 'flow_level',
        'symptoms', 'moods', 'medicine',
        'note', 'weight', 'temperature', 'water_intake',
      ];

      const fields = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) fields[key] = req.body[key];
      }

      const log = await dayLogsService.upsert(req.user.id, date, fields);
      return ApiResponse.success(res, log, 'Day log saved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async getRange(req, res) {
    try {
      const { from, to } = req.query;

      if (!from || !isValidDate(from)) {
        return ApiResponse.validationError(res, [
          { field: 'from', message: 'Query param ?from=YYYY-MM-DD is required' },
        ]);
      }
      if (!to || !isValidDate(to)) {
        return ApiResponse.validationError(res, [
          { field: 'to', message: 'Query param ?to=YYYY-MM-DD is required' },
        ]);
      }
      if (from > to) {
        return ApiResponse.validationError(res, [
          { field: 'from', message: '?from must not be after ?to' },
        ]);
      }

      const logs = await dayLogsService.getRange(req.user.id, from, to);
      return ApiResponse.success(res, logs, 'Logs range retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },
};

module.exports = dayLogsController;
