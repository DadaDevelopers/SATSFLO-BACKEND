'use strict';

const journalService = require('../services/journal.service');
const ApiResponse = require('../utils/response');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;

const journalController = {
  async getByMonth(req, res) {
    try {
      const { month } = req.query;

      if (!month || !MONTH_RE.test(month)) {
        return ApiResponse.validationError(res, [
          { field: 'month', message: 'Query param ?month=YYYY-MM is required' },
        ]);
      }

      const entries = await journalService.getByMonth(req.user.id, month);
      return ApiResponse.success(res, entries, 'Journal entries retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async create(req, res) {
    try {
      const { entry_date, content } = req.body;

      const errors = [];
      if (!entry_date || !DATE_RE.test(entry_date)) {
        errors.push({ field: 'entry_date', message: 'entry_date must be YYYY-MM-DD' });
      }
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        errors.push({ field: 'content', message: 'content is required' });
      }
      if (errors.length) return ApiResponse.validationError(res, errors);

      const entry = await journalService.create(req.user.id, {
        entry_date,
        content: content.trim(),
      });

      return ApiResponse.created(res, entry, 'Journal entry created');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return ApiResponse.validationError(res, [{ field: 'content', message: 'content is required' }]);
      }
      const entry = await journalService.update(req.user.id, id, { content: content.trim() });
      return ApiResponse.success(res, entry, 'Journal entry updated');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      await journalService.delete(req.user.id, id);
      return ApiResponse.success(res, null, 'Journal entry deleted');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },
};

module.exports = journalController;
