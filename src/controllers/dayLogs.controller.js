'use strict';

const dayLogsService = require('../services/dayLogs.service');
const ApiResponse = require('../utils/response');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(str) {
  if (!DATE_RE.test(str)) return false;
  return !isNaN(new Date(str).getTime());
}

// ── Value normalisation (frontend camelCase ↔ DB snake_case) ─────────────────

// flow: frontend uses camelCase, DB stores snake_case
const FLOW_TO_DB   = { veryHeavy: 'very_heavy', light: 'light', medium: 'medium', heavy: 'heavy', spotting: 'spotting' };
const FLOW_FROM_DB = { very_heavy: 'veryHeavy', light: 'light', medium: 'medium', heavy: 'heavy', spotting: 'spotting' };

// symptoms, mood, medicine are TEXT[] — stored exactly as frontend sends them
// (no DB constraint on those columns)

// ── Response formatter — exact shape the frontend expects ────────────────────

function toFrontend(log) {
  if (!log) {
    // Return the default empty shape so GET always returns a consistent object
    return {
      flow_level:       null,
      symptoms:         [],
      mood:             [],
      notes:            null,
      medicine:         [],
      weight:           null,
      weight_unit:      'kg',
      temperature:      null,
      temperature_unit: 'C',
      water_intake_ml:  0,
      period_start:     false,
      period_end:       false,
    };
  }

  return {
    flow_level:       (log.flow_level ? (FLOW_FROM_DB[log.flow_level] ?? log.flow_level) : null),
    symptoms:         log.symptoms         ?? [],
    mood:             log.moods            ?? [],
    notes:            log.note             ?? null,
    medicine:         log.medicine         ?? [],
    weight:           log.weight           != null ? Number(log.weight) : null,
    weight_unit:      log.weight_unit      ?? 'kg',
    temperature:      log.temperature      != null ? Number(log.temperature) : null,
    temperature_unit: log.temperature_unit ?? 'C',
    water_intake_ml:  log.water_intake     ?? 0,
    period_start:     log.period_start     ?? false,
    period_end:       log.period_end       ?? false,
  };
}

// ── Controller ────────────────────────────────────────────────────────────────

const dayLogsController = {

  // GET /logs?date=YYYY-MM-DD
  async getByDate(req, res) {
    try {
      const { date } = req.query;
      if (!date || !isValidDate(date)) {
        return ApiResponse.validationError(res, [
          { field: 'date', message: 'Query param ?date=YYYY-MM-DD is required' },
        ]);
      }
      const log = await dayLogsService.getByDate(req.user.id, date);
      return ApiResponse.success(res, toFrontend(log), 'Day log retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // GET /logs/:date
  async getByDateParam(req, res) {
    try {
      const { date } = req.params;
      if (!isValidDate(date)) {
        return ApiResponse.validationError(res, [
          { field: 'date', message: 'URL param :date must be YYYY-MM-DD' },
        ]);
      }
      const log = await dayLogsService.getByDate(req.user.id, date);
      return ApiResponse.success(res, toFrontend(log), 'Day log retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // PUT /logs/:date
  async upsert(req, res) {
    try {
      const { date } = req.params;
      if (!isValidDate(date)) {
        return ApiResponse.validationError(res, [
          { field: 'date', message: 'URL param :date must be YYYY-MM-DD' },
        ]);
      }

      const body = req.body;
      const fields = {};

      // flow → flow_level  (normalise veryHeavy → very_heavy)
      const rawFlow = body.flow ?? body.flow_level;
      if (rawFlow !== undefined) {
        const dbFlow = FLOW_TO_DB[rawFlow] ?? rawFlow;
        fields.flow_level = dbFlow;
      }

      // symptoms — array, stored as-is
      if (body.symptoms !== undefined) fields.symptoms = body.symptoms;

      // mood / moods — store under moods column
      const rawMood = body.mood ?? body.moods;
      if (rawMood !== undefined) fields.moods = rawMood;

      // notes / note
      const rawNote = body.notes ?? body.note;
      if (rawNote !== undefined) fields.note = rawNote;

      // medicine — array, stored as-is
      if (body.medicine !== undefined) fields.medicine = body.medicine;

      // weight — accept numeric string or number
      if (body.weight !== undefined && body.weight !== null && body.weight !== '') {
        const w = Number(body.weight);
        if (!isNaN(w)) fields.weight = w;
      }
      if (body.weight_unit !== undefined) fields.weight_unit = body.weight_unit;

      // temperature — accept numeric string or number
      if (body.temperature !== undefined && body.temperature !== null && body.temperature !== '') {
        const t = Number(body.temperature);
        if (!isNaN(t)) fields.temperature = t;
      }
      if (body.temperature_unit !== undefined) fields.temperature_unit = body.temperature_unit;

      // water_intake / water_intake_ml
      const rawWater = body.water_intake_ml ?? body.water_intake;
      if (rawWater !== undefined) fields.water_intake = rawWater;

      // period_start / period_end (set by cycle endpoints, but accept here too)
      if (body.period_start !== undefined) fields.period_start = body.period_start;
      if (body.period_end   !== undefined) fields.period_end   = body.period_end;

      const log = await dayLogsService.upsert(req.user.id, date, fields);
      return ApiResponse.success(res, toFrontend(log), 'Day log saved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // GET /logs/range?from=YYYY-MM-DD&to=YYYY-MM-DD
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
      return ApiResponse.success(res, logs.map(toFrontend), 'Logs range retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },
};

module.exports = dayLogsController;
