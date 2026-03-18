'use strict';

const lightningService = require('../services/lightning.service');
const ApiResponse = require('../utils/response');

const lightningController = {
  async getWallet(req, res) {
    try {
      const wallet = await lightningService.getWallet(req.user.id, req.query.walletId);
      return ApiResponse.success(res, wallet, 'Lightning wallet retrieved');
    } catch (error) {
      return ApiResponse.error(res, error.message, error.statusCode || 500, error.details || null);
    }
  },

  async syncWallet(req, res) {
    try {
      const wallet = await lightningService.syncWallet(req.user.id, req.body?.walletId);
      return ApiResponse.success(res, wallet, 'Lightning wallet synced');
    } catch (error) {
      return ApiResponse.error(res, error.message, error.statusCode || 500, error.details || null);
    }
  },

  async createInvoice(req, res) {
    try {
      const result = await lightningService.createInvoice(req.user.id, req.body);
      return ApiResponse.created(res, result, 'Lightning invoice created');
    } catch (error) {
      return ApiResponse.error(res, error.message, error.statusCode || 500, error.details || null);
    }
  },

  async probePayment(req, res) {
    try {
      const result = await lightningService.probePayment(req.user.id, req.body);
      return ApiResponse.success(res, result, 'Lightning payment fee estimated');
    } catch (error) {
      return ApiResponse.error(res, error.message, error.statusCode || 500, error.details || null);
    }
  },

  async payInvoice(req, res) {
    try {
      const result = await lightningService.payInvoice(req.user.id, req.body);
      return ApiResponse.created(res, result, 'Lightning payment submitted');
    } catch (error) {
      return ApiResponse.error(res, error.message, error.statusCode || 500, error.details || null);
    }
  },

  async previewPayment(req, res) {
    try {
      const result = await lightningService.previewPayment(req.user.id, req.body);
      return ApiResponse.success(res, result, 'Lightning payment preview retrieved');
    } catch (error) {
      return ApiResponse.error(res, error.message, error.statusCode || 500, error.details || null);
    }
  },

  async payLnurl(req, res) {
    try {
      const result = await lightningService.payLnurl(req.user.id, req.body);
      return ApiResponse.created(res, result, 'LNURL payment submitted');
    } catch (error) {
      return ApiResponse.error(res, error.message, error.statusCode || 500, error.details || null);
    }
  },

  async payLightningAddress(req, res) {
    try {
      const result = await lightningService.payLightningAddress(req.user.id, req.body);
      return ApiResponse.created(res, result, 'Lightning Address payment submitted');
    } catch (error) {
      return ApiResponse.error(res, error.message, error.statusCode || 500, error.details || null);
    }
  },

  async getTransactions(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await lightningService.listTransactions(req.user.id, {
        page: Math.max(1, Number(page)),
        limit: Math.min(50, Math.max(1, Number(limit)))
      });

      return ApiResponse.paginated(res, result.transactions, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (error) {
      return ApiResponse.error(res, error.message, error.statusCode || 500, error.details || null);
    }
  },

  async getProofOfPayment(req, res) {
    try {
      const proofs = await lightningService.getProofOfPayment(req.user.id, {
        paymentRequest: req.query.paymentRequest,
        limit: Math.min(20, Math.max(1, Number(req.query.limit || 5)))
      });

      return ApiResponse.success(res, proofs, 'Proof of payment retrieved');
    } catch (error) {
      return ApiResponse.error(res, error.message, error.statusCode || 500, error.details || null);
    }
  }
};

module.exports = lightningController;