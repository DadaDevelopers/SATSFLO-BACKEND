'use strict';

const journalService = require('../services/journal.service');
const ApiResponse = require('../utils/response');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;

// Valid mood values (matches the add-log / journal mood screens)
const VALID_MOODS = [
  'normal', 'happy', 'sad', 'calm', 'hyped', 'inlove', 'in_love',
  'peaceful', 'angry', 'lonely', 'silly', 'relaxed',
];

const journalController = {

  // GET /journal?month=YYYY-MM
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

  // GET /journal/search?q=text&month=YYYY-MM
  async search(req, res) {
    try {
      const { q, month } = req.query;
      if (!q || q.trim().length < 1) {
        return ApiResponse.validationError(res, [
          { field: 'q', message: 'Query param ?q is required' },
        ]);
      }
      if (month && !MONTH_RE.test(month)) {
        return ApiResponse.validationError(res, [
          { field: 'month', message: 'month must be YYYY-MM' },
        ]);
      }
      const entries = await journalService.search(req.user.id, { q: q.trim(), month });
      return ApiResponse.success(res, entries, 'Search results');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // GET /journal/:id
  async getById(req, res) {
    try {
      const entry = await journalService.getById(req.user.id, req.params.id);
      return ApiResponse.success(res, entry, 'Journal entry retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // POST /journal
  async create(req, res) {
    try {
      const entry_date = req.body.date ?? req.body.entry_date;
      if (!entry_date || !DATE_RE.test(entry_date)) {
        return ApiResponse.validationError(res, [
          { field: 'date', message: 'date (YYYY-MM-DD) is required' },
        ]);
      }

      const { title, content, mood, symptoms, images } = req.body;

      if (mood && !VALID_MOODS.includes(mood)) {
        return ApiResponse.validationError(res, [
          { field: 'mood', message: `mood must be one of: ${VALID_MOODS.filter(m => !m.includes('_')).join(', ')}` },
        ]);
      }

      if (symptoms !== undefined && !Array.isArray(symptoms)) {
        return ApiResponse.validationError(res, [{ field: 'symptoms', message: 'symptoms must be an array' }]);
      }

      if (images !== undefined && !Array.isArray(images)) {
        return ApiResponse.validationError(res, [{ field: 'images', message: 'images must be an array' }]);
      }

      const entry = await journalService.create(req.user.id, {
        entry_date,
        title:    title    ?? null,
        content:  content  ?? '',
        mood:     mood     ?? null,
        symptoms: symptoms ?? [],
        images:   images   ?? [],
      });

      return ApiResponse.created(res, entry, 'Journal entry created');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // PUT /journal/:id
  async update(req, res) {
    try {
      const { title, content, mood, symptoms, images } = req.body;
      const entry_date = req.body.date ?? req.body.entry_date;

      if (mood && !VALID_MOODS.includes(mood)) {
        return ApiResponse.validationError(res, [
          { field: 'mood', message: `mood must be one of: ${VALID_MOODS.filter(m => !m.includes('_')).join(', ')}` },
        ]);
      }

      if (symptoms !== undefined && !Array.isArray(symptoms)) {
        return ApiResponse.validationError(res, [{ field: 'symptoms', message: 'symptoms must be an array' }]);
      }

      if (images !== undefined && !Array.isArray(images)) {
        return ApiResponse.validationError(res, [{ field: 'images', message: 'images must be an array' }]);
      }

      const updates = {};
      if (title      !== undefined) updates.title      = title;
      if (content    !== undefined) updates.content    = content;
      if (mood       !== undefined) updates.mood       = mood;
      if (symptoms   !== undefined) updates.symptoms   = symptoms;
      if (images     !== undefined) updates.images     = images;
      if (entry_date !== undefined) updates.entry_date = entry_date;

      if (Object.keys(updates).length === 0) {
        return ApiResponse.validationError(res, [
          { field: 'body', message: 'Provide at least one field to update' },
        ]);
      }

      const entry = await journalService.update(req.user.id, req.params.id, updates);
      return ApiResponse.success(res, entry, 'Journal entry updated');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // DELETE /journal/:id
  async delete(req, res) {
    try {
      await journalService.delete(req.user.id, req.params.id);
      return ApiResponse.success(res, null, 'Journal entry deleted');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // DELETE /journal
  async deleteAll(req, res) {
    try {
      const count = await journalService.deleteAll(req.user.id);
      return ApiResponse.success(res, { deleted_count: count }, 'Journal cleared');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // POST /journal/media  — multipart { files } → returns base64 data URLs
  async uploadMedia(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return ApiResponse.validationError(res, [
          { field: 'files', message: 'At least one file is required' },
        ]);
      }

      const urls = req.files.map(file => {
        const b64 = file.buffer.toString('base64');
        return `data:${file.mimetype};base64,${b64}`;
      });

      return ApiResponse.success(res, { urls }, 'Media uploaded');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },
};

module.exports = journalController;
