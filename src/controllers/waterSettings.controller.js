'use strict';

const waterSettingsService = require('../services/waterSettings.service');
const ApiResponse = require('../utils/response');

const waterSettingsController = {
  async get(req, res) {
    try {
      const settings = await waterSettingsService.get(req.user.id);
      return ApiResponse.success(
        res,
        {
          ...settings,
          daily_goal_ml: settings?.water_target ?? null,
        },
        'Water settings retrieved'
      );
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async update(req, res) {
    try {
      // Accept daily_goal_ml as alias for water_target
      const water_target = req.body.water_target ?? req.body.daily_goal_ml;
      const { cup_capacity, cup_style } = req.body;
      const fields = {};

      if (water_target !== undefined) {
        const wt = Number(water_target);
        if (!Number.isInteger(wt) || wt <= 0) {
          return ApiResponse.validationError(res, [
            { field: 'water_target', message: 'Must be a positive integer (ml)' },
          ]);
        }
        fields.water_target = wt;
      }

      if (cup_capacity !== undefined) {
        const cc = Number(cup_capacity);
        if (!Number.isInteger(cc) || cc <= 0) {
          return ApiResponse.validationError(res, [
            { field: 'cup_capacity', message: 'Must be a positive integer (ml)' },
          ]);
        }
        fields.cup_capacity = cc;
      }

      if (cup_style !== undefined) {
        fields.cup_style = String(cup_style).trim();
      }

      if (Object.keys(fields).length === 0) {
        return ApiResponse.validationError(res, [
          { field: 'body', message: 'Provide at least one field to update' },
        ]);
      }

      const settings = await waterSettingsService.upsert(req.user.id, fields);
      return ApiResponse.success(
        res,
        {
          ...settings,
          daily_goal_ml: settings?.water_target ?? null,
        },
        'Water settings updated'
      );
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },
};

module.exports = waterSettingsController;
