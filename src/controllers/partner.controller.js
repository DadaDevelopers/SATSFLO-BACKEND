'use strict';

const partnerService = require('../services/partner.service');
const ApiResponse = require('../utils/response');

const partnerController = {

  // POST /partner/invite
  async generateInvite(req, res) {
    try {
      const sharingSettings = {};
      const FIELDS = ['share_period_dates', 'share_fertile_window', 'share_symptoms_moods',
                      'share_cycle_insights', 'share_sex_drive'];
      for (const f of FIELDS) {
        if (req.body[f] !== undefined) sharingSettings[f] = req.body[f];
      }

      const result = await partnerService.generateInvite(req.user.id, sharingSettings);
      return ApiResponse.created(res, result, 'Invite code generated');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // GET /partner/invite/status
  async getInviteStatus(req, res) {
    try {
      const result = await partnerService.getInviteStatus(req.user.id);
      return ApiResponse.success(res, result);
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // POST /partner/accept
  async acceptInvite(req, res) {
    try {
      const { invite_code } = req.body;
      if (!invite_code) {
        return ApiResponse.validationError(res, [{ field: 'invite_code', message: 'invite_code is required' }]);
      }
      const result = await partnerService.acceptInvite(req.user.id, invite_code);
      return ApiResponse.created(res, result, 'Partner connected');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // GET /partner
  async getPartner(req, res) {
    try {
      const result = await partnerService.getPartner(req.user.id);
      return ApiResponse.success(res, result);
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // DELETE /partner
  async unpair(req, res) {
    try {
      const result = await partnerService.unpair(req.user.id);
      return ApiResponse.success(res, result, 'Partner unlinked');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // PUT /partner/nickname
  async updateNicknames(req, res) {
    try {
      const { my_nickname, partner_nickname } = req.body;
      if (!my_nickname && !partner_nickname) {
        return ApiResponse.validationError(res, [
          { field: 'my_nickname', message: 'At least one of my_nickname or partner_nickname is required' },
        ]);
      }
      const result = await partnerService.updateNicknames(req.user.id, { my_nickname, partner_nickname });
      return ApiResponse.success(res, result, 'Nicknames updated');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // GET /partner/settings
  async getSettings(req, res) {
    try {
      const result = await partnerService.getSettings(req.user.id);
      return ApiResponse.success(res, result);
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // PUT /partner/settings
  async updateSettings(req, res) {
    try {
      const result = await partnerService.updateSettings(req.user.id, req.body);
      return ApiResponse.success(res, result, 'Sharing settings updated');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // PUT /partner/mode
  async updatePartnerMode(req, res) {
    try {
      const { partner_mode_enabled } = req.body;
      if (partner_mode_enabled === undefined) {
        return ApiResponse.validationError(res, [
          { field: 'partner_mode_enabled', message: 'partner_mode_enabled (boolean) is required' },
        ]);
      }
      const result = await partnerService.updatePartnerMode(req.user.id, Boolean(partner_mode_enabled));
      return ApiResponse.success(res, result, 'Partner mode updated');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // GET /partner/cycle
  async getPartnerCycle(req, res) {
    try {
      const result = await partnerService.getPartnerCycle(req.user.id);
      return ApiResponse.success(res, result);
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  // GET /partner/calendar
  async getPartnerCalendar(req, res) {
    try {
      const result = await partnerService.getPartnerCalendar(req.user.id);
      return ApiResponse.success(res, result);
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },
};

module.exports = partnerController;
