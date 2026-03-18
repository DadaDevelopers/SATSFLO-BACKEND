'use strict';

const paymentService = require('../services/payment.service');
const ApiResponse = require('../utils/response');

const paymentController = {

  /**
   * POST /payments/validate
   * Validate a lightning address or LNURL before amount entry.
   * Returns min/max sats so the UI can enforce limits.
   */
  async validateAddress(req, res) {
    try {
      const { lightning_address } = req.body;
      const result = await paymentService.validateAddress(lightning_address);
      return ApiResponse.success(res, result, 'Address is valid');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  /**
   * POST /payments/tip
   * Accepts recipient_id (SatsFlo user) OR lightning_address/lnurl directly.
   */
  async createTip(req, res) {
    try {
      const { recipient_id, lightning_address, amount_sats, thread_id, note } = req.body;

      if (!amount_sats || Number(amount_sats) <= 0) {
        return ApiResponse.validationError(res, [
          { field: 'amount_sats', message: 'amount_sats must be a positive number' },
        ]);
      }
      if (!recipient_id && !lightning_address) {
        return ApiResponse.validationError(res, [
          { field: 'recipient_id', message: 'recipient_id or lightning_address is required' },
        ]);
      }

      const result = await paymentService.createTip({
        senderId: req.user.id,
        recipientId: recipient_id || null,
        lightningAddress: lightning_address || null,
        amountSats: Number(amount_sats),
        threadId: thread_id,
        note,
      });
      return ApiResponse.created(res, result, 'Invoice generated');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async getStatus(req, res) {
    try {
      const { paymentHash } = req.params;
      const status = await paymentService.getStatus(req.user.id, paymentHash);
      return ApiResponse.success(res, status, 'Payment status retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async getHistory(req, res) {
    try {
      const { type = 'sent' } = req.query;
      const history = await paymentService.getHistory(req.user.id, type === 'received' ? 'received' : 'sent');
      return ApiResponse.success(res, history, 'Payment history retrieved');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async confirm(req, res) {
    try {
      const { payment_hash } = req.body;
      if (!payment_hash) {
        return ApiResponse.validationError(res, [{ field: 'payment_hash', message: 'payment_hash is required' }]);
      }
      const tx = await paymentService.confirmBySender(req.user.id, payment_hash);
      return ApiResponse.success(res, tx, 'Payment confirmed');
    } catch (err) {
      return ApiResponse.error(res, err.message, err.statusCode || 500);
    }
  },

  async webhook(req, res) {
    try {
      // Simple webhook: body contains { payment_hash }
      // In production, validate a shared secret header
      const secret = req.headers['x-webhook-secret'];
      if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      const { payment_hash } = req.body;
      if (!payment_hash) return res.status(400).json({ success: false, message: 'payment_hash required' });
      const tx = await paymentService.confirmPayment(payment_hash);
      return res.json({ success: true, confirmed: !!tx });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = paymentController;
