'use strict';

const journalService = require('../services/journal.service');
const ApiResponse = require('../utils/response');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;

// Map DB row → frontend-expected shape
function toFrontend(entry) {
  if (!entry) return entry;
  return {
    ...entry,
    date: entry.entry_date,
  };
}

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
      return ApiResponse.success(res, entries.map(toFrontend), 'Journal entries retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const entry = await journalService.getById(req.user.id, id);
      return ApiResponse.success(res, toFrontend(entry), 'Journal entry retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async create(req, res) {
    try {
      // Accept both `date` (frontend) and `entry_date` (legacy)
      const entry_date = req.body.date ?? req.body.entry_date;
      const { content, title, mood } = req.body;

      if (!entry_date || !DATE_RE.test(entry_date)) {
        return ApiResponse.validationError(res, [
          { field: 'date', message: 'date must be YYYY-MM-DD' },
        ]);
      }

      const entry = await journalService.create(req.user.id, {
        entry_date,
        content: typeof content === 'string' ? content : '',
        title: title ?? null,
        mood: mood ?? null,
      });

      return ApiResponse.created(res, toFrontend(entry), 'Journal entry created');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { content, title, mood } = req.body;
      const entry_date = req.body.date ?? req.body.entry_date;

      const updates = {};
      if (content !== undefined)    updates.content = content;
      if (title !== undefined)      updates.title = title;
      if (mood !== undefined)       updates.mood = mood;
      if (entry_date !== undefined) updates.entry_date = entry_date;

      if (Object.keys(updates).length === 0) {
        return ApiResponse.validationError(res, [{ field: 'body', message: 'Provide at least one field to update' }]);
      }

      const entry = await journalService.update(req.user.id, id, updates);
      return ApiResponse.success(res, toFrontend(entry), 'Journal entry updated');
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
